import path from "node:path";

/**
 * Paths da aplicação.
 *
 * Em desktop (Electron), `STORYFLOW_DATA_DIR` aponta para userData
 * (gravável). No web/dev, cai no cwd do projeto.
 */
export function getDataDir(): string {
  const fromEnv = process.env.STORYFLOW_DATA_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return process.cwd();
}

export function isDesktopApp(): boolean {
  return (
    process.env.STORYFLOW_DESKTOP === "1" ||
    Boolean(process.env.STORYFLOW_DATA_DIR?.trim())
  );
}

export function getUploadsDir(): string {
  if (process.env.STORYFLOW_DATA_DIR?.trim()) {
    return path.join(getDataDir(), "uploads");
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function getPrismaDbUrl(): string {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  if (process.env.STORYFLOW_DATA_DIR?.trim()) {
    const dbPath = path.join(getDataDir(), "prisma", "app.db");
    // Prisma file URLs precisam de path absoluto com 3 barras no Unix.
    return `file:${dbPath}`;
  }
  return "file:./prisma/dev.db";
}

export function publicUrlToAbsolutePath(publicUrl: string): string {
  const cleaned = publicUrl.replace(/^\//, "");
  if (cleaned.startsWith("uploads/")) {
    return path.join(getUploadsDir(), cleaned.slice("uploads/".length));
  }
  return path.join(process.cwd(), "public", cleaned);
}
