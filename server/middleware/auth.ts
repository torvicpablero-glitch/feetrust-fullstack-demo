import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getUsersDb, findUserById } from "../db";
import { JWT_SECRET, ADMIN_UID, ADMIN_EMAIL, isAuthorizedAdminEmail } from "../lib/secrets";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

export function generateToken(uid: string, role?: string, email?: string): string {
  const payloadObj: Record<string, any> = { uid, ts: Date.now() };
  if (role) payloadObj.role = role;
  if (email) payloadObj.email = email;
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return `ft_${payload}.${signature}`;
}

export function verifyToken(token: string): { uid: string; role?: string; email?: string } | null {
  try {
    if (!token.startsWith("ft_")) return null;
    const raw = token.replace("ft_", "");
    const parts = raw.split(".");
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
      // 30 days token expiry
      if (decoded.ts && Date.now() - decoded.ts > 30 * 24 * 60 * 60 * 1000) {
        return null;
      }
      return decoded;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const verified = verifyToken(token);

  if (!verified) {
    // No demo/synthetic-token fallback: only cryptographically signed tokens are accepted.
    return res.status(401).json({ error: "Invalid or expired authorization token" });
  }

  const usersDb = getUsersDb();
  let dbUser = usersDb[verified.uid];
  if (!dbUser) {
    try {
      dbUser = await findUserById(verified.uid);
    } catch {
      // fallback to memory
    }
  }

  const userEmail = (verified.email || dbUser?.email || "").toLowerCase();
  const isAdminUser =
    verified.role === "Admin" ||
    dbUser?.role === "Admin" ||
    isAuthorizedAdminEmail(userEmail) ||
    (ADMIN_EMAIL ? (verified.uid === ADMIN_UID || userEmail === ADMIN_EMAIL) : (verified.uid === ADMIN_UID));

  if (isAdminUser) {
    req.user = {
      uid: verified.uid,
      email: userEmail || ADMIN_EMAIL,
      name: dbUser?.name || "Administrator",
      role: "Admin",
    };
    return next();
  }

  const user = dbUser || { uid: verified.uid, name: "User", role: verified.role || "Customer" };

  req.user = {
    uid: user.uid || verified.uid,
    email: user.email || verified.email,
    name: user.name,
    role: user.role,
  };

  next();
}

/**
 * Like authenticateToken but never rejects: attaches req.user when a valid
 * bearer token is present, otherwise continues as an anonymous request.
 * Used on endpoints that must stay usable during onboarding.
 */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const token = authHeader.replace("Bearer ", "").trim();
  const verified = verifyToken(token);
  if (!verified) return next();

  const usersDb = getUsersDb();
  let user = usersDb[verified.uid];
  if (!user) {
    try {
      user = await findUserById(verified.uid);
    } catch {
      // fallback to memory
    }
  }

  const userEmail = (verified.email || user?.email || "").toLowerCase();
  const isAdmin =
    verified.role === "Admin" ||
    user?.role === "Admin" ||
    isAuthorizedAdminEmail(userEmail) ||
    (ADMIN_EMAIL ? (verified.uid === ADMIN_UID || userEmail === ADMIN_EMAIL) : (verified.uid === ADMIN_UID));

  if (isAdmin) {
    req.user = {
      uid: verified.uid,
      email: userEmail || ADMIN_EMAIL,
      name: user?.name || "Administrator",
      role: "Admin",
    };
    return next();
  }

  if (user) {
    req.user = {
      uid: user.uid || verified.uid,
      email: user.email || verified.email,
      name: user.name,
      role: user.role,
    };
  } else {
    req.user = { uid: verified.uid, name: "User", role: verified.role || "Customer" };
  }
  next();
}

