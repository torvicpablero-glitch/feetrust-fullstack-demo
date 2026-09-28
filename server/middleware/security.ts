import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z, ZodSchema } from "zod";

// 1. Helmet HTTP Security Header Setup
export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Disabled for dev flexibility with Vite inline styles/scripts
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// 2. Global Rate Limiter (Max 1500 requests per 15 minutes, skips read-only background polling)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Never throttle CORS preflight checks
    if (req.method === "OPTIONS") return true;
    // Skip read-only public polling routes so SPA live sync doesn't burn the quota
    if (req.method === "GET") {
      const path = (req.originalUrl || req.path || "").toLowerCase();
      return (
        path.includes("/health") ||
        path.includes("/businesses") ||
        path.includes("/workers") ||
        path.includes("/activity") ||
        path.includes("/reviews") ||
        path.includes("/qr")
      );
    }
    return false;
  },
  message: { error: "Too many requests from this IP, please try again after 15 minutes." },
});

// 3. Strict Rate Limiter for Auth & Tipping (Max 120 requests per 15 minutes to protect shared NAT IPs)
export const strictActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for sensitive operations. Please slow down." },
});

// 4. Zod Request Body Validation Middleware Generator
export function validateRequestBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = result.error.issues.map(err => `${err.path.join(".")}: ${err.message}`);
      return res.status(400).json({
        error: "Invalid request payload validation failed",
        details: formattedErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

// ==========================================
// ZOD SCHEMAS FOR API ROUTE VALIDATION
// ==========================================

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["Customer", "Worker", "Business"]).optional().default("Customer"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const reviewSchema = z.object({
  fromUserId: z.string().optional().default("usr_guest"),
  fromUserName: z.string().optional().default("Customer"),
  toUserId: z.string().min(1, "toUserId (worker ID) is required"),
  meritType: z.string().min(1, "meritType is required"),
  tipAmount: z.number().min(0, "tipAmount must be 0 or positive").optional().default(0),
  reviewText: z.string().optional().default(""),
});

export const thankYouSchema = z.object({
  fromWorkerName: z.string().optional().default("Team Member"),
  toUserName: z.string().optional().default("Customer"),
  message: z.string().min(1, "Message text is required"),
});

export const couponClaimSchema = z.object({
  userId: z.string().optional().default("usr_guest"),
  couponId: z.string().min(1, "couponId is required"),
  code: z.string().min(1, "Promo code is required"),
  gemsAwarded: z.number().min(0).optional().default(0),
});

export const qrVerifySchema = z.object({
  qrData: z.string().min(1, "qrData is required"),
});
