import type { Response } from "express";
import type { ErrorCode } from "./errorCodes.js";
import type { FieldError } from "./errors.js";

export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface ErrorBody {
  success: false;
  message: string;
  errorCode: ErrorCode;
  timestamp: string;
  fieldErrors?: FieldError[];
}

export function successBody<T>(data: T, message = "Success"): SuccessBody<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorBody(
  message: string,
  errorCode: ErrorCode,
  fieldErrors?: FieldError[],
): ErrorBody {
  return {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { message?: string; status?: number } = {},
): void {
  res.status(options.status ?? 200).json(successBody(data, options.message ?? "Success"));
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  errorCode: ErrorCode,
  fieldErrors?: FieldError[],
): void {
  res.status(status).json(errorBody(message, errorCode, fieldErrors));
}
