import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { sendError } from "../lib/response.js";
import { logger } from "../lib/logger.js";

interface HttpishError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
  code?: string;
}

export function notFound(req: Request, res: Response): void {
  sendError(res, 404, "Resource not found", "NOT_FOUND");
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId: req.requestId, path: req.path }, "Request failed");
    } else {
      logger.warn(
        { requestId: req.requestId, path: req.path, status: err.status, code: err.code },
        "Request rejected",
      );
    }
    sendError(res, err.status, err.message, err.code, err.fieldErrors);
    return;
  }

  const httpError = err as HttpishError;
  if (httpError?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    sendError(res, 400, "Malformed request", "BAD_REQUEST");
    return;
  }
  if (httpError?.type === "entity.too.large") {
    sendError(res, 413, "File size exceeds the allowed limit", "BAD_REQUEST");
    return;
  }

  logger.error({ err, requestId: req.requestId, path: req.path }, "Unhandled exception");
  sendError(res, 500, "An unexpected error occurred", "INTERNAL_ERROR");
}
