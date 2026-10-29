import { env } from "../config/env.js";
import { withTransaction } from "./db.js";
import { hashPassword } from "./password.js";
import { logger } from "./logger.js";
import { getNextSequence } from "../models/Counter.js";
import { User } from "../models/User.js";

export async function bootstrapAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  if (!email || !env.ADMIN_PASSWORD) {
    return;
  }

  const existingAdmin = await User.exists({ role: "SUPER_ADMIN" });
  if (existingAdmin) {
    return;
  }

  const existingUser = await User.exists({ emailLower: email });
  if (existingUser) {
    logger.warn({ email }, "Admin bootstrap skipped: email already belongs to a non-admin user");
    return;
  }

  await withTransaction(async (session) => {
    const userId = await getNextSequence("users", session);
    await User.create(
      [
        {
          _id: userId,
          email,
          emailLower: email,
          passwordHash: await hashPassword(env.ADMIN_PASSWORD),
          fullName: "Platform Administrator",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
      ],
      { session },
    );
    logger.info({ userId }, "Bootstrapped platform administrator");
  });
}
