import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { errorBody } from "../lib/response.js";

export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.AUTH_RATE_LIMIT_PER_MINUTE,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req.ip ? ipKeyGenerator(req.ip) : "unknown"),
  handler: (_req: Request, res: Response) => {
    res
      .status(429)
      .json(
        errorBody(
          "Too many attempts. Please wait a minute and try again.",
          "RATE_LIMITED",
        ),
      );
  },
});
