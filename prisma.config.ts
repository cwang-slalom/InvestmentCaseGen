import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.LEGACY_SQLITE_DATABASE_URL ?? "file:../data/investmentgen.db";

process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
