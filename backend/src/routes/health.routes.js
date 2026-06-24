import { Router } from "express";

const router = Router();

router.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ ok: true, uptimeSec: Math.round(process.uptime()) });
});

export default router;
