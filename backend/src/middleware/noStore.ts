import type { NextFunction, Request, Response } from "express";

export function noStore(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/v1/auth/")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
  }
  next();
}
