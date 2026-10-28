import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

export function signAccessToken(user: { _id: number; email: string; role: string }): string {
  return jwt.sign(
    { email: user.email, role: user.role },
    env.JWT_SECRET,
    {
      subject: String(user._id),
      issuer: env.JWT_ISSUER,
      expiresIn: Math.floor(env.JWT_ACCESS_EXPIRATION_MS / 1000),
      algorithm: "HS256",
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    algorithms: ["HS256"],
  }) as AccessTokenPayload;
}

export function accessExpiresInSeconds(): number {
  return Math.floor(env.JWT_ACCESS_EXPIRATION_MS / 1000);
}
