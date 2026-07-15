import type {
  JobStatus,
  ProviderConfig,
  VideoGenInput,
  VideoGenProvider,
} from "@/lib/providers/types";
import { loadAssetBytes } from "@/lib/providers/asset-utils";

const BASE_URL = "https://api.x.ai/v1";

/**
 * Adapter xAI (Grok Imagine) para geração de vídeo.
 * Modelos: "grok-imagine-video" e "grok-imagine-video-1.5".
 *
 * Fluxo assíncrono nativo:
 * - POST /videos/generations → request_id
 * - GET /videos/{request_id} → { status, video: { url } }
 *
 * Image-to-video: keyframes locais (/uploads) são enviados via Files
 * API (file_id); URLs http(s) públicas vão direto em image.url.
 */
export class XaiVideoProvider implements VideoGenProvider {
  readonly id = "xai";
  readonly label = "xAI (Grok Imagine)";

  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async generateVideo(input: VideoGenInput): Promise<{ jobId: string }> {
    if (input.sourceVideoUrl) {
      return this.submitEdit(input.sourceVideoUrl, input.prompt);
    }

    const body: Record<string, unknown> = {
      model: this.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? "16:9",
      resolution: "720p",
    };
    if (input.durationSeconds) {
      body.duration = Math.min(Math.max(Math.round(input.durationSeconds), 1), 15);
    }
    if (input.imageUrl) {
      body.image = await this.resolveImageRef(input.imageUrl);
    }

    const res = await fetch(`${BASE_URL}/videos/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json()) as { request_id?: string; error?: unknown };
    if (!res.ok || !json.request_id) {
      throw new Error(errorMessage(json, res.status));
    }
    return { jobId: json.request_id };
  }

  /** POST /v1/videos/edits — edita o clipe mantendo duração/enquadramento. */
  private async submitEdit(sourceVideoUrl: string, prompt: string): Promise<{ jobId: string }> {
    const video = await this.resolveVideoRef(sourceVideoUrl);
    const res = await fetch(`${BASE_URL}/videos/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        video,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { request_id?: string; error?: unknown };
    if (!res.ok || !json.request_id) {
      throw new Error(errorMessage(json, res.status));
    }
    return { jobId: json.request_id };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const res = await fetch(`${BASE_URL}/videos/${jobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        cache: "no-store",
      });
      const json = (await res.json()) as {
        status?: string;
        video?: { url?: string };
        error?: unknown;
      };
      if (!res.ok) {
        return { status: "failed", error: errorMessage(json, res.status) };
      }

      const status = (json.status ?? "").toLowerCase();
      if (status === "done" || status === "succeeded" || status === "completed") {
        const url = json.video?.url;
        if (!url) return { status: "failed", error: "Resposta da xAI sem URL de vídeo" };
        return { status: "succeeded", resultUrl: url };
      }
      if (status === "failed" || status === "error" || status === "expired") {
        return { status: "failed", error: errorMessage(json, res.status) };
      }
      if (status === "pending" || status === "queued") return { status: "queued" };
      return { status: "running" };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** URLs públicas vão direto; assets locais sobem via Files API. */
  private async resolveImageRef(
    imageUrl: string
  ): Promise<{ url: string } | { file_id: string }> {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return { url: imageUrl };
    }
    return this.uploadLocalFile(imageUrl, "keyframe");
  }

  private async resolveVideoRef(
    videoUrl: string
  ): Promise<{ url: string } | { file_id: string }> {
    if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
      return { url: videoUrl };
    }
    // Locais: data URL evita depender de URL pública para o clipe em /uploads.
    const { buffer, mimeType } = await loadAssetBytes(videoUrl);
    const type = mimeType.includes("video") ? mimeType : "video/mp4";
    return { url: `data:${type};base64,${buffer.toString("base64")}` };
  }

  private async uploadLocalFile(
    url: string,
    prefix: string
  ): Promise<{ file_id: string }> {
    const { buffer, mimeType } = await loadAssetBytes(url);
    const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] ?? "png";
    const form = new FormData();
    form.append("purpose", "assistants");
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      `${prefix}.${ext}`
    );

    const res = await fetch(`${BASE_URL}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      cache: "no-store",
    });
    const json = (await res.json()) as { id?: string; error?: unknown };
    if (!res.ok || !json.id) {
      throw new Error(`Upload para a xAI falhou: ${errorMessage(json, res.status)}`);
    }
    return { file_id: json.id };
  }
}

function errorMessage(json: { error?: unknown }, httpStatus: number): string {
  const err = json.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return `xAI respondeu ${httpStatus}`;
}
