import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.isTest ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "currentPassword",
      "newPassword",
      "passwordHash",
      "refreshToken",
      "idToken",
      "token",
    ],
    censor: "[REDACTED]",
  },
});
