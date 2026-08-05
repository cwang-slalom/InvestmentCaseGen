import { NextRequest, NextResponse } from "next/server";

import {
  createSessionForUser,
  safeNextPath,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/auth";
import {
  authenticateMicrosoftCallback,
  expiredMicrosoftAuthCookieOptions,
  getMicrosoftAuthCookieName,
  parseMicrosoftAuthState,
} from "@/server/auth/microsoft";

export const runtime = "nodejs";

function loginRedirect(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("status", "error");
  url.searchParams.set("message", message);
  return url;
}

export async function GET(request: NextRequest) {
  const microsoftCookieName = getMicrosoftAuthCookieName();
  const state = parseMicrosoftAuthState(
    request.cookies.get(microsoftCookieName)?.value,
  );
  const responseError = request.nextUrl.searchParams.get("error");
  const responseErrorDescription =
    request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");

  if (responseError) {
    const response = NextResponse.redirect(
      loginRedirect(
        request,
        responseErrorDescription || "Microsoft sign-in was cancelled.",
      ),
      { status: 303 },
    );
    response.cookies.set(
      microsoftCookieName,
      "",
      expiredMicrosoftAuthCookieOptions(),
    );
    return response;
  }

  if (!state || !code || !returnedState || returnedState !== state.state) {
    const response = NextResponse.redirect(
      loginRedirect(request, "Microsoft sign-in could not be verified."),
      { status: 303 },
    );
    response.cookies.set(
      microsoftCookieName,
      "",
      expiredMicrosoftAuthCookieOptions(),
    );
    return response;
  }

  try {
    const user = await authenticateMicrosoftCallback({
      code,
      origin: request.nextUrl.origin,
      state,
    });
    const { token, expiresAt } = await createSessionForUser({
      userId: user.id,
    });
    const response = NextResponse.redirect(
      new URL(safeNextPath(state.next), request.url),
      { status: 303 },
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(expiresAt),
    );
    response.cookies.set(
      microsoftCookieName,
      "",
      expiredMicrosoftAuthCookieOptions(),
    );

    return response;
  } catch {
    const response = NextResponse.redirect(
      loginRedirect(request, "Microsoft sign-in failed."),
      { status: 303 },
    );
    response.cookies.set(
      microsoftCookieName,
      "",
      expiredMicrosoftAuthCookieOptions(),
    );
    return response;
  }
}
