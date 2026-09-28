import { Router } from "express";
import { fetchBusinesses, createOrUpdateBusiness, deleteBusiness, removeWorkerFromBusiness, approveWorkerInBusiness, userOwnsBusiness, isAdminRole } from "../db";
import { optionalAuth, authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { resolveFromEmail } from "../lib/secrets";

export const businessRouter = Router();

// GET /api/businesses
businessRouter.get("/", async (req, res) => {
  try {
    const businesses = await fetchBusinesses();
    res.json({ success: true, count: businesses.length, businesses });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/businesses/:id
businessRouter.get("/:id", async (req, res) => {
  try {
    const businesses = await fetchBusinesses();
    const business = businesses.find(b => b.id === req.params.id);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    res.json({ success: true, business });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/businesses
businessRouter.post("/", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const businessData = req.body;
    if (!businessData.name) {
      return res.status(400).json({ error: "Business name is required" });
    }

    // Hijack protection: an existing, claimed store cannot be overwritten by a different owner.
    const targetName = String(businessData.name).trim();
    const existing = (await fetchBusinesses()).find(
      b => b.name && b.name.trim().toLowerCase() === targetName.toLowerCase()
    );
    if (existing) {
      const existingOwner = (existing as any).user_id || (existing as any).userId;
      const requester = req.user?.uid;
      if (existingOwner && requester && existingOwner !== requester && !isAdminRole(req.user?.role)) {
        return res.status(409).json({
          error: "This business is already registered and claimed by another administrator.",
        });
      }
    }

    const saved = await createOrUpdateBusiness({
      ...businessData,
      // Bind ownership to the authenticated requester when provided
      user_id: businessData.user_id || req.user?.uid || (existing as any)?.user_id,
    });
    res.json({ success: true, business: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/businesses/:id
businessRouter.delete("/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isAdminRole(req.user?.role)) {
      const owns = await userOwnsBusiness(req.user?.uid, req.user?.name, String(req.params.id));
      if (!owns) {
        return res.status(403).json({ error: "Forbidden: you can only delete a business you own." });
      }
    }

    const success = await deleteBusiness(String(req.params.id));
    if (!success) {
      return res.status(404).json({ error: "Business not found" });
    }
    res.json({ success: true, message: "Business deleted and staff unassigned" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/businesses/:id/workers/:workerId/approve (owner approves a pending invitee)
businessRouter.post("/:id/workers/:workerId/approve", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const bizId = String(req.params.id);
    if (!isAdminRole(req.user?.role)) {
      const owns = await userOwnsBusiness(req.user?.uid, req.user?.name, bizId);
      if (!owns) {
        return res.status(403).json({ error: "Forbidden: you can only manage your own roster." });
      }
    }
    const ok = await approveWorkerInBusiness(bizId, String(req.params.workerId));
    if (!ok) {
      return res.status(404).json({ error: "Worker not found" });
    }
    res.json({ success: true, message: "Worker approved and added to the active roster." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/businesses/:id/workers/:workerId
businessRouter.delete("/:id/workers/:workerId", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isAdminRole(req.user?.role)) {
      const owns = await userOwnsBusiness(req.user?.uid, req.user?.name, String(req.params.id));
      if (!owns) {
        return res.status(403).json({ error: "Forbidden: you can only manage your own roster." });
      }
    }

    const success = await removeWorkerFromBusiness(String(req.params.id), String(req.params.workerId));
    if (!success) {
      return res.status(404).json({ error: "Establishment or worker not found" });
    }
    res.json({ success: true, message: "Worker removed from business roster" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/businesses/:id/invite (send staff invite email via Resend)
businessRouter.post("/:id/invite", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const bizId = String(req.params.id);
    const { email, recipientName, businessName, inviteUrl, customMessage } = req.body || {};

    // Only the owning workplace (or an admin) may dispatch invites through FeeTrust's mailer.
    if (!isAdminRole(req.user?.role)) {
      const owns = await userOwnsBusiness(req.user?.uid, req.user?.name, bizId);
      if (!owns) {
        return res.status(403).json({ error: "Forbidden: you can only invite staff to a workplace you own." });
      }
    }

    if (!email || !email.trim() || !email.includes("@")) {
      return res.status(400).json({ error: "A valid recipient email address is required." });
    }
    if (!inviteUrl) {
      return res.status(400).json({ error: "An invite link URL is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const businesses = await fetchBusinesses();
    const business = businesses.find(b => b.id === bizId) || { name: businessName || "Your Workplace" };

    const cleanBizName = business.name || businessName || "FeeTrust Establishment";

    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = resolveFromEmail("FeeTrust Team Invites");

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
            subject: `You're invited to join ${cleanBizName} on FeeTrust`,
            html: `
              <div style="font-family: 'Outfit', Arial, Helvetica, sans-serif; max-width: 540px; margin: 0 auto; background: #030708; color: #ffffff; padding: 40px 32px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                <div style="text-align: center; margin-bottom: 28px;">
                  <h1 style="font-size: 28px; font-weight: 900; background: linear-gradient(135deg, #00e5ff 0%, #3b82f6 50%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">FeeTrust</h1>
                  <p style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Service Merit & Workplace Network</p>
                </div>

                <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 32px 24px; text-align: center;">
                  <span style="display: inline-block; font-size: 32px; margin-bottom: 12px;">🎉</span>
                  <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">You've Been Invited!</h2>
                  <p style="color: #94a3b8; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
                    The management at <strong style="color: #ffffff;">${cleanBizName}</strong> has invited you to join their official team on FeeTrust.
                  </p>

                  ${customMessage ? `
                    <div style="background: rgba(99, 102, 241, 0.1); border-left: 3px solid #6366f1; border-radius: 8px; padding: 12px 16px; text-align: left; margin: 0 auto 24px auto; color: #c7d2fe; font-size: 13px; font-style: italic;">
                      "${customMessage}"
                    </div>
                  ` : ''}

                  <p style="color: #cbd5e1; font-size: 13px; margin-bottom: 24px;">
                    Claim your verified merit passport, receive customer commendations, and showcase your professional service standing.
                  </p>

                  <div style="margin: 28px 0 12px 0;">
                    <a href="${inviteUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);">
                      Accept Invitation & Claim Profile →
                    </a>
                  </div>

                  <p style="color: #64748b; font-size: 11px; margin-top: 20px;">
                    Button not working? Copy and paste this link into your browser:<br/>
                    <a href="${inviteUrl}" style="color: #00e5ff; word-break: break-all; font-size: 10px;">${inviteUrl}</a>
                  </p>
                </div>

                <div style="text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #64748b;">
                  <p style="margin: 0 0 4px 0;">This invitation was sent directly to <strong>${cleanEmail}</strong></p>
                  <p style="margin: 0;">© 2026 FeeTrust Network • <a href="https://feetrust.com" style="color: #00e5ff; text-decoration: none;">feetrust.com</a></p>
                </div>
              </div>
            `,
          }),
        });

        if (response.ok) {
          emailSent = true;
        } else {
          const errRes = await response.text();
          console.warn("[INVITE EMAIL] Resend rejected dispatch:", response.status, errRes);
        }
      } catch (err: any) {
        console.error("[INVITE EMAIL] Resend exception:", err.message);
      }
    }

    res.json({
      success: true,
      emailSent,
      emailDeliveryConfigured: Boolean(resendApiKey),
      message: emailSent
        ? `Invitation successfully emailed to ${cleanEmail}!`
        : Boolean(resendApiKey)
        ? `Invite recorded, but email delivery was not acknowledged.`
        : `Invite link generated (email delivery not configured).`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
