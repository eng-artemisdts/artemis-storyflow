import JSZip from "jszip";
import { isImageFilename } from "@/lib/brolls/google-flow";

function mimeForFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

/** Extrai imagens de um .zip exportado pelo Flow (ignora pastas e arquivos não-imagem). */
export async function extractImagesFromFlowZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const images: File[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const name = path.split(/[/\\]/).pop()?.trim() ?? path;
    if (!isImageFilename(name)) continue;

    const blob = await entry.async("blob");
    images.push(new File([blob], name, { type: mimeForFilename(name) }));
  }

  return images;
}
