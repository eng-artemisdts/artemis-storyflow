import type {
  JobStatus,
  ProviderConfig,
  VideoGenInput,
  VideoGenProvider,
} from "@/lib/providers/types";

/**
 * Adapter Runway (Gen-4 Turbo / Gen-3).
 *
 * TODO: implementar via SDK oficial @runwayml/sdk:
 *   client.imageToVideo.create({ model, promptImage, promptText, duration })
 *   → task.id; consultar com client.tasks.retrieve(taskId)
 *   (status: PENDING | RUNNING | SUCCEEDED | FAILED).
 */
export class RunwayVideoProvider implements VideoGenProvider {
  readonly id = "runway";
  readonly label = "Runway";

  constructor(private config: ProviderConfig) {}

  async generateVideo(_input: VideoGenInput): Promise<{ jobId: string }> {
    throw new Error(
      `Provider "${this.id}" (model ${this.config.model}) ainda não implementado. Use fal.ai ou Replicate.`
    );
  }

  async getJobStatus(_jobId: string): Promise<JobStatus> {
    return { status: "failed", error: "Provider Runway não implementado" };
  }
}
