import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export interface VerifiedGoogleUser {
  email: string;
  fullName: string;
  googleSub: string;
  pictureUrl?: string;
}

interface TokenInfo {
  aud?: string;
  azp?: string;
  iss?: string;
  exp?: string | number;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  sub?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser> {
  if (!env.googleClientId) {
    throw AppError.serviceUnavailable(
      "Google sign-in is not configured on the server (GOOGLE_CLIENT_ID missing)",
    );
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  let info: TokenInfo;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      logger.warn({ status: response.status }, "Google tokeninfo rejected the ID token");
      throw AppError.unauthorized("Invalid Google credential. Please try again.");
    }
    info = (await response.json()) as TokenInfo;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.warn({ err: error }, "Google tokeninfo request failed");
    throw AppError.unauthorized("Could not verify Google credential. Please try again.");
  }

  const aud = info.aud ?? "";
  const azp = info.azp ?? "";
  if (aud !== env.googleClientId && azp !== env.googleClientId) {
    logger.warn({ aud, azp }, "Google ID token audience mismatch");
    throw AppError.unauthorized("Google credential was not issued for this app.");
  }

  const iss = info.iss ?? "";
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw AppError.unauthorized("Invalid Google credential issuer.");
  }

  const exp = Number(info.exp ?? 0);
  if (exp > 0 && Date.now() / 1000 > exp) {
    throw AppError.unauthorized("Google credential has expired. Please try again.");
  }

  const email = (info.email ?? "").toLowerCase().trim();
  if (!email) {
    throw AppError.unauthorized("Google account has no email address.");
  }
  const verified = info.email_verified === true || String(info.email_verified) === "true";
  if (!verified) {
    throw AppError.unauthorized("Google email address is not verified.");
  }

  let name = (info.name ?? "").trim();
  if (!name) {
    name = `${info.given_name ?? ""} ${info.family_name ?? ""}`.trim();
  }
  if (!name) {
    name = email.slice(0, email.indexOf("@"));
  }

  return {
    email,
    fullName: name,
    googleSub: (info.sub ?? "").trim(),
    pictureUrl: info.picture?.trim() || undefined,
  };
}
