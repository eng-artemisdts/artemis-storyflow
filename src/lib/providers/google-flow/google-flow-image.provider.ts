import "server-only";
import { randomUUID } from "node:crypto";
import {
  generateGoogleFlowImage,
} from "@/lib/providers/google-flow/client";
import {
  GoogleFlowError,
  isGoogleFlowModerationError,
} from "@/lib/providers/google-flow/errors";
import type {
  ImageGenInput,
  ImageGenProvider,
  JobStatus,
  ProviderConfig,
} from "@/lib/providers/types";

type TrackedJob =
  | { status: "running" }
  | { status: "succeeded"; resultUrl: string }
  | { status: "failed"; error: string };

/**
 * Google Flow via useapi.net — POST /images síncrono.
 * JobId sintético em memória (mesmo padrão OpenAI/Gemini).
 */
const globalJobs = globalThis as unknown as {
  __googleFlowImageJobs?: Map<string, TrackedJob>;
};

function jobsMap(): Map<string, TrackedJob> {
  globalJobs.__googleFlowImageJobs ??= new Map();
  return globalJobs.__googleFlowImageJobs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class GoogleFlowImageProvider implements ImageGenProvider {
  readonly id = "google-flow";
  readonly label = "Google Flow (useapi)";

  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async generateImage(input: ImageGenInput): Promise<{ jobId: string }> {
    const jobId = randomUUID();
    jobsMap().set(jobId, { status: "running" });

    void this.run(jobId, input).catch((err: unknown) => {
      jobsMap().set(jobId, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return { jobId };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = jobsMap().get(jobId);
    if (!job) {
      return {
        status: "failed",
        error: "Job não encontrado em memória (o servidor foi reiniciado?). Gere novamente.",
      };
    }
    if (job.status === "running") return { status: "running" };
    if (job.status === "failed") return { status: "failed", error: job.error };
    return { status: "succeeded", resultUrl: job.resultUrl };
  }

  private async run(jobId: string, input: ImageGenInput): Promise<void> {
    if (input.referenceImages?.length) {
      throw new Error(
        "Referências de imagem no Google Flow ainda não estão implementadas. Use fal.ai ou Gemini."
      );
    }

    const imageUrl = await this.requestImageWithRetry(input);
    if (!imageUrl) {
      throw new Error("Google Flow não retornou imageUrl na resposta");
    }

    jobsMap().set(jobId, { status: "succeeded", resultUrl: imageUrl });
  }

  private async requestImageWithRetry(input: ImageGenInput): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await generateGoogleFlowImage({
          token: this.apiKey,
          prompt: input.prompt,
          model: this.model,
          aspectRatio: input.aspectRatio,
          seed: input.seed,
        });
        const url = res.media?.[0]?.imageUrl?.trim();
        if (!url) {
          throw new Error("Resposta do Google Flow sem imageUrl em media[0]");
        }
        return url;
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && isGoogleFlowModerationError(err)) {
          await sleep(1500);
          continue;
        }
        if (err instanceof GoogleFlowError && err.retryAfterMs) {
          await sleep(err.retryAfterMs);
          continue;
        }
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
