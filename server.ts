import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

import { authRouter } from "./server/routes/authRoutes";
import { workerRouter } from "./server/routes/workerRoutes";
import { businessRouter } from "./server/routes/businessRoutes";
import { reviewRouter } from "./server/routes/reviewRoutes";
import { activityRouter } from "./server/routes/activityRoutes";
import { couponRouter } from "./server/routes/couponRoutes";
import { qrRouter } from "./server/routes/qrRoutes";
import { adminRouter } from "./server/routes/adminRoutes";
import { passwordResetRouter } from "./server/routes/passwordReset";
import { stripeRouter } from "./server/routes/stripeRoutes";
import { checkDatabaseConnection } from "./server/db";
import { securityHeaders, globalRateLimiter, strictActionLimiter } from "./server/middleware/security";
import { requestLogger } from "./server/middleware/observability";

export const app = express();
app.set("trust proxy", 1);
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security & CORS Middleware
app.use(requestLogger);
app.use(securityHeaders);
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.use(express.json({ limit: "50mb", verify: (req: any, res, buf) => { req.rawBody = buf; } }));

// Apply Rate Limiting in Production / Vercel
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  app.use("/api/", globalRateLimiter);
  app.use("/api/auth", strictActionLimiter);
}

// Initialize Gemini AI Client safely
let aiInstance: any = null;
function getAiClient() {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "AIzaSyDummyKeyForInitializationOnly",
    });
  }
  return aiInstance;
}

// ==========================================
// REST API ROUTER MODULES
// ==========================================

// 1. Healthcheck Endpoint
app.get("/api/health", async (req, res) => {
  const dbHealth = await checkDatabaseConnection();
  res.json({
    status: dbHealth.connected ? "ok" : "degraded",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    databaseConnected: dbHealth.connected,
    databaseProvider: dbHealth.provider,
    latencyMs: dbHealth.latencyMs,
    ...(dbHealth.error ? { databaseError: dbHealth.error } : {}),
  });
});

// 2. Core Domain Routers
app.use("/api/auth", passwordResetRouter);
app.use("/api/auth", authRouter);
app.use("/api/workers", workerRouter);
app.use("/api/businesses", businessRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/activity", activityRouter);
app.use("/api/coupons", couponRouter);
app.use("/api/qr", qrRouter);
app.use("/api/admin", adminRouter);
app.use("/api/stripe", stripeRouter);

// 3. Gemini Google Maps Grounding API
app.post("/api/gemini/nearby", async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await getAiClient().models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { includeServerSideToolInvocations: true },
      }
    });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Workspace Gmail & Contacts Integration APIs
app.get("/api/gmail/messages", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10", {
      headers: { Authorization: token },
    });
    res.json(await response.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/contacts", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await fetch("https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos", {
      headers: { Authorization: token },
    });
    res.json(await response.json());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Global Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled server error:", err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || "An unexpected server error occurred.",
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception caught by safety wrapper:", error);
});

// Start Server for standalone execution
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const fs = await import("fs");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

const isMainModule = 
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  (Boolean(process.argv && process.argv[1]) && (
    (process.argv[1] || "").replace(/\\/g, "/").endsWith("server.ts") ||
    (process.argv[1] || "").replace(/\\/g, "/").endsWith("server.cjs") ||
    (process.argv[1] || "").replace(/\\/g, "/").endsWith("server.js")
  ));

if (!process.env.VERCEL && isMainModule) {
  startServer();
}
