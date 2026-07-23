import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { publicUrlToAbsolutePath } from "@/lib/app-paths";
import type {
  ImageGenInput,
  ImageGenProvider,
  JobStatus,
  ProviderConfig,
} from "@/lib/providers/types";
import { storage } from "@/lib/storage";

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
}

type TrackedJob =
  | { status: "running" }
  | { status: "succeeded"; resultUrl: string }
  | { status: "failed"; error: string };

/**
 * A API de imagens da OpenAI é síncrona (sem fila). O adapter dispara a
 * geração em background, registra o resultado em memória (globalThis,
 * para sobreviver ao hot-reload do dev server) e responde ao polling
 * com um jobId sintético. Se o processo reiniciar no meio de uma
 * geração, o job é reportado como perdido.
 */
const globalJobs = globalThis as unknown as {
  __openaiImageJobs?: Map<string, TrackedJob>;
};

function jobsMap(): Map<string, TrackedJob> {
  globalJobs.__openaiImageJobs ??= new Map();
  return globalJobs.__openaiImageJobs;
}

/** Tamanhos aceitos por gpt-image-1/gpt-image-2. */
const SIZE_BY_RATIO: Record<string, string> = {
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:3": "1536x1024",
  "1:1": "1024x1024",
};

export class OpenAIImageProvider implements ImageGenProvider {
  readonly id = "openai";
  readonly label = "OpenAI (gpt-image)";

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
    const size = SIZE_BY_RATIO[input.aspectRatio ?? "16:9"] ?? "1536x1024";

    // Com referências usa /images/edits (multipart); sem, /images/generations.
    const response = input.referenceImages?.length
      ? await this.requestEdit(input.prompt, input.referenceImages, size)
      : await this.requestGeneration(input.prompt, size);

    const body = (await response.json()) as OpenAIImageResponse;
    if (!response.ok) {
      throw new Error(body.error?.message ?? `OpenAI respondeu ${response.status}`);
    }

    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new Error("Resposta da OpenAI sem imagem (b64_json ausente)");

    const localUrl = await storage.saveBuffer(
      Buffer.from(b64, "base64"),
      `openai-${jobId}`,
      ".png"
    );
    jobsMap().set(jobId, { status: "succeeded", resultUrl: localUrl });
  }

  private async requestGeneration(prompt: string, size: string): Promise<Response> {
    return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, prompt, size }),
    });
  }

  private async requestEdit(
    prompt: string,
    referenceImages: string[],
    size: string
  ): Promise<Response> {
    const form = new FormData();
    form.append("model", this.model);
    form.append("prompt", prompt);
    form.append("size", size);
    for (const [index, url] of referenceImages.entries()) {
      const blob = await loadImageAsBlob(url);
      form.append("image[]", blob, `reference-${index}.png`);
    }
    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
  }
}

/**
 * Carrega uma imagem de referência como Blob. Aceita URLs http(s) e
 * caminhos locais "/uploads/..." (gerados por este próprio provider).
 */
async function loadImageAsBlob(url: string): Promise<Blob> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar referência (${res.status}): ${url}`);
    return res.blob();
  }
  const filePath = publicUrlToAbsolutePath(url);
  const buffer = await readFile(filePath);
  return new Blob([new Uint8Array(buffer)], { type: "image/png" });
}
