import type {
  JobStatus,
  ProviderConfig,
  VideoGenInput,
  VideoGenProvider,
} from "@/lib/providers/types";

/**
 * Adapter da API oficial Kling (api.klingai.com).
 *
 * TODO: implementar. A API oficial usa autenticação JWT (access key +
 * secret key) e endpoints /v1/videos/image2video (submit) e
 * /v1/videos/image2video/{task_id} (poll). Como alternativa pronta,
 * use o Kling via fal.ai (fal-ai/kling-video/...).
 */
export class KlingVideoProvider implements VideoGenProvider {
  readonly id = "kling";
  readonly label = "Kling (API oficial)";

  constructor(private config: ProviderConfig) {}

  async generateVideo(_input: VideoGenInput): Promise<{ jobId: string }> {
    throw new Error(
      `Provider "${this.id}" (model ${this.config.model}) ainda não implementado. Use o Kling via fal.ai.`
    );
  }

  async getJobStatus(_jobId: string): Promise<JobStatus> {
    return { status: "failed", error: "Provider Kling (oficial) não implementado" };
  }
}
