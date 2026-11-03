import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  assessmentReport,
  gapReport,
  generateReportPdf,
  listReports,
  overallReport,
  readinessReport,
  reportFilename,
  roadmapReport,
} from "./report.service.js";

export const reportRouter = Router();
reportRouter.use(requireAuth, requireRole("STUDENT"));

reportRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await listReports(req.user!.id));
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/readiness", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await readinessReport(req.user!.id));
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/assessment", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await assessmentReport(req.user!.id));
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/gap-analysis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await gapReport(req.user!.id));
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/roadmap", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await roadmapReport(req.user!.id));
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/overall", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await overallReport(req.user!.id));
  } catch (error) {
    next(error);
  }
});

reportRouter.get("/:type/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = String(req.params.type);
    const pdf = await generateReportPdf(req.user!.id, type);
    res.status(200)
      .type("application/pdf")
      .set("Content-Disposition", `attachment; filename="${reportFilename(type)}"`)
      .set("Content-Length", String(pdf.length))
      .send(pdf);
  } catch (error) {
    next(error);
  }
});

