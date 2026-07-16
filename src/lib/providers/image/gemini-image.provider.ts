import { randomUUID } from "node:crypto";
import type {
  ImageGenInput,
  ImageGenProvider,
  JobStatus,
  ProviderConfig,
} from "@/lib/providers/types";
import { loadAssetBytes } from "@/lib/providers/asset-utils";
import { storage } from "@/lib/storage";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type TrackedJob =
  | { status: "running" }
  | { status: "succeeded"; resultUrl: string }
  | { status: "failed"; error: string };

/**
 * A API Gemini de imagem é síncrona (generateContent / predict). O adapter
 * dispara em background, guarda o resultado em memória (globalThis) e
 * responde ao polling com jobId sintético — mesmo padrão do OpenAI.
 */
const globalJobs = globalThis as unknown as {
  __geminiImageJobs?: Map<string, TrackedJob>;
};

function jobsMap(): Map<string, TrackedJob> {
  globalJobs.__geminiImageJobs ??= new Map();
  return globalJobs.__geminiImageJobs;
}

/** aspectRatio aceitos pelo Gemini Image / Imagen. */
const ASPECT_BY_RATIO: Record<string, string> = {
  "16:9": "16:9",
  "9:16": "9:16",
  "4:3": "4:3",
  "1:1": "1:1",
};

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
    finishReason?: string;
    safetyRatings?: Array<{
      category?: string;
      probability?: string;
      blocked?: boolean;
    }>;
  }>;
  error?: { message?: string; status?: string };
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
    safetyRatings?: Array<{
      category?: string;
      probability?: string;
      blocked?: boolean;
    }>;
  };
}

function summarizeSafetyRatings(
  ratings:
    | Array<{ category?: string; probability?: string; blocked?: boolean }>
    | undefined
): string | null {
  if (!ratings?.length) return null;
  const notable = ratings.filter(
    (r) =>
      r.blocked ||
      r.probability === "HIGH" ||
      r.probability === "MEDIUM" ||
      r.probability === "HARM_PROBABILITY_HIGH" ||
      r.probability === "HARM_PROBABILITY_MEDIUM"
  );
  const list = (notable.length ? notable : ratings).slice(0, 6);
  return list
    .map((r) => {
      const cat = (r.category ?? "?").replace(/^HARM_CATEGORY_/, "");
      const prob = (r.probability ?? "?").replace(/^HARM_PROBABILITY_/, "");
      return `${cat}:${prob}${r.blocked ? " (blocked)" : ""}`;
    })
    .join("; ");
}

/** Monta mensagem amigável + resposta do Gemini quando não há imagem. */
function formatGeminiNoImageError(json: GeminiGenerateResponse): string {
  const candidate = json.candidates?.[0];
  const finish = candidate?.finishReason;
  const textHint = (candidate?.content?.parts ?? [])
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .trim()
    .slice(0, 500);
  const ratings =
    summarizeSafetyRatings(candidate?.safetyRatings) ??
    summarizeSafetyRatings(json.promptFeedback?.safetyRatings);

  const isSafety =
    finish === "IMAGE_SAFETY" ||
    finish === "SAFETY" ||
    finish === "IMAGE_PROHIBITED_CONTENT" ||
    finish === "IMAGE_RECITATION" ||
    Boolean(json.promptFeedback?.blockReason);

  if (isSafety) {
    const reason =
      finish ??
      json.promptFeedback?.blockReason ??
      json.promptFeedback?.blockReasonMessage ??
      "SAFETY";
    const parts = [
      `Bloqueio de segurança do Gemini (${reason}).`,
      "A imagem foi filtrada pelas políticas de conteúdo do provedor.",
    ];
    if (textHint) parts.push(`Resposta do modelo: ${textHint}`);
    if (json.promptFeedback?.blockReasonMessage) {
      parts.push(`Detalhe: ${json.promptFeedback.blockReasonMessage}`);
    }
    if (ratings) parts.push(`Safety ratings: ${ratings}`);
    parts.push("Edite o prompt e tente novamente.");
    return parts.join(" ");
  }

  if (textHint) {
    return `Gemini não retornou imagem${finish ? ` (${finish})` : ""}: ${textHint}`;
  }
  return `Gemini não retornou imagem${finish ? ` (${finish})` : ""}`;
}

interface ImagenPredictResponse {
  predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  error?: { message?: string };
}

/**
 * Adapter Google AI Studio (Nano Banana / Imagen) via
 * generativelanguage.googleapis.com.
 *
 * - `gemini-*-image`: generateContent + responseModalities IMAGE
 * - `imagen-*`: predict (Imagen 4)
 */
export class GeminiImageProvider implements ImageGenProvider {
  readonly id = "gemini";
  readonly label = "Google AI Studio (Nano Banana / Imagen)";

  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  private get isImagen(): boolean {
    return /^imagen/i.test(this.model);
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

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", "x-goog-api-key": this.apiKey };
  }

  private async run(jobId: string, input: ImageGenInput): Promise<void> {
    const aspectRatio =
      ASPECT_BY_RATIO[input.aspectRatio ?? "16:9"] ?? "16:9";

    const { buffer, mimeType } = this.isImagen
      ? await this.requestImagen(input.prompt, aspectRatio)
      : await this.requestGeminiImage(input, aspectRatio);

    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : ".png";
    const localUrl = await storage.saveBuffer(buffer, `gemini-${jobId}`, ext);
    jobsMap().set(jobId, { status: "succeeded", resultUrl: localUrl });
  }

  /** Nano Banana: generateContent com modalities IMAGE (+ refs inline). */
  private async requestGeminiImage(
    input: ImageGenInput,
    aspectRatio: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];

    for (const url of input.referenceImages ?? []) {
      const { buffer, mimeType } = await loadAssetBytes(url);
      parts.push({
        inlineData: {
          mimeType,
          data: buffer.toString("base64"),
        },
      });
    }

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio },
      },
    };

    const res = await fetch(`${BASE_URL}/models/${this.model}:generateContent`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json()) as GeminiGenerateResponse;
    if (!res.ok) {
      throw new Error(
        json.error?.message ?? `Gemini Image respondeu ${res.status}`
      );
    }
    if (json.promptFeedback?.blockReason) {
      throw new Error(formatGeminiNoImageError(json));
    }

    const responseParts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new Error(formatGeminiNoImageError(json));
    }

    return {
      buffer: Buffer.from(imagePart.inlineData.data, "base64"),
      mimeType: imagePart.inlineData.mimeType || "image/png",
    };
  }

  /** Imagen 4 via :predict (sem referências de imagem). */
  private async requestImagen(
    prompt: string,
    aspectRatio: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    };

    const res = await fetch(`${BASE_URL}/models/${this.model}:predict`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json()) as ImagenPredictResponse;
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Imagen respondeu ${res.status}`);
    }

    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Resposta do Imagen sem imagem (bytesBase64Encoded ausente)");

    return {
      buffer: Buffer.from(b64, "base64"),
      mimeType: json.predictions?.[0]?.mimeType || "image/png",
    };
  }
}
