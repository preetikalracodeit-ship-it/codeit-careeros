import { Router, type Request, type Response } from "express";
import { isDatabaseReady } from "../../lib/db.js";

export const healthRouter = Router();

function liveness(_req: Request, res: Response): void {
  res.status(200).json({ status: "UP" });
}

function readiness(_req: Request, res: Response): void {
  const ready = isDatabaseReady();
  res.status(ready ? 200 : 503).json({ status: ready ? "UP" : "DOWN" });
}

healthRouter.get("/health", liveness);
healthRouter.get("/health/liveness", liveness);
healthRouter.get("/health/readiness", readiness);
healthRouter.get("/actuator/health", liveness);
healthRouter.get("/actuator/health/liveness", liveness);
healthRouter.get("/actuator/health/readiness", readiness);
