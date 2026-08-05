import { NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/server/auth";
import {
  createMicrosoftAuthorizationUrl,
  getMicrosoftAuthCookieName,
  microsoftAuthCookieOptions,
  serializeMicrosoftAuthState,
} from "@/server/auth/microsoft";

export const runtime = "nodejs";

function redirectToLoginWithError(
  request: NextRequest,
  message: string,
  nextPath: string,
) {
  const url = new URL("/login", request.url);
  url.searchParams.set("status", "error");
  url.searchParams.set("message", message);
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  try {
    const { state, url } = await createMicrosoftAuthorizationUrl({
      next: nextPath,
      origin: request.nextUrl.origin,
    });
    const response = NextResponse.redirect(url, { status: 303 });

    response.cookies.set(
      getMicrosoftAuthCookieName(),
      serializeMicrosoftAuthState(state),
      microsoftAuthCookieOptions(),
    );

    return response;
  } catch {
    return redirectToLoginWithError(
      request,
      "Microsoft sign-in is unavailable. Use email and password or contact an admin.",
      nextPath,
    );
  }
}
