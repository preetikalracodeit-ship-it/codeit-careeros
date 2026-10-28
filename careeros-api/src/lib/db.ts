import mongoose, { type ClientSession } from "mongoose";
import { logger } from "./logger.js";
import { User } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { ConsentRecord } from "../models/ConsentRecord.js";
import { StudentProfile } from "../models/StudentProfile.js";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  logger.info({ database: mongoose.connection.name }, "Connected to MongoDB");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    User.createIndexes(),
    RefreshToken.createIndexes(),
    ConsentRecord.createIndexes(),
    StudentProfile.createIndexes(),
  ]);
}

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
