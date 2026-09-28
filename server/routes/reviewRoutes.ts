import { Router } from "express";
import { fetchReviews, createReview, fetchThankYouNotes, createThankYouNote, fetchWorkerById } from "../db";
import { optionalAuth, AuthenticatedRequest } from "../middleware/auth";

export const reviewRouter = Router();

// --- Merit anti-abuse -------------------------------------------------------
const ALLOWED_MERIT_TYPES = ["good", "verygood", "very good", "excellent", "superstar", "super star", "legend"];
const MERIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MERIT_MAX_PER_WINDOW = 30;        // max merits a single actor may give per hour
const meritRateMap = new Map<string, number[]>();

function meritRateOk(actorKey: string): boolean {
  const now = Date.now();
  const recent = (meritRateMap.get(actorKey) || []).filter(ts => now - ts < MERIT_WINDOW_MS);
  if (recent.length >= MERIT_MAX_PER_WINDOW) {
    meritRateMap.set(actorKey, recent);
    return false;
  }
  recent.push(now);
  meritRateMap.set(actorKey, recent);
  return true;
}

// GET /api/reviews
reviewRouter.get("/", async (req, res) => {
  try {
    const reviews = await fetchReviews();
    res.json({ success: true, count: reviews.length, reviews });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reviews (Submit merit & tip)
reviewRouter.post("/", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, fromUserId, fromUserName, toUserId, meritType, tipAmount, reviewText } = req.body;

    if (!toUserId || !meritType) {
      return res.status(400).json({ error: "Target worker (toUserId) and meritType are required" });
    }

    // 1. Validate merit type
    const normalizedMerit = String(meritType).trim().toLowerCase();
    if (!ALLOWED_MERIT_TYPES.includes(normalizedMerit)) {
      return res.status(400).json({ error: "Invalid merit type." });
    }

    // 2. Prevent self-merit (a user awarding merit to their own worker profile)
    const targetWorker = await fetchWorkerById(String(toUserId));
    if (!targetWorker) {
      return res.status(404).json({ error: "Target worker not found." });
    }
    const requesterUid = req.user?.uid || fromUserId;
    const requesterName = req.user?.name || fromUserName;
    const isSelf =
      (requesterUid && targetWorker.id === requesterUid) ||
      (requesterName && targetWorker.name &&
        targetWorker.name.trim().toLowerCase() === String(requesterName).trim().toLowerCase());
    if (isSelf) {
      return res.status(400).json({ error: "You cannot award a merit to yourself." });
    }

    // 3. Rate limit merit awards per actor
    const actorKey = requesterUid || req.ip || "anonymous";
    if (!meritRateOk(String(actorKey))) {
      return res.status(429).json({ error: "Too many merits awarded. Please try again later." });
    }

    const result = await createReview({
      id: id || undefined,
      fromUserId: fromUserId || "usr_guest",
      fromUserName: fromUserName || "Customer",
      toUserId,
      meritType,
      tipAmount: Math.max(0, Math.min(1000, Number(tipAmount) || 0)),
      reviewText: reviewText || "",
    });

    res.status(201).json({
      success: true,
      review: result.review,
      activity: result.activity,
      message: "Merit and tip submitted successfully!",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reviews/notes (Thank you notes)
reviewRouter.get("/notes", async (req, res) => {
  try {
    const notes = await fetchThankYouNotes();
    res.json({ success: true, count: notes.length, thankYouNotes: notes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reviews/:id/thank-you
reviewRouter.post("/:id/thank-you", async (req, res) => {
  try {
    const reviewId = req.params.id;
    const { id, fromWorkerName, toUserName, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Thank-you note message is required" });
    }

    const note = await createThankYouNote(
      reviewId,
      fromWorkerName || "Team Member",
      toUserName || "Customer",
      message,
      id || undefined
    );

    res.status(201).json({ success: true, thankYouNote: note });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
