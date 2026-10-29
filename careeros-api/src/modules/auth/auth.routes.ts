import { Router, type NextFunction, type Request, type Response } from "express";
import { validate } from "../../lib/validators.js";
import { sendSuccess } from "../../lib/response.js";
import { requireAuth } from "../../middleware/auth.js";
import { authRateLimiter } from "../../middleware/rateLimit.js";
import {
  acceptConsent,
  authConfig,
  consentStatus,
  googleLogin,
  login,
  logout,
  me,
  refresh,
  register,
  requestPasswordReset,
  resetPassword,
} from "./auth.service.js";
import {
  consentAcceptSchema,
  googleSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/forgot-password", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(forgotPasswordSchema, req.body);
    sendSuccess(res, await requestPasswordReset(input.email));
  } catch (error) { next(error); }
});

authRouter.post("/reset-password", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validate(resetPasswordSchema, req.body);
    const result = await resetPassword(input.token, input.newPassword);
    sendSuccess(res, null, { message: result.message });
  } catch (error) { next(error); }
});

authRouter.post(
  "/register",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validate(registerSchema, req.body);
      const data = await register(input);
      sendSuccess(res, data, { message: "Registration successful", status: 201 });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/login",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validate(loginSchema, req.body);
      const data = await login(input);
      sendSuccess(res, data, { message: "Login successful" });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/google",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validate(googleSchema, req.body);
      const data = await googleLogin(input);
      sendSuccess(res, data, { message: "Google sign-in successful" });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/refresh",
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validate(refreshSchema, req.body);
      const data = await refresh(input.refreshToken);
      sendSuccess(res, data, { message: "Token refreshed" });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { refreshToken?: string } | undefined;
    await logout(body?.refreshToken);
    sendSuccess(res, null, { message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await me(req.user!.id));
  } catch (error) {
    next(error);
  }
});

authRouter.get(
  "/consent",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await consentStatus(req.user!.id));
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/consent",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = validate(consentAcceptSchema, req.body);
      const data = await acceptConsent(req.user!.id, input.termsAccepted);
      sendSuccess(res, data, { message: "Consent recorded" });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.get("/config", (_req: Request, res: Response) => {
  sendSuccess(res, authConfig());
});
