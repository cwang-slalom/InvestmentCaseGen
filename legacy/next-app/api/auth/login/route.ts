import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  authenticateUser,
  createSessionForUser,
  safeNextPath,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/auth";

export const runtime = "nodejs";

const LoginRequestSchema = z.object({
  email: z.string().trim().email(),
  next: z.string().optional(),
  password: z.string().min(1),
  remember: z.preprocess(
    (value) => value === true || value === "true" || value === "on",
    z.boolean(),
  ),
});

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

async function readLoginRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return LoginRequestSchema.parse(await request.json());
  }

  const formData = await request.formData();
  return LoginRequestSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
    remember: formData.get("remember"),
  });
}

function invalidLoginResponse(request: NextRequest, nextPath: string) {
  if (wantsJson(request)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("status", "error");
  url.searchParams.set("message", "Invalid email or password.");
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const input = await readLoginRequest(request);
    const nextPath = safeNextPath(input.next);
    const user = await authenticateUser({
      email: input.email,
      password: input.password,
    });

    if (!user) {
      return invalidLoginResponse(request, nextPath);
    }

    const { token, expiresAt } = await createSessionForUser({
      remember: input.remember,
      userId: user.id,
    });

    if (wantsJson(request)) {
      const response = NextResponse.json({ user });
      response.cookies.set(
        SESSION_COOKIE_NAME,
        token,
        sessionCookieOptions(expiresAt),
      );
      return response;
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url), {
      status: 303,
    });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(expiresAt),
    );
    return response;
  } catch (error) {
    if (wantsJson(request)) {
      return NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? "Enter a valid email and password."
              : "Login failed.",
        },
        { status: error instanceof z.ZodError ? 400 : 500 },
      );
    }

    const url = new URL("/login", request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set(
      "message",
      error instanceof z.ZodError
        ? "Enter a valid email and password."
        : "Login failed.",
    );
    return NextResponse.redirect(url, { status: 303 });
  }
}
