import { access } from "node:fs/promises";
import path from "node:path";

export function localUploadAbsolutePath(publicUrl: string): string {
  return path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

export async function localUploadExists(publicUrl: string): Promise<boolean> {
  try {
    await access(localUploadAbsolutePath(publicUrl));
    return true;
  } catch {
    return false;
  }
}

/** Retorna a URL se o arquivo local existir (ou se for remota http(s)). */
export async function resolveAccessibleUploadUrl(
  publicUrl: string | null | undefined
): Promise<string | null> {
  if (!publicUrl?.trim()) return null;
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    return publicUrl;
  }
  if (!publicUrl.startsWith("/uploads/")) return null;
  return (await localUploadExists(publicUrl)) ? publicUrl : null;
}
