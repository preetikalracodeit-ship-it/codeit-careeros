import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { sendSuccess } from "../../lib/response.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { analyzeCv, downloadMyCv, getMyCv, uploadCv } from "./cv.service.js";

export const cvRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

cvRouter.use(requireAuth, requireRole("STUDENT"));

cvRouter.post("/", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await uploadCv(req.user!.id, req.file), { message: "CV uploaded", status: 201 });
  } catch (error) {
    next(error);
  }
});

cvRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getMyCv(req.user!.id));
  } catch (error) {
    next(error);
  }
});

cvRouter.get("/analysis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await analyzeCv(req.user!.id));
  } catch (error) {
    next(error);
  }
});

cvRouter.get("/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await downloadMyCv(req.user!.id);
    res.status(200)
      .type(file.contentType)
      .set("Content-Disposition", `attachment; filename="${file.filename.replace(/["\\]/g, "_")}"`)
      .set("Content-Length", String(file.bytes.length))
      .send(file.bytes);
  } catch (error) {
    next(error);
  }
});
