import type { ErrorCode } from "./errorCodes.js";

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldError[];

  constructor(status: number, code: ErrorCode, message: string, fieldErrors?: FieldError[]) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  static badRequest(message: string): AppError {
    return new AppError(400, "BAD_REQUEST", message);
  }

  static validation(message: string, fieldErrors: FieldError[]): AppError {
    return new AppError(400, "VALIDATION_ERROR", message, fieldErrors);
  }

  static unauthorized(message: string): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message: string): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message: string): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, "CONFLICT", message);
  }

  static gone(message: string): AppError {
    return new AppError(410, "ATTEMPT_EXPIRED", message);
  }

  static payloadTooLarge(message: string): AppError {
    return new AppError(413, "BAD_REQUEST", message);
  }

  static serviceUnavailable(message: string): AppError {
    return new AppError(503, "AI_NOT_CONFIGURED", message);
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError(500, "INTERNAL_ERROR", message);
  }
}
