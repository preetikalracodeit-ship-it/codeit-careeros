import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { requestId } from "./middleware/requestId.js";
import { noStore } from "./middleware/noStore.js";
import { attachUser, requireCollegeStaff, requireRole } from "./middleware/auth.js";
import { auditAdminRequests } from "./middleware/adminAudit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { metaRouter } from "./modules/meta/meta.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { studentRouter } from "./modules/students/student.routes.js";
import { careerRouter } from "./modules/careers/career.routes.js";
import { skillRouter } from "./modules/skills/skill.routes.js";
import { assessmentRouter } from "./modules/assessments/assessment.routes.js";
import { roadmapRouter } from "./modules/roadmaps/roadmap.routes.js";
import { projectRouter } from "./modules/projects/project.routes.js";
import { linkedInRouter } from "./modules/linkedin/linkedin.routes.js";
import { workspaceRouter } from "./modules/workspace/workspace.routes.js";
import { cvRouter } from "./modules/cvs/cv.routes.js";
import { reportRouter } from "./modules/reports/report.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";
import { progressRouter } from "./modules/progress/progress.routes.js";
import { invitationRouter } from "./modules/invitations/invitation.routes.js";
import {
  adminInvitationManagementRouter,
  collegeInvitationManagementRouter,
} from "./modules/invitations/invitationManagement.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { adminMasterRouter } from "./modules/admin/adminMaster.routes.js";
import { collegeImprovementPlanRouter } from "./modules/college/collegeImprovementPlan.routes.js";
import { collegeRouter } from "./modules/college/college.routes.js";

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

  // Public routes (no auth needed)
  app.use(healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/meta", metaRouter);
  app.use("/api/v1", settingsRouter);

  // Auth guard: all /api routes require authentication except explicitly public endpoints
  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    // Invitations are public (students click email links)
    if (req.path === "/v1/invitations" || req.path.startsWith("/v1/invitations/")) {
      next();
      return;
    }
    // Published careers are public; the Spring API requires auth for skills.
    if (
      req.method === "GET" &&
      (req.path === "/v1/careers" || req.path.startsWith("/v1/careers/"))
    ) {
      next();
      return;
    }
    if (!req.user) {
      next(AppError.unauthorized("Authentication is required"));
      return;
    }
    next();
  });

  // Authenticated student / shared routes
  app.use("/api/v1/students", studentRouter);
  app.use("/api/v1/careers", careerRouter);
  app.use("/api/v1/skills", skillRouter);
  app.use("/api/v1/assessments", assessmentRouter);
  app.use("/api/v1/roadmaps", roadmapRouter);
  app.use("/api/v1/projects", projectRouter);
  app.use("/api/v1/linkedin", linkedInRouter);
  app.use("/api/v1/workspace", workspaceRouter);
  app.use("/api/v1/cvs", cvRouter);
  app.use("/api/v1/reports", reportRouter);
  app.use("/api/v1/ai", aiRouter);
  app.use("/api/v1/progress", progressRouter);
  app.use("/api/v1/invitations", invitationRouter);

  // College staff routes (requireCollegeStaff applied first)
  app.use("/api/v1/college", requireCollegeStaff);
  app.use("/api/v1/college", collegeInvitationManagementRouter);
  app.use("/api/v1/college", collegeRouter);
  app.use("/api/v1/college/improvement-plans", collegeImprovementPlanRouter);

  // Super admin routes (requireRole applied first)
  app.use("/api/v1/platform", requireRole("SUPER_ADMIN"));
  app.use("/api/v1/admin", requireRole("SUPER_ADMIN"));
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/admin", adminMasterRouter);
  app.use("/api/v1/admin", adminInvitationManagementRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
