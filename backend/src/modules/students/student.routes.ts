import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { sendSuccess } from "../../lib/response.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../lib/validators.js";
import { assessmentHistoryQuerySchema, updateStudentProfileSchema } from "./student.schemas.js";
import { getStudentProfile, updateStudentProfile } from "./student.service.js";
import { getAttemptHistory } from "./attempt-history.service.js";
import { targetCareerSchema } from "../careers/career.schemas.js";
import { setTargetCareer } from "../careers/career.service.js";
import { getStudentReadiness } from "./readiness.service.js";
import { downloadStudentPhoto, removeStudentPhoto, uploadStudentPhoto } from "./student-photo.service.js";
import { AppError } from "../../lib/errors.js";
import { improvementRouter } from "../improvement/improvement.routes.js";
import { placementRouter } from "../placements/placement.routes.js";

export const studentRouter = Router();
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

studentRouter.use(requireAuth, requireRole("STUDENT"));

studentRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getStudentProfile(req.user!.id));
  } catch (error) {
    next(error);
  }
});

studentRouter.put("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(updateStudentProfileSchema, req.body);
    sendSuccess(res, await updateStudentProfile(req.user!.id, input), {
      message: "Profile updated",
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.post("/me/photo", photoUpload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw AppError.badRequest("Please choose a photo to upload");
    sendSuccess(res, await uploadStudentPhoto(req.user!.id, req.file), { message: "Profile photo uploaded" });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/me/photo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await downloadStudentPhoto(req.user!.id);
    if (!photo) {
      res.status(204).end();
      return;
    }
    res.status(200).type(photo.mimeType).set("Content-Length", String(photo.bytes.length)).send(photo.bytes);
  } catch (error) {
    next(error);
  }
});

studentRouter.delete("/me/photo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await removeStudentPhoto(req.user!.id), { message: "Profile photo removed" });
  } catch (error) {
    next(error);
  }
});

studentRouter.put("/me/career", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(targetCareerSchema, req.body);
    sendSuccess(res, await setTargetCareer(req.user!.id, input.careerId), {
      message: "Target career updated",
    });
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/me/attempts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = validate(assessmentHistoryQuerySchema, req.query);
    sendSuccess(res, await getAttemptHistory(req.user!.id, query.assessmentId));
  } catch (error) {
    next(error);
  }
});

studentRouter.get("/me/readiness", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getStudentReadiness(req.user!.id));
  } catch (error) {
    next(error);
  }
});

studentRouter.use(improvementRouter);
studentRouter.use(placementRouter);
