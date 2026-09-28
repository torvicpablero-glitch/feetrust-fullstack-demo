import { Router } from "express";
import { fetchWorkers, fetchBusinesses } from "../db";

export const qrRouter = Router();

// POST /api/qr/verify (Scanned QR code verification endpoint)
qrRouter.post("/verify", async (req, res) => {
  try {
    const { qrData } = req.body;
    if (!qrData || typeof qrData !== "string") {
      return res.status(400).json({ error: "qrData string is required" });
    }

    const cleanData = qrData.trim();
    const workers = await fetchWorkers();
    const businesses = await fetchBusinesses();

    // 1. Check if matches worker ID or worker URL
    let matchedWorker = workers.find(w => cleanData.includes(w.id) || cleanData.toLowerCase().includes(w.name.toLowerCase()));
    if (matchedWorker) {
      return res.json({
        success: true,
        type: "worker",
        verified: true,
        entity: matchedWorker,
        message: `Verified worker QR code for ${matchedWorker.name} at ${matchedWorker.workplace}`,
      });
    }

    // 2. Check if matches business ID or business URL
    let matchedBusiness = businesses.find(b => cleanData.includes(b.id) || cleanData.toLowerCase().includes(b.name.toLowerCase()));
    if (matchedBusiness) {
      return res.json({
        success: true,
        type: "business",
        verified: true,
        entity: matchedBusiness,
        message: `Verified business QR code for ${matchedBusiness.name}`,
      });
    }

    res.status(404).json({
      success: false,
      verified: false,
      error: "Unrecognized QR code payload. Entity not found in FeeTrust network.",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/qr/generate (Generate official FeeTrust QR code)
qrRouter.post("/generate", async (req, res) => {
  try {
    const { targetType, targetId } = req.body;
    if (!targetType || !targetId) {
      return res.status(400).json({ error: "targetType ('worker'|'business') and targetId are required" });
    }

    const appBaseUrl = process.env.VITE_APP_URL || "https://www.feetrust.com";
    const qrTargetUrl = `${appBaseUrl}/${targetType}/${targetId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrTargetUrl)}`;

    res.json({
      success: true,
      targetType,
      targetId,
      qrTargetUrl,
      qrCodeUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
