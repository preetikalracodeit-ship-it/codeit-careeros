export const dynamic = "force-dynamic";

/**
 * Public, non-sensitive liveness endpoint for the frontend container.
 * It intentionally reports no backend URL, environment values, or build paths.
 */
export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "careeros-frontend",
      version: process.env.APP_VERSION || "unknown",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
