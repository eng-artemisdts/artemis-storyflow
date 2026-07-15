import Replicate from "replicate";
import type {
  JobStatus,
  ProviderConfig,
  VideoGenInput,
  VideoGenProvider,
} from "@/lib/providers/types";
import { extractReplicateOutputUrl, mapReplicateStatus } from "@/lib/providers/replicate-shared";

/**
 * Adapter Replicate (predictions API) para vídeo.
 * Model configurável (ex.: "kwaivgi/kling-v2.1", "minimax/video-01",
 * "wan-video/wan-2.5-i2v").
 */
export class ReplicateVideoProvider implements VideoGenProvider {
  readonly id = "replicate";
  readonly label = "Replicate (vídeo)";

  private client: Replicate;
  private model: `${string}/${string}`;

  constructor(config: ProviderConfig) {
    this.client = new Replicate({ auth: config.apiKey });
    this.model = config.model as `${string}/${string}`;
  }

  async generateVideo(input: VideoGenInput): Promise<{ jobId: string }> {
    if (input.sourceVideoUrl) {
      throw new Error(
        "Edição de vídeo não é suportada neste modelo Replicate. Use Omni Flash (Google) ou xAI (Grok)."
      );
    }
    const payload: Record<string, unknown> = {
      prompt: input.prompt,
    };
    if (input.imageUrl) {
      // Nomes de campo variam por modelo; a maioria dos i2v usa start_image
      // ou first_frame_image. start_image cobre kling/minimax.
      payload.start_image = input.imageUrl;
    }
    if (input.durationSeconds) payload.duration = input.durationSeconds;
    if (input.aspectRatio) payload.aspect_ratio = input.aspectRatio;

    const prediction = await this.client.predictions.create({
      model: this.model,
      input: payload,
    });
    return { jobId: prediction.id };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const prediction = await this.client.predictions.get(jobId);
      return mapReplicateStatus(prediction.status, () =>
        extractReplicateOutputUrl(prediction.output)
      );
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }
}
