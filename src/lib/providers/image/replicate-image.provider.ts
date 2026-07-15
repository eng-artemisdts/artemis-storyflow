import Replicate from "replicate";
import type {
  ImageGenInput,
  ImageGenProvider,
  JobStatus,
  ProviderConfig,
} from "@/lib/providers/types";
import { extractReplicateOutputUrl, mapReplicateStatus } from "@/lib/providers/replicate-shared";

/**
 * Adapter Replicate (predictions API) para imagem.
 * Model configurável no formato "owner/name" (ex.: "black-forest-labs/flux-1.1-pro",
 * "google/nano-banana").
 */
export class ReplicateImageProvider implements ImageGenProvider {
  readonly id = "replicate";
  readonly label = "Replicate (imagem)";

  private client: Replicate;
  private model: `${string}/${string}`;

  constructor(config: ProviderConfig) {
    this.client = new Replicate({ auth: config.apiKey });
    this.model = config.model as `${string}/${string}`;
  }

  async generateImage(input: ImageGenInput): Promise<{ jobId: string }> {
    const payload: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? "16:9",
    };
    if (typeof input.seed === "number") payload.seed = input.seed;
    if (input.referenceImages?.length) payload.image_input = input.referenceImages;

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
