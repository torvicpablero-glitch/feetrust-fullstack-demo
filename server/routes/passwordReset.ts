import { Router } from "express";
import crypto from "crypto";
import { findUserByEmail, createOrUpdateUserInDb } from "../db";
import { JWT_SECRET, resolveFromEmail } from "../lib/secrets";

const OTP_SECRET = JWT_SECRET;

function generateOtpToken(email: string, code: string, expires: number): string {
  const data = `${email.trim().toLowerCase()}:${code.trim()}:${expires}`;
  const hmac = crypto.createHmac("sha256", OTP_SECRET).update(data).digest("hex");
  return `${expires}.${hmac}`;
}

function verifyOtpToken(email: string, code: string, token: string): boolean {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [expiresStr, hmac] = token.split(".");
  const expires = Number(expiresStr);
  if (!expires || isNaN(expires) || Date.now() > expires) return false;
  const data = `${email.trim().toLowerCase()}:${code.trim()}:${expires}`;
  const expected = crypto.createHmac("sha256", OTP_SECRET).update(data).digest("hex");
  if (hmac.length !== expected.length) return false;
  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function hashPassword(password: string): string {
  return crypto.createHmac("sha256", OTP_SECRET).update(password).digest("hex");
}

// In-memory reset-code store (per instance) — the HMAC token is the durable proof.
const resetStore = new Map<string, { code: string; expiresAt: number }>();

export const passwordResetRouter = Router();

// POST /request-password-reset  { email }
passwordResetRouter.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: "Email is required." });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // Always compute a code + token so BOTH the "account exists" and "no such
    // account" responses are byte-for-byte identical in shape. If they differed
    // (e.g. only one carried a verificationToken) the endpoint would leak which
    // emails are registered — the opposite of what the generic message intends.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    const verificationToken = generateOtpToken(cleanEmail, code, expires);
    const isDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

    const genericBody: Record<string, any> = {
      success: true,
      emailSent: false,
      emailDeliveryConfigured: Boolean(process.env.RESEND_API_KEY),
      verificationToken,
      // Present in BOTH branches when in dev, omitted in BOTH in production —
      // otherwise the key itself would reveal whether the account exists.
      devCode: isDev ? code : undefined,
      message: `If an account exists for ${cleanEmail}, a reset code has been sent.`,
    };

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(200).json(genericBody);
    }

    resetStore.set(cleanEmail, { code, expiresAt: expires });

    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = resolveFromEmail("FeeTrust Security");
    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [cleanEmail],
            subject: `${code} is your FeeTrust password reset code`,
            html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>Reset your FeeTrust password</h2><p>Use the code below to set a new password. It expires in 10 minutes.</p><p style="font-size:32px;font-weight:900;letter-spacing:6px">${code}</p></div>`,
          }),
        });
        if (response.ok) {
          emailSent = true;
        } else {
          console.warn("[RESET] Resend rejected dispatch:", response.status, await response.text());
        }
      } catch (err) {
        console.error("[RESET] Resend error:", err);
      }
    }

    return res.status(200).json({
      ...genericBody,
      emailSent,
      devCode: isDev && !emailSent ? code : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /reset-password  { email, code, token, newPassword }
passwordResetRouter.post("/reset-password", async (req, res) => {
  try {
    const { email, code, token, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, reset code, and new password are required." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    let verified = false;
    if (token && String(token).includes(".")) {
      verified = verifyOtpToken(cleanEmail, cleanCode, String(token));
    }
    if (!verified) {
      const rec = resetStore.get(cleanEmail);
      if (rec && Date.now() <= rec.expiresAt && rec.code === cleanCode) verified = true;
    }
    if (!verified) {
      return res.status(400).json({ error: "Incorrect or expired reset code." });
    }

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    await createOrUpdateUserInDb({ ...user, passwordHash: hashPassword(String(newPassword)) });
    resetStore.delete(cleanEmail);
    return res.status(200).json({ success: true, message: "Password updated. You can now sign in." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
