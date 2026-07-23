import { readFile } from "node:fs/promises";
import path from "node:path";
import { publicUrlToAbsolutePath } from "@/lib/app-paths";

/**
 * Carrega um asset (ex.: keyframe da cena) como bytes + mime type.
 * Aceita URLs http(s) e caminhos locais "/uploads/..." salvos pelo
 * StorageService — necessário para providers que exigem a imagem
 * inline em base64 (Veo/Omni) ou upload multipart (xAI Files API).
 */
export async function loadAssetBytes(
  url: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha ao baixar asset (${res.status}): ${url}`);
    }
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim();
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: contentType || guessMimeType(url),
    };
  }

  const filePath = publicUrlToAbsolutePath(url);
  return { buffer: await readFile(filePath), mimeType: guessMimeType(url) };
}

function guessMimeType(url: string): string {
  const ext = path.extname(new URL(url, "http://local").pathname).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    default:
      return "image/png";
  }
}
