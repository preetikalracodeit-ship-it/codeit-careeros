import { NextResponse } from "next/server";
import { decodeJwt, ROLE_COOKIE_NAME, LEGACY_COOKIE_NAME } from "@/lib/auth";

const STUDENT_HOME = "/student/dashboard";
const ADMIN_HOME = "/admin/dashboard";
const LOGIN = "/login";

function roleFromRequest(request) {
  // The role cookie is only a routing hint. Backend authorization remains
  // authoritative. Read the legacy token cookie during migration so existing
  // sessions are not logged out; auth.save() removes that copy.
  const role = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  if (role === "STUDENT" || role === "ADMIN") return role;
  const legacyToken = request.cookies.get(LEGACY_COOKIE_NAME)?.value;
  if (!legacyToken) return null;
  return decodeJwt(legacyToken)?.role ?? null;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const role = roleFromRequest(request);

  const isStudentArea = pathname.startsWith("/student");
  const isAdminArea = pathname.startsWith("/admin");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isStudentArea) {
    if (!role) return NextResponse.redirect(new URL(LOGIN, request.url));
    // Sprint 8: the student area is STUDENT-only; admins go to their console.
    if (role !== "STUDENT") return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
  }

  if (isAdminArea) {
    if (!role) return NextResponse.redirect(new URL(LOGIN, request.url));
    if (role !== "ADMIN") return NextResponse.redirect(new URL(STUDENT_HOME, request.url));
  }

  if (isAuthPage && role) {
    const home = role === "ADMIN" ? ADMIN_HOME : STUDENT_HOME;
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/admin/:path*", "/login", "/register"],
};