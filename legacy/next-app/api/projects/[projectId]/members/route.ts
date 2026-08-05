import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ProjectAccessRoleSchema } from "@/domain";
import { requireApiProjectAccess } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

const UpsertMemberRequestSchema = z.object({
  email: z.string().trim().email(),
  role: ProjectAccessRoleSchema,
});

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

function redirectToProjectAccess(
  request: NextRequest,
  projectId: string,
  params: Record<string, string>,
) {
  const url = new URL(`/projects/${projectId}/documents`, request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const storage = getStorage();
  const auth = await requireApiProjectAccess({
    request,
    projectId,
    permission: "manage",
    storage,
  });

  if (auth.response) {
    return auth.response;
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
    const input = UpsertMemberRequestSchema.parse(body);
    const user = await storage.getUserByEmail(input.email);

    if (!user) {
      if (wantsJson(request)) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      return redirectToProjectAccess(request, projectId, {
        accessStatus: "error",
        accessMessage: "User not found.",
      });
    }

    const membership = await storage.upsertProjectMembership({
      projectId,
      userId: user.id,
      role: input.role,
    });

    if (wantsJson(request)) {
      return NextResponse.json({ membership }, { status: 200 });
    }

    return redirectToProjectAccess(request, projectId, {
      accessStatus: "updated",
    });
  } catch (error) {
    if (wantsJson(request)) {
      return NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? "Enter a valid user email and role."
              : "Project access could not be updated.",
        },
        { status: error instanceof z.ZodError ? 400 : 500 },
      );
    }

    return redirectToProjectAccess(request, projectId, {
      accessStatus: "error",
      accessMessage:
        error instanceof z.ZodError
          ? "Enter a valid user email and role."
          : "Project access could not be updated.",
    });
  }
}
