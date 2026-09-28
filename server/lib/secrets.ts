import crypto from "crypto";

/**
 * Central secret resolution.
 *
 * Production MUST provide these via environment variables. We never fall back to
 * a hardcoded value (which would be public in the repository and allow anyone to
 * forge auth tokens or sign in as admin). If a secret is missing we generate a
 * random per-process value and warn loudly, so the app stays safe-by-default
 * (tokens simply invalidate on restart) instead of using a known constant.
 */

function resolveSecret(envName: string): string {
  const value = process.env[envName];
  if (value && value.trim()) return value.trim();
  console.error(
    `[SECURITY] ${envName} is not set. Falling back to a random per-process secret - ` +
    `sessions will not survive restarts. Set ${envName} in your environment.`
  );
  return crypto.randomBytes(32).toString("hex");
}

export const JWT_SECRET = resolveSecret("JWT_SECRET");

/** Admin credentials come from the environment only. When unset, admin login is disabled. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
export const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();
export const ADMIN_UID = "usr_admin_torvic";
export const ADMIN_LOGIN_ENABLED = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

/** List of recognized administrator accounts */
export const AUTHORIZED_ADMIN_EMAILS = [
  "jcmari93@gmail.com",
];

export function isAuthorizedAdminEmail(email?: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (AUTHORIZED_ADMIN_EMAILS.includes(clean)) return true;
  if (ADMIN_EMAIL && clean === ADMIN_EMAIL) return true;
  const additionalAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return additionalAdmins.includes(clean);
}

if (!ADMIN_LOGIN_ENABLED) {
  console.warn("[SECURITY] ADMIN_EMAIL / ADMIN_PASSWORD not configured - admin portal login is disabled.");
}

/**
 * Resend sender identity.
 *
 * `onboarding@resend.dev` is Resend's shared sandbox sender: it can only deliver to
 * the Resend account owner, so relying on it in production silently breaks signup
 * for every real user. Requires a verified sending domain (see Resend -> Domains).
 */
const SANDBOX_SENDER = "onboarding@resend.dev";

export function resolveFromEmail(fallbackName = "FeeTrust"): string {
  const configured = (process.env.RESEND_FROM_EMAIL || "").trim();
  if (configured) {
    if (configured.includes(SANDBOX_SENDER)) {
      console.error(
        "[EMAIL] RESEND_FROM_EMAIL is set to Resend's sandbox sender " +
        `(${SANDBOX_SENDER}). It only delivers to the Resend account owner - real users ` +
        "will not receive codes. Set RESEND_FROM_EMAIL to an address on a verified domain."
      );
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    console.error(
      "[EMAIL] RESEND_FROM_EMAIL is not set. Falling back to Resend's sandbox sender, " +
      "which only delivers to the Resend account owner. Set RESEND_FROM_EMAIL to an " +
      "address on your verified sending domain (e.g. \"FeeTrust Security <no-reply@feetrust.com>\")."
    );
  }
  return `${fallbackName} <${SANDBOX_SENDER}>`;
}

