/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Report-only first: the app currently relies on Next.js inline bootstrap
// scripts/styles, so enforcing a nonce-based policy would require dynamic
// rendering of every page. This policy is deliberately narrow (no wildcard
// network origins) and allows only what Google Identity Services needs.
// Review reports in a staging environment before switching the header to
// Content-Security-Policy.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com https://www.gstatic.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com",
  "frame-src https://accounts.google.com https://www.gstatic.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Keeps the Google Identity popup working while isolating the opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  // HSTS only in production builds: never pin localhost during development.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig = {
  // Do not advertise the framework/version in response headers.
  poweredByHeader: false,
  // Hide the floating Next.js dev indicator (black "N" button) during development.
  devIndicators: false,
  // Self-contained server output for the production Docker image.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Same-origin API proxy: browsers always call THIS domain (/api/*), so there
  // is no mixed-content block on HTTPS sites and no CORS involved. The Next
  // server forwards to the backend server-side.
  // API_PROXY_URL is baked at build time: http://backend:8080 in Docker,
  // http://localhost:8080 for local dev. Set NEXT_PUBLIC_API_URL only to
  // bypass the proxy and call a backend directly from the browser.
  async rewrites() {
    const target = (process.env.API_PROXY_URL || "http://localhost:8080").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
