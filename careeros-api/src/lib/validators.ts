import type { ZodType } from "zod";
import { AppError, type FieldError } from "./errors.js";

export function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    }));
    const first = fieldErrors[0];
    const message = first
      ? `Validation failed for field '${first.field}'`
      : "Validation failed";
    throw AppError.validation(message, fieldErrors);
  }
  return result.data;
}
