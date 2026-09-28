import { Router } from "express";
import { fetchActivityFeed } from "../db";

export const activityRouter = Router();

// GET /api/activity
activityRouter.get("/", async (req, res) => {
  try {
    const activityFeed = await fetchActivityFeed();
    res.json({ success: true, count: activityFeed.length, activityFeed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
