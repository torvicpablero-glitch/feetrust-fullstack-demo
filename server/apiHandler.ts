import express from "express";
import cors from "cors";
import crypto from "crypto";
import { getUsersDb, checkDatabaseConnection, findUserByEmail } from "./db";
import { securityHeaders, globalRateLimiter, strictActionLimiter } from "./middleware/security";
import { requestLogger, reportHealthIssue } from "./middleware/observability";

import { authRouter } from "./routes/authRoutes";
import { workerRouter } from "./routes/workerRoutes";
import { businessRouter } from "./routes/businessRoutes";
import { reviewRouter } from "./routes/reviewRoutes";
import { activityRouter } from "./routes/activityRoutes";
import { couponRouter } from "./routes/couponRoutes";
import { qrRouter } from "./routes/qrRoutes";
import { adminRouter } from "./routes/adminRoutes";
import { passwordResetRouter } from "./routes/passwordReset";
import { stripeRouter } from "./routes/stripeRoutes";
import { JWT_SECRET, resolveFromEmail } from "./lib/secrets";

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
  const expectedHmac = crypto.createHmac("sha256", OTP_SECRET).update(data).digest("hex");

  if (hmac.length !== expectedHmac.length) return false;
  try {
    const buf1 = Buffer.from(hmac, "hex");
    const buf2 = Buffer.from(expectedHmac, "hex");
    if (buf1.length !== buf2.length) return false;
    return crypto.timingSafeEqual(buf1, buf2);
  } catch {
    return false;
  }
}

// In-memory verification code store fallback (email -> { code, expiresAt })
const verificationStore = new Map<string, { code: string; expiresAt: number }>();

const app = express();
app.set("trust proxy", 1);
app.use(requestLogger);
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "50mb", verify: (req: any, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting (applied on every deployment target, incl. Vercel)
app.use("/api/", globalRateLimiter);
app.use("/api/auth", strictActionLimiter);

// Ensure JSON body is parsed for Vercel Serverless compatibility
app.use((req, res, next) => {
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {}
  }
  next();
});

// Cache control headers (allow brief caching for read-heavy public catalog routes to avoid bandwidth spikes)
app.use((req, res, next) => {
  if (req.method === "GET" && (req.path === "/api/businesses" || req.path === "/api/workers" || req.path === "/api/activity")) {
    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
  } else {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// 1. Healthcheck Endpoint
const healthHandler = async (req: any, res: any) => {
  const dbHealth = await checkDatabaseConnection();
  const payload = {
    status: dbHealth.connected ? "ok" : "degraded",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
    databaseConnected: dbHealth.connected,
    databaseProvider: dbHealth.provider,
    latencyMs: dbHealth.latencyMs,
    ...(dbHealth.error ? { databaseError: dbHealth.error } : {}),
  };
  if (!dbHealth.connected) {
    reportHealthIssue({
      status: payload.status,
      databaseConnected: dbHealth.connected,
      databaseProvider: dbHealth.provider,
      databaseError: dbHealth.error,
      latencyMs: dbHealth.latencyMs,
    });
  }
  res.json(payload);
};
app.get("/api/health", healthHandler);
app.get("/health", healthHandler);

// 2. Email Verification OTP Endpoints (Stateless HMAC)
const sendVerificationHandler = async (req: any, res: any) => {
  const { email, mode } = req.body || {};
  if (!email || !email.trim()) return res.status(400).json({ error: "Email is required." });

  const cleanEmail = email.trim().toLowerCase();

  if (mode === "signup") {
    try {
      const existingUser = await findUserByEmail(cleanEmail);
      if (existingUser) {
        return res.status(400).json({
          error: `An account with email "${cleanEmail}" already exists. Please click "Sign In" tab to log into your account.`
        });
      }
    } catch (e) {}
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  verificationStore.set(cleanEmail, { code, expiresAt });
  const verificationToken = generateOtpToken(cleanEmail, code, expiresAt);

  let emailSent = false;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = resolveFromEmail("FeeTrust Security");

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject: `${code} is your FeeTrust Verification Code`,
          html: `
            <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; background: #030708; color: #ffffff; padding: 40px 32px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
              <div style="text-align: center; margin-bottom: 28px;">
                <h1 style="font-size: 28px; font-weight: 900; background: linear-gradient(135deg, #00e5ff 0%, #3b82f6 50%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">FeeTrust</h1>
                <p style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Merit Rating & Workforce Reputation</p>
              </div>
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 32px 24px; text-align: center;">
                <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Verify Your Email Address</h2>
                <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Use the 6-digit confirmation code below to complete your registration:</p>
                <div style="background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%); border: 2px solid #6366f1; border-radius: 16px; padding: 20px; text-align: center; margin: 0 auto 24px auto; max-width: 320px;">
                  <span style="font-family: Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.4);">${code}</span>
                </div>
                <p style="color: #64748b; font-size: 12px; margin: 0;">⏰ Code expires in <strong>10 minutes</strong>. Do not share this PIN with anyone.</p>
              </div>
              <div style="text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #64748b;">
                <p style="margin: 0 0 4px 0;">Official security email sent to <strong>${cleanEmail}</strong></p>
                <p style="margin: 0;">© 2026 FeeTrust Network • <a href="https://feetrust.com" style="color: #00e5ff; text-decoration: none;">feetrust.com</a></p>
              </div>
            </div>
          `,
        }),
      });
      if (response.ok) {
        emailSent = true;
      } else {
        const errRes = await response.text();
        console.warn("[RESEND] API rejected dispatch:", response.status, errRes);
      }
    } catch (err: any) {
      console.error("Resend API error:", err);
    }
  }

  const isDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

  return res.status(200).json({
    success: true,
    emailSent,
    emailDeliveryConfigured: Boolean(resendApiKey),
    verificationToken,
    devCode: isDev && !emailSent ? code : undefined,
    message: emailSent
      ? `6-digit verification code sent to ${cleanEmail}.`
      : Boolean(resendApiKey)
      ? `Verification code generated for ${cleanEmail}.`
      : `Email service not configured.`
  });
};

const verifyCodeHandler = async (req: any, res: any) => {
  const { email, code, token } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Email and PIN code are required." });

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  // 1. Primary: Stateless cryptographic HMAC token verification
  if (token && typeof token === "string" && token.includes(".")) {
    const isValid = verifyOtpToken(cleanEmail, cleanCode, token);
    if (isValid) {
      verificationStore.delete(cleanEmail);
      return res.status(200).json({ success: true, verified: true });
    } else {
      const [expiresStr] = token.split(".");
      const expires = Number(expiresStr);
      if (expires && Date.now() > expires) {
        return res.status(400).json({ error: "Verification code expired. Please click 'Resend code'." });
      }
      return res.status(400).json({ error: "Incorrect 6-digit confirmation PIN. Please check your email inbox and try again." });
    }
  }

  // 2. Secondary fallback: In-memory store
  const record = verificationStore.get(cleanEmail);
  if (record) {
    if (Date.now() > record.expiresAt) {
      verificationStore.delete(cleanEmail);
      return res.status(400).json({ error: "Verification code expired. Please resend." });
    }
    if (record.code !== cleanCode) {
      return res.status(400).json({ error: "Incorrect 6-digit verification PIN." });
    }
    verificationStore.delete(cleanEmail);
    return res.status(200).json({ success: true, verified: true });
  }

  return res.status(400).json({ error: "No verification code found. Please click 'Resend code'." });
};

// Mount OTP routes
app.post("/api/auth/send-verification-code", sendVerificationHandler);
app.post("/auth/send-verification-code", sendVerificationHandler);
app.post("/send-verification-code", sendVerificationHandler);

app.post("/api/auth/verify-code", verifyCodeHandler);
app.post("/auth/verify-code", verifyCodeHandler);
app.post("/verify-code", verifyCodeHandler);

// 2b. Password Reset
app.use("/api/auth", passwordResetRouter);
app.use("/auth", passwordResetRouter);

// 3. Mount Domain Routers (both with and without /api prefix)
app.use("/api/auth", authRouter);
app.use("/auth", authRouter);

app.use("/api/workers", workerRouter);
app.use("/workers", workerRouter);

app.use("/api/businesses", businessRouter);
app.use("/businesses", businessRouter);

app.use("/api/reviews", reviewRouter);
app.use("/reviews", reviewRouter);

app.use("/api/activity", activityRouter);
app.use("/activity", activityRouter);

app.use("/api/coupons", couponRouter);
app.use("/coupons", couponRouter);

app.use("/api/qr", qrRouter);
app.use("/qr", qrRouter);

app.use("/api/admin", adminRouter);
app.use("/admin", adminRouter);

app.use("/api/stripe", stripeRouter);
app.use("/stripe", stripeRouter);

// 4. 404 Fallback
app.use((req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
});

// 5. Global Express Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  const requestId = req?.requestId;
  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled_api_error",
      requestId,
      method: req?.method,
      path: req?.originalUrl || req?.url,
      error: err?.message || String(err),
      stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
    })
  );
  if (res.headersSent) return next(err);
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.status(err?.status || 500).json({
    error: err?.message || "Internal Server Error",
    ...(requestId ? { requestId } : {}),
  });
});

export default function handler(req: any, res: any) {
  return app(req, res);
}
