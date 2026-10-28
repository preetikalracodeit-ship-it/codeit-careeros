import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { requestId } from "./middleware/requestId.js";
import { noStore } from "./middleware/noStore.js";
import { attachUser, requireRole } from "./middleware/auth.js";
import { auditAdminRequests } from "./middleware/adminAudit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { metaRouter } from "./modules/meta/meta.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { studentProfileRouter } from "./modules/students/studentProfile.routes.js";
import { careerRouter, studentCareerRouter } from "./modules/careers/career.routes.js";
import { assessmentRouter } from "./modules/assessments/assessment.routes.js";
import { roadmapRouter } from "./modules/roadmaps/roadmap.routes.js";
import { projectRouter } from "./modules/projects/project.routes.js";
import { invitationRouter } from "./modules/invitations/invitation.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.trustedProxies.length > 0 ? env.trustedProxies : false);
  app.set("json replacer", (_key: string, value: unknown) =>
    value === null ? undefined : value,
  );

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: () => env.isTest },
      customProps: (req) => ({
        requestId: (req as unknown as { requestId?: string }).requestId,
      }),
      serializers: {
        req(req: { method?: string; url?: string }) {
          return { method: req.method, url: req.url };
        },
        res(res: { statusCode?: number }) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Accept", "X-Request-Id"],
      exposedHeaders: ["Content-Disposition", "X-Request-Id"],
      credentials: true,
      maxAge: 3600,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(noStore);
  app.use(attachUser);
  app.use("/api/v1/admin", auditAdminRequests);

  app.use(healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/meta", metaRouter);
  app.use("/api/v1", settingsRouter);
  app.use("/api/v1/students", studentProfileRouter);
  app.use("/api/v1/students", studentCareerRouter);
  app.use("/api/v1/careers", careerRouter);
  app.use("/api/v1/assessments", assessmentRouter);
  app.use("/api/v1/roadmaps", roadmapRouter);
  app.use("/api/v1/projects", projectRouter);
  app.use("/api/v1/invitations", invitationRouter);

  app.use("/api/v1/college", requireRole("PROFESSOR"));
  app.use("/api/v1/admin", requireRole("ADMIN"));

  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith("/v1/invitations")) {
      next();
      return;
    }
    if (req.method === "GET" && req.path.startsWith("/v1/careers")) {
      next();
      return;
    }
    if (!req.user) {
      next(AppError.unauthorized("Authentication is required"));
      return;
    }
    next();
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
