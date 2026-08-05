import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listProjectsForUser, requireApiUser } from "@/server/auth";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

async function readCreateProjectRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return {
      input: CreateProjectRequestSchema.parse(await request.json()),
      expectsJson: true,
    };
  }

  const formData = await request.formData();
  return {
    input: CreateProjectRequestSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    }),
    expectsJson: false,
  };
}

export async function GET(request: NextRequest) {
  const storage = getStorage();
  const auth = await requireApiUser(request, storage);

  if (!auth.user) {
    return auth.response;
  }

  const projects = await listProjectsForUser(auth.user, storage);
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const storage = getStorage();
  const auth = await requireApiUser(request, storage);

  if (!auth.user) {
    return auth.response;
  }

  try {
    const { input, expectsJson } = await readCreateProjectRequest(request);
    const project = await storage.createProject({
      ...input,
      ownerUserId: auth.user.id,
    });

    if (expectsJson) {
      return NextResponse.json({ project }, { status: 201 });
    }

    return NextResponse.redirect(
      new URL(`/projects/${project.id}/documents`, request.url),
      { status: 303 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid project input.", issues: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Project could not be created." },
      { status: 500 },
    );
  }
}
