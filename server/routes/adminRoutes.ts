import { Router } from "express";
import {
  fetchAllUsers,
  setUserStatus,
  setBusinessStatus,
  setBusinessVerified,
  deleteReviewById,
  isAdminRole,
} from "../db";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

export const adminRouter = Router();

// Every route in this router requires an authenticated admin.
adminRouter.use(authenticateToken, (req: AuthenticatedRequest, res, next) => {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden: administrator access required." });
  }
  next();
});

const VALID_STATUS = ["active", "suspended"];

// GET /api/admin/users — list accounts for the moderation console
adminRouter.get("/users", async (_req, res) => {
  try {
    const users = await fetchAllUsers();
    res.json({ success: true, count: users.length, users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/users/:id/status  { status: "active" | "suspended" }
adminRouter.patch("/users/:id/status", async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUS.join(", ")}` });
    }
    const uid = String(req.params.id);
    // Guard: an admin must not suspend themselves
    if (uid === req.user?.uid) {
      return res.status(400).json({ error: "You cannot change your own account status." });
    }
    await setUserStatus(uid, status);
    res.json({ success: true, message: `User ${uid} is now ${status}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/businesses/:id/status  { status: "active" | "suspended" }
adminRouter.patch("/businesses/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUS.join(", ")}` });
    }
    await setBusinessStatus(String(req.params.id), status);
    res.json({ success: true, message: `Business ${req.params.id} is now ${status}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/businesses/:id/verify  { verified: boolean }
adminRouter.patch("/businesses/:id/verify", async (req, res) => {
  try {
    const { verified } = req.body || {};
    if (typeof verified !== "boolean") {
      return res.status(400).json({ error: "verified boolean is required" });
    }
    await setBusinessVerified(String(req.params.id), verified);
    res.json({ success: true, message: `Business ${req.params.id} verified=${verified}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/reviews/:id — remove an abusive merit/review
adminRouter.delete("/reviews/:id", async (req, res) => {
  try {
    const ok = await deleteReviewById(String(req.params.id));
    if (!ok) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json({ success: true, message: "Review and its activity entry removed." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
