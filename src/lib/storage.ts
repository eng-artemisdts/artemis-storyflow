import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getUploadsDir } from "@/lib/app-paths";

/**
 * Abstração de storage para os assets gerados (imagens/vídeos).
 * Em dev/desktop salva em uploads locais. Para produção cloud, implemente
 * S3StorageService / R2StorageService com a mesma interface.
 */
export interface StorageService {
  /** Baixa o asset da URL remota e persiste; retorna a URL pública local. */
  saveFromUrl(remoteUrl: string, keyHint: string): Promise<string>;
  /** Persiste um buffer (providers síncronos que retornam base64). */
  saveBuffer(data: Buffer, keyHint: string, ext: string): Promise<string>;
}

class LocalStorageService implements StorageService {
  private dirReady: Promise<void> | null = null;

  private get uploadsDir() {
    return getUploadsDir();
  }

  private ensureDir(): Promise<void> {
    if (!this.dirReady) {
      this.dirReady = mkdir(this.uploadsDir, { recursive: true }).then(() => undefined);
    }
    return this.dirReady.catch((err) => {
      this.dirReady = null;
      throw err;
    });
  }

  async saveFromUrl(remoteUrl: string, keyHint: string): Promise<string> {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      throw new Error(`Falha ao baixar asset (${res.status}): ${remoteUrl}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    const ext = extensionFor(contentType, remoteUrl);
    return this.saveBuffer(Buffer.from(await res.arrayBuffer()), keyHint, ext);
  }

  async saveBuffer(data: Buffer, keyHint: string, ext: string): Promise<string> {
    const fileName = `${keyHint}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    await this.ensureDir();
    try {
      await writeFile(path.join(this.uploadsDir, fileName), data);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as NodeJS.ErrnoException).code)
          : "";
      if (code === "ENOSPC") {
        throw new Error("Disco cheio — libere espaço e tente novamente.");
      }
      throw err;
    }
    return `/uploads/${fileName}`;
  }
}

function extensionFor(contentType: string, url: string): string {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("mp4")) return ".mp4";
  if (contentType.includes("webm")) return ".webm";
  const fromUrl = path.extname(new URL(url).pathname);
  return fromUrl || ".bin";
}

export const storage: StorageService = new LocalStorageService();
