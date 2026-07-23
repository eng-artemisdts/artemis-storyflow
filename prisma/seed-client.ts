import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

/** Cliente Prisma para scripts CLI (seed / export), fora do Next.js. */
export function createSeedPrisma(): PrismaClient {
  const raw = process.env.DATABASE_URL?.trim() || "file:./prisma/dev.db";
  const url = raw.startsWith("file:")
    ? raw.includes("://") || raw.startsWith("file:/")
      ? raw
      : `file:${path.resolve(process.cwd(), raw.replace(/^file:/, ""))}`
    : raw;

  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}
