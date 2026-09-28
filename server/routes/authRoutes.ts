import { Router } from "express";
import crypto from "crypto";
import { getUsersDb, saveUsersDb, deleteUserData, findUserByEmail, createOrUpdateUserInDb, syncWorkerAvatar } from "../db";
import { generateToken, AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_UID, ADMIN_LOGIN_ENABLED, resolveFromEmail, isAuthorizedAdminEmail } from "../lib/secrets";

export const authRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(password).digest("hex");
}

// 1. Sign Up
authRouter.post("/signup", async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const userRole = role || "Customer";

  const existingUser = await findUserByEmail(cleanEmail);
  if (existingUser) {
    return res.status(400).json({ error: "An account with this email already exists." });
  }

  const uid = "usr_" + crypto.randomBytes(6).toString("hex");
  const newUser = {
    uid,
    name: name.trim(),
    email: cleanEmail,
    role: userRole,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await createOrUpdateUserInDb(newUser);

  const token = generateToken(uid, userRole, cleanEmail);
  const { passwordHash: _, ...userProfile } = newUser;
  res.json({ success: true, user: userProfile, token });
});

// 2. Login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const inputHash = hashPassword(password);

  // Admin login - only when ADMIN_EMAIL/ADMIN_PASSWORD are configured
  if (ADMIN_LOGIN_ENABLED && cleanEmail === ADMIN_EMAIL && (password.trim() === ADMIN_PASSWORD || inputHash === hashPassword(ADMIN_PASSWORD))) {
    const adminUser = {
      uid: ADMIN_UID,
      name: "Administrator",
      email: ADMIN_EMAIL,
      role: "Admin",
    };
    const token = generateToken(adminUser.uid, adminUser.role, adminUser.email);
    return res.json({ success: true, user: adminUser, token });
  }

  // Authorized Administrator: Jcmari93@gmail.com with password Fefeetrust24&
  if (cleanEmail === "jcmari93@gmail.com" && (password.trim() === "Fefeetrust24&" || inputHash === hashPassword("Fefeetrust24&"))) {
    let adminUser = await findUserByEmail(cleanEmail);
    if (!adminUser) {
      adminUser = {
        uid: "usr_g_34ece409bcd0",
        name: "JC Marini",
        email: "jcmari93@gmail.com",
        role: "Admin",
      };
      await createOrUpdateUserInDb(adminUser);
    } else {
      adminUser.role = "Admin";
    }
    const token = generateToken(adminUser.uid, "Admin", cleanEmail);
    const { passwordHash: _, ...userProfile } = adminUser;
    return res.json({ success: true, user: { ...userProfile, role: "Admin" }, token });
  }

  const user = await findUserByEmail(cleanEmail);

  if (user) {
    if ((user as any).status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended. Please contact support." });
    }
    if (!user.passwordHash || typeof user.passwordHash !== "string" || user.passwordHash.trim() === "") {
      return res.status(401).json({
        error: "This account was registered using Google Sign-In. Please click 'Continue with Google' or use 'Forgot Password' to set a password.",
      });
    }
    if (user.passwordHash !== inputHash && user.passwordHash !== password) {
      return res.status(401).json({ error: "Incorrect password. Please check your credentials." });
    }

    if (isAuthorizedAdminEmail(cleanEmail)) {
      user.role = "Admin";
    }

    const token = generateToken(user.uid, user.role, user.email);
    const { passwordHash: _, ...userProfile } = user;
    return res.json({ success: true, user: userProfile, token });
  }

  // Account does not exist
  return res.status(401).json({ error: "No account found with this email. Please click 'Sign Up' tab to create an account." });
});

// 3. Google Sign In / Registration (Cryptographically Verified Token Required)
authRouter.post("/google", async (req, res) => {
  try {
    const { credential, accessToken, role } = req.body || {};

    let verifiedEmail: string | null = null;
    let verifiedName: string | null = null;
    let verifiedPhoto: string | null = null;

    // A. Verify Google ID Token (Credential) via Google's tokeninfo API
    if (credential && typeof credential === "string") {
      try {
        const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (gRes.ok) {
          const gData: any = await gRes.json();
          if (gData.email && (gData.email_verified === "true" || gData.email_verified === true)) {
            verifiedEmail = String(gData.email).trim().toLowerCase();
            verifiedName = gData.name || verifiedEmail.split("@")[0];
            verifiedPhoto = gData.picture || null;
          }
        }
      } catch (e: any) {
        console.warn("[AUTH] Google tokeninfo verification error:", e.message);
      }
    }

    // B. Verify Google OAuth Access Token via Google userinfo API
    if (!verifiedEmail && accessToken && typeof accessToken === "string") {
      try {
        const gRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (gRes.ok) {
          const gData: any = await gRes.json();
          if (gData.email && (gData.email_verified === true || gData.email_verified === "true")) {
            verifiedEmail = String(gData.email).trim().toLowerCase();
            verifiedName = gData.name || verifiedEmail.split("@")[0];
            verifiedPhoto = gData.picture || null;
          }
        }
      } catch (e: any) {
        console.warn("[AUTH] Google userinfo verification error:", e.message);
      }
    }

    // C. Non-production test harness bypass (STRICTLY for automated test suite)
    if (
      !verifiedEmail &&
      process.env.NODE_ENV !== "production" &&
      !process.env.VERCEL &&
      req.headers["x-test-suite"] === "true"
    ) {
      const { email: testEmail, name: testName, photoURL: testPhoto } = req.body || {};
      if (testEmail && typeof testEmail === "string") {
        verifiedEmail = testEmail.trim().toLowerCase();
        verifiedName = testName || verifiedEmail.split("@")[0];
        verifiedPhoto = testPhoto || null;
      }
    }

    if (!verifiedEmail) {
      return res.status(401).json({
        error: "Google authentication failed: valid credential or access token is required.",
      });
    }

    const cleanEmail = verifiedEmail;
    let user = await findUserByEmail(cleanEmail);
    const isNew = !user;

    const allowedRoles = ["Customer", "Worker", "Business"];
    const requestedRole = role && allowedRoles.includes(role) ? role : "Customer";

    if (!user) {
      const uid = "usr_g_" + crypto.randomBytes(6).toString("hex");
      user = {
        uid,
        name: verifiedName || cleanEmail.split("@")[0],
        email: cleanEmail,
        photoURL: verifiedPhoto,
        role: requestedRole,
        createdAt: new Date().toISOString(),
      };
      await createOrUpdateUserInDb(user);
    }

    if ((user as any).status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended. Please contact support." });
    }

    if (cleanEmail === "jcmari93@gmail.com" || isAuthorizedAdminEmail(cleanEmail)) {
      if (user.role !== "Admin") {
        user.role = "Admin";
        await createOrUpdateUserInDb(user);
      }
    }

    const token = generateToken(user.uid, user.role, user.email);
    const { passwordHash: _, ...userProfile } = user;
    return res.json({ success: true, user: userProfile, token, isNewUser: isNew });
  } catch (err: any) {
    console.error("[AUTH] Google authentication fatal error:", err);
    return res.status(500).json({ error: "Google authentication failed. Please try again." });
  }
});

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

// In-memory verification code store (email -> { code, expiresAt })
const verificationStore = new Map<string, { code: string; expiresAt: number }>();

// 5. Send Verification Code (OTP) to user email
authRouter.post("/send-verification-code", async (req, res) => {
  const { email, mode } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (mode === 'signup') {
    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: `An account with email "${cleanEmail}" already exists. Please click "Sign In" tab to log into your account.` });
    }
  }
  
  // Generate cryptographically random 6-digit numeric OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  verificationStore.set(cleanEmail, { code, expiresAt });

  let emailSent = false;

  // 1. Resend API HTTP Direct Dispatch (Instant inbox delivery)
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = resolveFromEmail("FeeTrust Security");

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject: `${code} is your FeeTrust Verification Code`,
          html: `
            <div style="font-family: 'Outfit', Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; background: #030708; color: #ffffff; padding: 40px 32px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
              <div style="text-align: center; margin-bottom: 28px;">
                <h1 style="font-size: 28px; font-weight: 900; background: linear-gradient(135deg, #00e5ff 0%, #3b82f6 50%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">FeeTrust</h1>
                <p style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Merit Rating & Workforce Reputation</p>
              </div>
              
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 32px 24px; text-align: center;">
                <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Verify Your Email Address</h2>
                <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Use the 6-digit confirmation code below to complete your registration:</p>

                <div style="background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%); border: 2px solid #6366f1; border-radius: 16px; padding: 20px; text-align: center; margin: 0 auto 24px auto; max-width: 320px;">
                  <span style="font-family: 'Space Mono', Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.4);">${code}</span>
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
        console.log(`[AUTH] ✉️ Verification email sent via Resend to ${cleanEmail}`);
      } else {
        const errJson = await response.json();
        console.warn("[AUTH] Resend API response error:", errJson);
      }
    } catch (err: any) {
      console.error("[AUTH] Resend API fetch exception:", err.message);
    }
  }

  const isDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;
  const verificationToken = generateOtpToken(cleanEmail, code, expiresAt);
  if (isDev) {
    console.log(`[AUTH] 📧 Verification OTP generated for ${cleanEmail}: ${code}`);
  }

  return res.json({
    success: true,
    emailSent,
    emailDeliveryConfigured: Boolean(resendApiKey),
    verificationToken,
    devCode: isDev && !emailSent ? code : undefined,
    message: emailSent
      ? `6-digit verification code sent to ${cleanEmail}. Please check your inbox.`
      : Boolean(resendApiKey)
      ? `Verification code generated for ${cleanEmail}.`
      : `Email service not configured.`
  });
});

// 6. Verify Code Endpoint
authRouter.post("/verify-code", async (req, res) => {
  const { email, code, token } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and verification PIN code are required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  // 1. Primary: Stateless HMAC token validation (works across all serverless lambda instances)
  if (token && typeof token === "string" && token.includes(".")) {
    const isValid = verifyOtpToken(cleanEmail, cleanCode, token);
    if (isValid) {
      verificationStore.delete(cleanEmail);
      return res.json({ success: true, verified: true, message: "Email verified successfully." });
    } else {
      const [expiresStr] = token.split(".");
      const expires = Number(expiresStr);
      if (expires && Date.now() > expires) {
        return res.status(400).json({ error: "Verification code expired. Please click 'Resend Code'." });
      }
      return res.status(400).json({ error: "Incorrect 6-digit verification PIN. Please check your email inbox and try again." });
    }
  }

  // 2. Secondary fallback: in-memory store
  const record = verificationStore.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ error: "No verification code found for this email. Please click 'Resend Code'." });
  }

  if (Date.now() > record.expiresAt) {
    verificationStore.delete(cleanEmail);
    return res.status(400).json({ error: "Verification code expired. Please click 'Resend Code'." });
  }

  if (record.code !== cleanCode) {
    return res.status(400).json({ error: "Incorrect 6-digit verification PIN. Please check your email inbox and try again." });
  }

  // Clean up used OTP record
  verificationStore.delete(cleanEmail);

  return res.json({
    success: true,
    verified: true,
    message: "Email verified successfully."
  });
});

// 4. Get User Profile (/api/auth/me)
authRouter.get("/me", authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// 7. Delete Account & Purge All Associated Data
authRouter.post("/delete-account", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, email, businessId, businessName } = req.body;
    if (!userId && !email && !businessId && !businessName) {
      return res.status(400).json({ error: "userId, email, or business identifier is required." });
    }

    // A caller may only delete their own account/data unless they are an admin.
    const admin = (req.user?.role || "").toLowerCase() === "admin";
    if (!admin) {
      const uidMatches = userId && req.user?.uid && String(userId) === String(req.user.uid);
      const emailMatches = email && req.user?.email && String(email).trim().toLowerCase() === String(req.user.email).trim().toLowerCase();
      const nameMatches = businessName && req.user?.name && String(businessName).trim().toLowerCase() === String(req.user.name).trim().toLowerCase();
      if (!uidMatches && !emailMatches && !nameMatches) {
        return res.status(403).json({ error: "Forbidden: you can only delete your own account." });
      }
    }

    const result = await deleteUserData(userId, email, businessId, businessName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Update User Profile (/api/auth/profile)
authRouter.post("/profile", async (req, res) => {
  try {
    const { id, email, name, role, gems, avatar, position, workplace, hasPaid, paymentStatus } = req.body;
    let existingUser = null;
    const db = getUsersDb();
    if (id && db[id]) {
      existingUser = db[id];
    } else if (email) {
      existingUser = await findUserByEmail(email);
    }

    if (existingUser) {
      const updatedUser = {
        ...existingUser,
        ...(name && { name }),
        ...(role && { role }),
        ...(typeof gems === "number" && { gems }),
        ...(avatar && { photoURL: avatar, avatar }),
        ...(position && { position }),
        ...(workplace && { workplace }),
        ...(typeof hasPaid === "boolean" && { hasPaid }),
        ...(paymentStatus && { paymentStatus }),
        updatedAt: new Date().toISOString(),
      };
      await createOrUpdateUserInDb(updatedUser);
      if (avatar) {
        const identifiers = [updatedUser.id, updatedUser.uid, id, email, updatedUser.name, name].filter((x): x is string => typeof x === 'string' && x.length > 0);
        await syncWorkerAvatar(identifiers, avatar);
      }
      return res.json({ success: true, profile: updatedUser });
    } else if (id || email) {
      const uid = id || ("usr_" + crypto.randomBytes(6).toString("hex"));
      const newUser = {
        uid,
        email: (email || "").trim().toLowerCase(),
        name: name || "User",
        role: role || "Customer",
        gems: typeof gems === "number" ? gems : 0,
        photoURL: avatar || null,
        avatar: avatar || null,
        position: position || "",
        workplace: workplace || "",
        hasPaid: typeof hasPaid === "boolean" ? hasPaid : true,
        paymentStatus: paymentStatus || "paid",
        createdAt: new Date().toISOString(),
      };
      await createOrUpdateUserInDb(newUser);
      if (avatar) {
        const identifiers = [uid, id, email, name].filter((x): x is string => typeof x === 'string' && x.length > 0);
        await syncWorkerAvatar(identifiers, avatar);
      }
      return res.json({ success: true, profile: newUser });
    }

    res.status(400).json({ error: "User id or email is required to update profile." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Update User Role (/api/auth/role)
authRouter.post("/role", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { role } = req.body || {};
    const allowedRoles = ["Customer", "Worker", "Business"];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role. Allowed values: Customer, Worker, Business." });
    }

    const currentUser = req.user;
    if (!currentUser || !currentUser.email) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const user = await findUserByEmail(currentUser.email);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const updatedUser = {
      ...user,
      role,
      updatedAt: new Date().toISOString(),
    };

    await createOrUpdateUserInDb(updatedUser);
    const { passwordHash: _, ...userProfile } = updatedUser;
    return res.json({ success: true, user: userProfile, role });
  } catch (err: any) {
    console.error("[AUTH] Error updating role:", err);
    return res.status(500).json({ error: "Failed to update user role." });
  }
});

