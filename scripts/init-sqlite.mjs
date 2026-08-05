import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defaultDatabaseUrl = "file:../data/investmentgen.db";
const migrationsDir = path.join(rootDir, "prisma/migrations");
const scryptParams = {
  N: 16384,
  r: 8,
  p: 1,
};

function resolveSqlitePath(
  databaseUrl = process.env.LEGACY_SQLITE_DATABASE_URL ?? defaultDatabaseUrl,
) {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.replace(/^file:/, "");
  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(rootDir, "prisma", rawPath);
}

const databasePath = resolveSqlitePath();
mkdirSync(path.dirname(databasePath), { recursive: true });

const databaseAlreadyExists = existsSync(databasePath);
const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS "_InvestmentGenMigration" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const hasProjectTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
  .get("Project");

const migrationRows = db
  .prepare('SELECT name FROM "_InvestmentGenMigration"')
  .all();
const appliedMigrations = new Set(migrationRows.map((row) => row.name));

if (hasProjectTable && appliedMigrations.size === 0) {
  db.prepare('INSERT INTO "_InvestmentGenMigration" ("name") VALUES (?)').run(
    "20260714190000_foundation",
  );
  appliedMigrations.add("20260714190000_foundation");
}

const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const appliedNow = [];
for (const migrationName of migrations) {
  if (appliedMigrations.has(migrationName)) {
    continue;
  }

  const migrationPath = path.join(
    migrationsDir,
    migrationName,
    "migration.sql",
  );
  const migrationSql = readFileSync(migrationPath, "utf8");
  const applyMigration = db.transaction(() => {
    db.exec(migrationSql);
    db.prepare('INSERT INTO "_InvestmentGenMigration" ("name") VALUES (?)').run(
      migrationName,
    );
  });

  applyMigration();
  appliedNow.push(migrationName);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(password, salt, 64, scryptParams).toString(
    "base64url",
  );

  return [
    "scrypt",
    scryptParams.N,
    scryptParams.r,
    scryptParams.p,
    salt,
    key,
  ].join("$");
}

function userExists(email) {
  return Boolean(
    db.prepare('SELECT id FROM "User" WHERE "email" = ?').get(email),
  );
}

function seedUser({ email, name, password, systemRole }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (userExists(normalizedEmail)) {
    return db
      .prepare('SELECT id, email FROM "User" WHERE "email" = ?')
      .get(normalizedEmail);
  }

  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    name,
  };

  db.prepare(
    `INSERT INTO "User" (
      "id",
      "email",
      "name",
      "passwordHash",
      "systemRole",
      "active",
      "updatedAt"
    ) VALUES (?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP)`,
  ).run(user.id, user.email, name, hashPassword(password), systemRole);

  return user;
}

function seedAuth() {
  const hasUserTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get("User");

  if (!hasUserTable || process.env.INVESTMENTGEN_SEED_AUTH === "false") {
    return;
  }

  const admin = seedUser({
    email: process.env.INVESTMENTGEN_BOOTSTRAP_EMAIL ?? "admin@example.com",
    name: process.env.INVESTMENTGEN_BOOTSTRAP_NAME ?? "Admin User",
    password: process.env.INVESTMENTGEN_BOOTSTRAP_PASSWORD ?? "admin-pass",
    systemRole: "ADMIN",
  });

  seedUser({
    email: "analyst@example.com",
    name: "Analyst User",
    password: "analyst-pass",
    systemRole: "MEMBER",
  });

  const existingProjects = db.prepare('SELECT id FROM "Project"').all();
  const insertMembership = db.prepare(
    `INSERT OR IGNORE INTO "ProjectMembership" (
      "id",
      "projectId",
      "userId",
      "role"
    ) VALUES (?, ?, ?, 'OWNER')`,
  );

  for (const project of existingProjects) {
    insertMembership.run(randomUUID(), project.id, admin.id);
  }
}

seedAuth();

if (appliedNow.length > 0) {
  const action = databaseAlreadyExists ? "Updated" : "Initialized";
  console.log(
    `${action} SQLite database at ${path.relative(rootDir, databasePath)} (${appliedNow.length} migration${appliedNow.length === 1 ? "" : "s"})`,
  );
} else {
  console.log(
    `SQLite database already initialized at ${path.relative(rootDir, databasePath)}`,
  );
}

db.close();

if (!databaseAlreadyExists) {
  mkdirSync(path.join(rootDir, "data/uploads"), { recursive: true });
}
