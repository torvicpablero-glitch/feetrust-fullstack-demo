import { Router } from "express";
import { fetchWorkers, fetchWorkerById, updateWorkerAvailability, createOrUpdateWorker, deleteWorker, userOwnsWorker, isAdminRole } from "../db";
import { authenticateToken, optionalAuth, AuthenticatedRequest } from "../middleware/auth";

export const workerRouter = Router();

// GET /api/workers
workerRouter.get("/", async (req, res) => {
  try {
    const { category, workplace } = req.query;
    let workers = await fetchWorkers();

    if (category && typeof category === "string") {
      workers = workers.filter(w => w.category.toLowerCase() === category.toLowerCase());
    }
    if (workplace && typeof workplace === "string") {
      workers = workers.filter(w => w.workplace.toLowerCase() === workplace.toLowerCase());
    }

    res.json({ success: true, count: workers.length, workers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workers/:id
workerRouter.get("/:id", async (req, res) => {
  try {
    const worker = await fetchWorkerById(req.params.id);
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }
    res.json({ success: true, worker });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workers (Create / Join Worker Profile)
workerRouter.post("/", optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workerData = req.body;
    if (!workerData || !workerData.name) {
      return res.status(400).json({ error: "Worker name is required" });
    }
    // Bind the worker record to the creating account so ownership checks work
    // (previously a worker profile had no link to its user at all).
    const saved = await createOrUpdateWorker({
      ...workerData,
      user_id: workerData.user_id || req.user?.uid,
    } as any);
    res.json({ success: true, worker: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/workers/:id/availability
workerRouter.patch("/:id/availability", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== "boolean") {
      return res.status(400).json({ error: "isAvailable boolean is required" });
    }

    const workerId = String(req.params.id);

    // Authorization: only the worker themselves (or an admin) may change availability
    if (!isAdminRole(req.user?.role)) {
      const owns = await userOwnsWorker(req.user?.uid, req.user?.name, workerId);
      if (!owns) {
        return res.status(403).json({ error: "Forbidden: you can only change your own availability." });
      }
    }

    const updated = await updateWorkerAvailability(workerId, isAvailable);
    if (!updated) {
      return res.status(404).json({ error: "Worker not found" });
    }

    res.json({ success: true, worker: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/workers/:id
workerRouter.delete("/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const workerId = String(req.params.id);

    // Authorization: only the worker themselves (or an admin) may delete the profile
    if (!isAdminRole(req.user?.role)) {
      const owns = await userOwnsWorker(req.user?.uid, req.user?.name, workerId);
      if (!owns) {
        return res.status(403).json({ error: "Forbidden: you can only delete your own worker profile." });
      }
    }

    const success = await deleteWorker(workerId);
    if (!success) {
      return res.status(404).json({ error: "Worker not found" });
    }
    res.json({ success: true, message: "Worker deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
