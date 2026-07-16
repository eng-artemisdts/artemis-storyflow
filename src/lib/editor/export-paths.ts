import path from "node:path";

export { STATIC_COMPOSITION_ID } from "@/lib/schemas/editor";

/** Converte URL pública (`/uploads/...`) em absoluta para o Chromium do Remotion. */
export function toAbsoluteAssetUrl(
  src: string | null | undefined,
  baseUrl: string
): string | null {
  if (!src?.trim()) return null;
  const trimmed = src.trim();
  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }
  const base = baseUrl.replace(/\/$/, "");
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}

/** Origem HTTP do Next em execução (usada no render headless). */
export function resolveAppOrigin(explicit?: string | null): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

export function remotionEntryPoint(): string {
  return path.join(process.cwd(), "src", "remotion", "index.ts");
}

export function remotionBundleCacheDir(): string {
  return path.join(process.cwd(), ".remotion-bundle");
}

export function exportWorkDir(projectId: string): string {
  return path.join(process.cwd(), ".data", "exports", projectId);
}

