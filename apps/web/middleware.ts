import { NextRequest, NextResponse } from "next/server";

/**
 * Optional password gate.
 * Set SITE_PASSWORD env var to enable HTTP Basic Auth on the entire site.
 * Leave unset (or empty) to disable — useful for local dev.
 *
 * When prompted: enter anything as the username, and SITE_PASSWORD as the password.
 */
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";

  if (auth.startsWith("Basic ")) {
    try {
      // atob is available in the Edge runtime
      const decoded = atob(auth.slice(6));
      // username:password — take everything after the first colon
      const pass = decoded.split(":").slice(1).join(":");
      if (pass === password) return NextResponse.next();
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="Kumqat QA"`,
    },
  });
}

export const config = {
  // Apply to all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
