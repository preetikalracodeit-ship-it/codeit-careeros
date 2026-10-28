import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase, ensureIndexes } from "./lib/db.js";
import { bootstrapAdmin } from "./lib/bootstrapAdmin.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  await ensureIndexes();
  await bootstrapAdmin();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "careeros-api listening");
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Shutting down careeros-api");
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error({ err: error }, "Failed to start careeros-api");
  process.exit(1);
});
