import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getUploadsDir } from "@/lib/app-paths";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  const parts = (await ctx.params).path ?? [];
  if (parts.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  // Impede path traversal.
  const safe = parts.map((p) => path.basename(p));
  if (safe.some((p, i) => p !== parts[i] || p === ".." || p === ".")) {
    return new Response("Invalid path", { status: 400 });
  }

  const filePath = path.join(getUploadsDir(), ...safe);
  const uploadsRoot = path.resolve(getUploadsDir());
  if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
    return new Response("Invalid path", { status: 400 });
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as BodyInit, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
