import { createHash, randomBytes, randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";

import type { Project, ProjectAccessRole, User } from "@/domain";
import { getStorage, type Storage } from "@/server/storage";

import { verifyPassword } from "./passwords";

export const SESSION_COOKIE_NAME = "investmentgen_session";

const SESSION_DURATION_DAYS = 7;
const REMEMBERED_SESSION_DURATION_DAYS = 30;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
const REMEMBERED_SESSION_DURATION_MS =
  REMEMBERED_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export type ProjectPermission = "view" | "edit" | "manage";

export type ProjectAccess = {
  project: Project | null;
  role?: ProjectAccessRole;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  isSystemAdmin: boolean;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };
}

export function safeNextPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function loginPath(returnTo = "/") {
  const path = safeNextPath(returnTo);
  return `/login?next=${encodeURIComponent(path)}`;
}

export async function authenticateUser({
  email,
  password,
  storage = getStorage(),
}: {
  email: string;
  password: string;
  storage?: Storage;
}) {
  const user = await storage.getUserForAuthByEmail(email);

  if (!user || !user.active) {
    return null;
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function createSessionForUser({
  remember = false,
  userId,
  storage = getStorage(),
}: {
  remember?: boolean;
  userId: string;
  storage?: Storage;
}) {
  const token = randomBytes(32).toString("base64url");
  const durationMs = remember
    ? REMEMBERED_SESSION_DURATION_MS
    : SESSION_DURATION_MS;
  const expiresAt = new Date(Date.now() + durationMs);
  const session = await storage.createAuthSession({
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return {
    token,
    expiresAt,
    session,
  };
}

async function getUserFromSessionToken(
  token: string | undefined,
  storage = getStorage(),
) {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await storage.getAuthSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now() || !session.user.active) {
    await storage.deleteAuthSessionByTokenHash(tokenHash);
    return null;
  }

  return session.user;
}

export async function getCurrentUser(storage = getStorage()) {
  const cookieStore = await cookies();
  return getUserFromSessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    storage,
  );
}

export async function getCurrentUserFromRequest(
  request: NextRequest,
  storage = getStorage(),
) {
  return getUserFromSessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    storage,
  );
}

export async function destroyRequestSession(
  request: NextRequest,
  storage = getStorage(),
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await storage.deleteAuthSessionByTokenHash(hashSessionToken(token));
  }
}

export async function requirePageUser(returnTo = "/") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginPath(returnTo));
  }

  return user;
}

function roleAllows(role: ProjectAccessRole, permission: ProjectPermission) {
  if (permission === "view") {
    return true;
  }

  if (permission === "edit") {
    return role === "owner" || role === "editor";
  }

  return role === "owner";
}

export function userCan(
  role: ProjectAccessRole | undefined,
  permission: ProjectPermission,
) {
  return role ? roleAllows(role, permission) : false;
}

export async function getProjectAccess({
  user,
  projectId,
  storage = getStorage(),
}: {
  user: User;
  projectId: string;
  storage?: Storage;
}): Promise<ProjectAccess> {
  const isSystemAdmin = user.systemRole === "admin";
  const project = await storage.getProject(
    projectId,
    isSystemAdmin ? undefined : user.id,
  );

  if (!project) {
    return {
      project: null,
      canView: false,
      canEdit: false,
      canManage: false,
      isSystemAdmin,
    };
  }

  const membership = await storage.getProjectMembership(projectId, user.id);
  const role = isSystemAdmin ? (membership?.role ?? "owner") : membership?.role;

  return {
    project,
    role,
    canView: isSystemAdmin || userCan(role, "view"),
    canEdit: isSystemAdmin || userCan(role, "edit"),
    canManage: isSystemAdmin || userCan(role, "manage"),
    isSystemAdmin,
  };
}

export async function listProjectsForUser(user: User, storage = getStorage()) {
  if (user.systemRole === "admin") {
    return storage.listProjects();
  }

  return storage.listProjects(user.id);
}

export async function requireApiUser(
  request: NextRequest,
  storage = getStorage(),
) {
  const user = await getCurrentUserFromRequest(request, storage);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  return { user, response: null };
}

export async function requireApiProjectAccess({
  request,
  projectId,
  permission,
  storage = getStorage(),
}: {
  request: NextRequest;
  projectId: string;
  permission: ProjectPermission;
  storage?: Storage;
}) {
  const auth = await requireApiUser(request, storage);

  if (!auth.user) {
    return {
      user: null,
      access: null,
      response: auth.response,
    };
  }

  const access = await getProjectAccess({
    user: auth.user,
    projectId,
    storage,
  });

  if (!access.project) {
    return {
      user: auth.user,
      access,
      response: NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      ),
    };
  }

  const allowed =
    permission === "view"
      ? access.canView
      : permission === "edit"
        ? access.canEdit
        : access.canManage;

  if (!allowed) {
    return {
      user: auth.user,
      access,
      response: NextResponse.json(
        { error: "You do not have access to perform this action." },
        { status: 403 },
      ),
    };
  }

  return {
    user: auth.user,
    access,
    response: null,
  };
}
