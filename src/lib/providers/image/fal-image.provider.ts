import { createFalClient, type FalClient } from "@fal-ai/client";
import type {
  ImageGenInput,
  ImageGenProvider,
  JobStatus,
  ProviderConfig,
} from "@/lib/providers/types";

interface FalImageResult {
  images?: Array<{ url: string }>;
  image?: { url: string };
}

/**
 * Adapter fal.ai para geração de imagem via queue API.
 * O endpoint do modelo é configurável (ex.: "fal-ai/nano-banana-2",
 * "fal-ai/flux-2", "fal-ai/bytedance/seedream/v4.5/text-to-image").
 */
export class FalImageProvider implements ImageGenProvider {
  readonly id = "fal";
  readonly label = "fal.ai (imagem)";

  private client: FalClient;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = createFalClient({ credentials: config.apiKey });
    this.model = config.model;
  }

  async generateImage(input: ImageGenInput): Promise<{ jobId: string }> {
    const { endpoint, payload } = this.buildRequest(input);
    const { request_id } = await this.client.queue.submit(endpoint, { input: payload });
    // Prefixo "edit:" para o polling usar o mesmo endpoint do submit.
    const jobId = endpoint.endsWith("/edit") ? `edit:${request_id}` : request_id;
    return { jobId };
  }

  /**
   * Os endpoints GPT Image (openai/gpt-image-*) têm schema próprio:
   * usam `image_size` em vez de `aspect_ratio` e as referências vão
   * para a rota /edit. Os demais modelos seguem o formato comum do fal.
   */
  private buildRequest(input: ImageGenInput): {
    endpoint: string;
    payload: Record<string, unknown>;
  } {
    const isGptImage = this.model.startsWith("openai/gpt-image");

    if (isGptImage) {
      const sizeByRatio: Record<string, string> = {
        "16:9": "landscape_16_9",
        "9:16": "portrait_16_9",
        "4:3": "landscape_4_3",
        "1:1": "square_hd",
      };
      const payload: Record<string, unknown> = {
        prompt: input.prompt,
        image_size: sizeByRatio[input.aspectRatio ?? "16:9"] ?? "landscape_16_9",
      };
      if (input.referenceImages?.length) {
        payload.image_urls = input.referenceImages;
        return { endpoint: `${this.model}/edit`, payload };
      }
      return { endpoint: this.model, payload };
    }

    const payload: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? "16:9",
    };
    if (typeof input.seed === "number") payload.seed = input.seed;
    // Nano Banana / FLUX.2 aceitam múltiplas referências para manter
    // consistência de personagem entre gerações.
    if (input.referenceImages?.length) payload.image_urls = input.referenceImages;
    return { endpoint: this.model, payload };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const isEdit = jobId.startsWith("edit:");
      const requestId = isEdit ? jobId.slice(5) : jobId;
      const endpoint = isEdit ? `${this.model}/edit` : this.model;

      const status = await this.client.queue.status(endpoint, {
        requestId,
        logs: false,
      });

      if (status.status === "COMPLETED") {
        const { data } = await this.client.queue.result(endpoint, { requestId });
        const result = data as FalImageResult;
        const url = result.images?.[0]?.url ?? result.image?.url;
        if (!url) return { status: "failed", error: "Resposta do fal.ai sem URL de imagem" };
        return { status: "succeeded", resultUrl: url };
      }
      if (status.status === "IN_PROGRESS") return { status: "running" };
      return { status: "queued" };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }
}
