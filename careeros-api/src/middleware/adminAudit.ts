import type { NextFunction, Request, Response } from "express";
import { recordAdminRequest } from "../lib/audit.js";

export function auditAdminRequests(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0] ?? req.path;
    if (!path.startsWith("/api/v1/admin")) {
      return;
    }

    const status = res.statusCode;
    const outcome =
      status >= 200 && status < 400
        ? "SUCCESS"
        : status === 401 || status === 403
          ? "DENIED"
          : "ERROR";

    void recordAdminRequest({
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      action: `${req.method} ${path}`,
      targetPath: path,
      outcome,
      httpStatus: status,
      requestId: req.requestId,
    });
  });

  next();
}
