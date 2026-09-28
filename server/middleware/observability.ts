import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

/**
 * Attaches a request id and emits a single structured log line per request
 * (method, path, status, duration, requestId). Also surfaces slow requests.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = (req.headers["x-request-id"] as string) || "req_" + crypto.randomBytes(8).toString("hex");
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const line = JSON.stringify({
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      msg: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ...(durationMs > 3000 ? { slow: true } : {}),
    });
    if (res.statusCode >= 500) console.error(line);
    else console.log(line);
  });

  next();
}

/**
 * Reports a degraded/failed health probe to an optional alert webhook
 * (ALERT_WEBHOOK_URL). No-op when unset. Never throws, never blocks the request.
 */
export function reportHealthIssue(payload: {
  status: string;
  databaseConnected: boolean;
  databaseProvider?: string;
  databaseError?: string;
  latencyMs?: number;
}) {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  console.log(
    JSON.stringify({ level: payload.databaseConnected ? "info" : "error", msg: "health_probe", ...payload })
  );
  if (!webhook || payload.databaseConnected) return;
  fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `FeeTrust DB degraded: ${payload.databaseError || "unknown"}` }),
  }).catch((err) => console.warn("[ALERT] webhook dispatch failed:", err));
}
