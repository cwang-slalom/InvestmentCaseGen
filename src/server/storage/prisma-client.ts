import { mkdirSync } from "node:fs";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

const defaultDatabaseUrl = "file:../data/investmentgen.db";

type PrismaGlobal = typeof globalThis & {
  investmentGenPrisma?: PrismaClient;
};

export function getDatabaseUrl(): string {
  return process.env.LEGACY_SQLITE_DATABASE_URL ?? defaultDatabaseUrl;
}

export function resolveSqlitePath(databaseUrl = getDatabaseUrl()): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.replace(/^file:/, "");
  const databasePath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), "prisma", rawPath);

  mkdirSync(path.dirname(databasePath), { recursive: true });
  return databasePath;
}

export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: resolveSqlitePath(),
  });

  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  const prismaGlobal = globalThis as PrismaGlobal;

  if (!prismaGlobal.investmentGenPrisma) {
    prismaGlobal.investmentGenPrisma = createPrismaClient();
  }

  return prismaGlobal.investmentGenPrisma;
}
