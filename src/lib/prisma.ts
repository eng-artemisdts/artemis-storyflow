import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { getPrismaDbUrl } from "@/lib/app-paths";

/**
 * Incrementar quando o schema Prisma muda em desenvolvimento.
 * Evita reutilizar um PrismaClient antigo no `globalThis` após `prisma generate`
 * (hot-reload não reconstrói o singleton sozinho).
 */
const PRISMA_CLIENT_VERSION = 17;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: number;
};

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: getPrismaDbUrl(),
  });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION
  ) {
    return globalForPrisma.prisma;
  }

  const client = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
