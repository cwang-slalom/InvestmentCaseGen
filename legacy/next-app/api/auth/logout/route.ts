import { NextRequest, NextResponse } from "next/server";

import {
  destroyRequestSession,
  expiredSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await destroyRequestSession(request);

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.cookies.set(SESSION_COOKIE_NAME, "", expiredSessionCookieOptions());

  return response;
}
