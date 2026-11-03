import { Router, type NextFunction, type Request, type Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { AppError } from "../../lib/errors.js";
import type { OfferStatus } from "../../models/PlacementApplication.js";
import {
  getMyApplications,
  getMyDrives,
  registerForDrive,
  respondToOffer,
  withdrawMyApplication,
} from "./placement.service.js";

export const placementRouter = Router();

function numericId(value: string, label: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw AppError.notFound(`${label} not found`);
  return id;
}

placementRouter.get("/me/placement/drives", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getMyDrives(req.user!.id));
  } catch (error) {
    next(error);
  }
});

placementRouter.post("/me/placement/drives/:id/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await registerForDrive(req.user!.id, numericId(String(req.params.id), "Placement drive")), {
      message: "Registered for the drive",
    });
  } catch (error) {
    next(error);
  }
});

placementRouter.get("/me/placement/applications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getMyApplications(req.user!.id));
  } catch (error) {
    next(error);
  }
});

placementRouter.patch("/me/placement/applications/:id/withdraw", async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await withdrawMyApplication(req.user!.id, numericId(String(req.params.id), "Application")), {
      message: "Application withdrawn",
    });
  } catch (error) {
    next(error);
  }
});

placementRouter.patch("/me/placement/offers/:id/respond", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String(req.query.status ?? "").toUpperCase() as OfferStatus;
    sendSuccess(res, await respondToOffer(req.user!.id, numericId(String(req.params.id), "Offer"), status), {
      message: "Offer response recorded",
    });
  } catch (error) {
    next(error);
  }
});

