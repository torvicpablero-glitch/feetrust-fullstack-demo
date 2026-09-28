import { Router } from "express";
import { claimCoupon, fetchCouponClaims } from "../db";
import { optionalAuth, AuthenticatedRequest } from "../middleware/auth";

export const couponRouter = Router();

// GET /api/coupons/claims?userId=... (durable claim history)
couponRouter.get("/claims", async (req, res) => {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const claims = await fetchCouponClaims(userId);
    res.json({ success: true, count: claims.length, claims });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/coupons/claim
couponRouter.post("/claim", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, couponId, code, gemsAwarded } = req.body;
    if (!couponId || !code) {
      return res.status(400).json({ error: "couponId and promo code are required" });
    }

    // Bind the claim to the authenticated user when a token is present so gems
    // cannot be credited to an arbitrary account.
    const uid = req.user?.uid || userId || "usr_guest";
    // Negative values are gem *spending* (redeeming a reward voucher); positive are bonuses.
    const raw = Number(gemsAwarded || 0);
    const gems = Math.max(-10000, Math.min(10000, Number.isFinite(raw) ? raw : 0));

    const claim = await claimCoupon(uid, couponId, code, gems);

    res.status(201).json({
      success: true,
      claim,
      gemsAwarded: claim.gemsAwarded,
      message: claim.gemsAwarded < 0
        ? `Reward redeemed — ${Math.abs(claim.gemsAwarded)} gems spent.`
        : `Coupon claimed successfully! +${claim.gemsAwarded} Gems awarded.`,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to process coupon.";
    const status = /insufficient gems/i.test(msg) ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});
