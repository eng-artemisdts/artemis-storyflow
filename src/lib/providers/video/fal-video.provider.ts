import { createFalClient, type FalClient } from "@fal-ai/client";
import type {
  JobStatus,
  ProviderConfig,
  VideoGenInput,
  VideoGenProvider,
} from "@/lib/providers/types";

interface FalVideoResult {
  video?: { url: string };
  videos?: Array<{ url: string }>;
}

/**
 * Adapter fal.ai para geração de vídeo via queue API (long-running).
 * Endpoint configurável (ex.: "fal-ai/kling-video/v3/standard/image-to-video",
 * "fal-ai/veo3/fast/image-to-video", "fal-ai/wan-25-preview/image-to-video").
 */
export class FalVideoProvider implements VideoGenProvider {
  readonly id = "fal";
  readonly label = "fal.ai (vídeo)";

  private client: FalClient;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = createFalClient({ credentials: config.apiKey });
    this.model = config.model;
  }

  async generateVideo(input: VideoGenInput): Promise<{ jobId: string }> {
    if (input.sourceVideoUrl) {
      throw new Error(
        "Edição de vídeo não é suportada neste endpoint fal.ai. Use Omni Flash (Google) ou xAI (Grok)."
      );
    }
    const payload: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? "16:9",
    };
    if (input.imageUrl) payload.image_url = input.imageUrl;
    if (input.durationSeconds) payload.duration = String(input.durationSeconds);
    if (typeof input.withAudio === "boolean") payload.generate_audio = input.withAudio;

    const { request_id } = await this.client.queue.submit(this.model, { input: payload });
    return { jobId: request_id };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const status = await this.client.queue.status(this.model, {
        requestId: jobId,
        logs: false,
      });

      if (status.status === "COMPLETED") {
        const { data } = await this.client.queue.result(this.model, { requestId: jobId });
        const result = data as FalVideoResult;
        const url = result.video?.url ?? result.videos?.[0]?.url;
        if (!url) return { status: "failed", error: "Resposta do fal.ai sem URL de vídeo" };
        return { status: "succeeded", resultUrl: url };
      }
      if (status.status === "IN_PROGRESS") return { status: "running" };
      return { status: "queued" };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }
}
