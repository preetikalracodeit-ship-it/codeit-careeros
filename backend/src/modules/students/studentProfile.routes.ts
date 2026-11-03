import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { AppError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import { validate } from "../../lib/validators.js";
import { requireRole } from "../../middleware/auth.js";
import { MAX_PROFILE_PHOTO_BYTES, deleteCurrentProfilePhoto, downloadCurrentProfilePhoto, uploadCurrentProfilePhoto } from "./profilePhoto.service.js";
import {
  getCurrentStudentProfile,
  updateCurrentStudentProfile,
} from "./studentProfile.service.js";
import { studentProfileUpdateSchema } from "./studentProfile.schemas.js";

export const studentProfileRouter = Router();
studentProfileRouter.use(requireRole("STUDENT"));
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: 1, fields: 0, parts: 1 },
}).single("file");

function parsePhotoUpload(req: Request, res: Response, next: NextFunction) {
  photoUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(AppError.badRequest("Photo must be at most 2 MB"));
    }
    if (error instanceof MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
      return next(AppError.badRequest("Upload one photo using the file field"));
    }
    return next(error);
  });
}

studentProfileRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getCurrentStudentProfile(req.user!.id));
  } catch (error) {
    next(error);
  }
});

studentProfileRouter.put("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(studentProfileUpdateSchema, req.body);
    const data = await updateCurrentStudentProfile(req.user!.id, input);
    sendSuccess(res, data, { message: "Profile updated" });
  } catch (error) {
    next(error);
  }
});

studentProfileRouter.post("/me/photo", parsePhotoUpload, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await uploadCurrentProfilePhoto(req.user!.id, req.user!.email, req.file);
    sendSuccess(res, data, { message: "Profile photo uploaded" });
  } catch (error) {
    next(error);
  }
});

studentProfileRouter.get("/me/photo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await downloadCurrentProfilePhoto(req.user!.id);
    res.status(200);
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Content-Length", photo.bytes.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(photo.bytes);
  } catch (error) {
    next(error);
  }
});

studentProfileRouter.delete("/me/photo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await deleteCurrentProfilePhoto(req.user!.id, req.user!.email);
    sendSuccess(res, data, { message: "Profile photo removed" });
  } catch (error) {
    next(error);
  }
});
