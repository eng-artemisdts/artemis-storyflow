import type {
  JobStatus,
  ProviderConfig,
  VideoGenInput,
  VideoGenProvider,
} from "@/lib/providers/types";
import { loadAssetBytes } from "@/lib/providers/asset-utils";
import { storage } from "@/lib/storage";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Adapter Google AI Studio (Gemini API) para geração de vídeo.
 * Suporta duas famílias, cada uma com seu protocolo:
 *
 * - Veo 3 / 3.1 (`veo-*`): POST models/{model}:predictLongRunning →
 *   polling da operation → download do vídeo com a chave no header.
 * - Omni Flash (`gemini-omni-flash-preview`): Interactions API
 *   (POST /interactions com background) → polling da interação →
 *   polling do arquivo (delivery "uri") → download.
 *   Baseado no POC omni-flash-lab.
 *
 * O jobId carrega o protocolo como prefixo ("veo:" | "omni:") para o
 * polling ser stateless entre requests.
 */
export class GoogleVideoProvider implements VideoGenProvider {
  readonly id = "gemini";
  readonly label = "Google AI Studio (vídeo)";

  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  private get isOmni(): boolean {
    return /omni/i.test(this.model);
  }

  async generateVideo(input: VideoGenInput): Promise<{ jobId: string }> {
    return this.isOmni ? this.submitOmni(input) : this.submitVeo(input);
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      if (jobId.startsWith("omni:")) return await this.pollOmni(jobId.slice(5));
      if (jobId.startsWith("veo:")) return await this.pollVeo(jobId.slice(4));
      return { status: "failed", error: `jobId inválido: ${jobId}` };
    } catch (err) {
      return { status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", "x-goog-api-key": this.apiKey };
  }

  // ── Veo 3 / 3.1 (predictLongRunning) ────────────────────────────

  private async submitVeo(input: VideoGenInput): Promise<{ jobId: string }> {
    if (input.sourceVideoUrl) {
      throw new Error(
        "Edição de vídeo não é suportada pelo Veo neste adapter. Use Omni Flash ou xAI (Grok)."
      );
    }
    const instance: Record<string, unknown> = { prompt: input.prompt };
    if (input.imageUrl) {
      const { buffer, mimeType } = await loadAssetBytes(input.imageUrl);
      instance.image = { inlineData: { mimeType, data: buffer.toString("base64") } };
    }

    const body = {
      instances: [instance],
      parameters: {
        aspectRatio: input.aspectRatio ?? "16:9",
        durationSeconds: String(clampVeoDuration(input.durationSeconds)),
      },
    };

    const res = await fetch(`${BASE_URL}/models/${this.model}:predictLongRunning`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json()) as { name?: string; error?: { message?: string } };
    if (!res.ok || !json.name) {
      throw new Error(json.error?.message ?? `Veo respondeu ${res.status} sem operation name`);
    }
    return { jobId: `veo:${json.name}` };
  }

  private async pollVeo(operationName: string): Promise<JobStatus> {
    const res = await fetch(`${BASE_URL}/${operationName}`, {
      headers: this.headers(),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
          raiMediaFilteredReasons?: string[];
        };
      };
    };
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Polling do Veo respondeu ${res.status}`);
    }
    if (!json.done) return { status: "running" };
    if (json.error) {
      return { status: "failed", error: json.error.message ?? "Operação Veo falhou" };
    }

    const videoResponse = json.response?.generateVideoResponse;
    const uri = videoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) {
      const filtered = videoResponse?.raiMediaFilteredReasons?.join("; ");
      return {
        status: "failed",
        error: filtered
          ? `Vídeo bloqueado pelos filtros de segurança: ${filtered}`
          : "Operação Veo concluída sem URI de vídeo",
      };
    }

    // O download exige a chave no header e segue redirects — não dá
    // para delegar ao storage.saveFromUrl. Salva local e retorna a URL.
    const localUrl = await this.downloadToStorage(uri, "veo");
    return { status: "succeeded", resultUrl: localUrl };
  }

  // ── Omni Flash (Interactions API) ───────────────────────────────

  private async submitOmni(input: VideoGenInput): Promise<{ jobId: string }> {
    // Edição: preferir previous_interaction_id; senão sobe o clipe (Files API).
    if (input.sourceVideoUrl || input.previousInteractionId) {
      return this.submitOmniEdit({
        sourceVideoUrl: input.sourceVideoUrl,
        previousInteractionId: input.previousInteractionId,
        editPrompt: input.prompt,
        aspectRatio: input.aspectRatio,
      });
    }

    let prompt = input.prompt;
    let interactionInput: unknown = prompt;

    if (input.imageUrl) {
      const { buffer, mimeType } = await loadAssetBytes(input.imageUrl);
      // <FIRST_FRAME> fixa a imagem como frame inicial (image_to_video).
      prompt = `Use <FIRST_FRAME> as the exact first frame of the video. ${prompt}`;
      interactionInput = [
        { type: "image", data: buffer.toString("base64"), mime_type: mimeType },
        { type: "text", text: prompt },
      ];
    }

    const body: Record<string, unknown> = {
      model: this.model,
      input: interactionInput,
      // "uri" evita o limite (~4MB) da entrega inline em base64.
      response_format: {
        type: "video",
        aspect_ratio: input.aspectRatio ?? "16:9",
        delivery: "uri",
      },
      // Assíncrono: a resposta volta imediatamente com status in_progress.
      // A API exige store=true quando background=true.
      background: true,
      store: true,
    };
    if (input.imageUrl) {
      body.generation_config = { video_config: { task: "image_to_video" } };
    }

    const res = await fetch(`${BASE_URL}/interactions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      throw new Error(json.error?.message ?? `Omni respondeu ${res.status} sem id de interação`);
    }
    return { jobId: `omni:${json.id}` };
  }

  private async submitOmniEdit(params: {
    sourceVideoUrl?: string;
    previousInteractionId?: string;
    editPrompt: string;
    aspectRatio?: "16:9" | "9:16";
  }): Promise<{ jobId: string }> {
    const prompt = `${params.editPrompt.trim()}. Keep everything else the same.`;
    const body: Record<string, unknown> = {
      model: this.model,
      response_format: {
        type: "video",
        aspect_ratio: params.aspectRatio ?? "16:9",
        delivery: "uri",
      },
      background: true,
      store: true,
    };

    if (params.previousInteractionId) {
      // Edição stateful: a API rejeita previous_interaction_id + video task juntos.
      body.previous_interaction_id = params.previousInteractionId;
      body.input = prompt;
    } else if (params.sourceVideoUrl) {
      // Upload próprio: task=edit exige um input type=video (document não conta).
      const file = await this.uploadVideoFile(params.sourceVideoUrl);
      await this.waitForFileActive(file.name);
      body.input = [
        { type: "video", uri: file.uri, mime_type: file.mimeType },
        { type: "text", text: prompt },
      ];
      body.generation_config = { video_config: { task: "edit" } };
    } else {
      throw new Error("Edição Omni exige vídeo-fonte ou previous_interaction_id");
    }

    const res = await fetch(`${BASE_URL}/interactions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      throw new Error(json.error?.message ?? `Omni edit respondeu ${res.status} sem id`);
    }
    return { jobId: `omni:${json.id}` };
  }

  /** Upload resumable da Files API (mesmo protocolo do omni-flash-lab). */
  private async uploadVideoFile(
    sourceVideoUrl: string
  ): Promise<{ name: string; uri: string; mimeType: string }> {
    const { buffer, mimeType } = await loadAssetBytes(sourceVideoUrl);
    const videoMime = mimeType.includes("video") ? mimeType : "video/mp4";
    const blob = new Blob([new Uint8Array(buffer)], { type: videoMime });

    const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(blob.size),
        "X-Goog-Upload-Header-Content-Type": blob.type,
      },
      body: JSON.stringify({ file: { display_name: `edit-source-${Date.now()}.mp4` } }),
      cache: "no-store",
    });
    if (!start.ok) {
      throw new Error(`Falha ao iniciar upload do vídeo (${start.status})`);
    }
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!uploadUrl) throw new Error("Files API não retornou URL de upload");

    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": String(blob.size),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: blob,
      cache: "no-store",
    });
    if (!upload.ok) {
      throw new Error(`Falha no upload do vídeo para edição (${upload.status})`);
    }
    const payload = (await upload.json()) as {
      file?: { name?: string; uri?: string };
    };
    if (!payload.file?.name || !payload.file?.uri) {
      throw new Error("Upload do vídeo concluído sem name/uri");
    }
    return { name: payload.file.name, uri: payload.file.uri, mimeType: videoMime };
  }

  private async waitForFileActive(fileName: string): Promise<void> {
    const normalized = fileName.startsWith("files/") ? fileName : `files/${fileName}`;
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await fetch(`${BASE_URL}/${normalized}`, {
        headers: this.headers(),
        cache: "no-store",
      });
      const file = (await res.json()) as { state?: string; error?: { message?: string } };
      if (!res.ok) {
        throw new Error(file.error?.message ?? `Files API respondeu ${res.status}`);
      }
      if (file.state === "ACTIVE") return;
      if (file.state === "FAILED") {
        throw new Error("Processamento do vídeo-fonte falhou na Files API");
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Timeout aguardando o vídeo-fonte ficar ACTIVE");
  }

  private async pollOmni(interactionId: string): Promise<JobStatus> {
    const res = await fetch(`${BASE_URL}/interactions/${interactionId}`, {
      headers: this.headers(),
      cache: "no-store",
    });
    const json = (await res.json()) as OmniInteraction & { error?: { message?: string } };
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Polling do Omni respondeu ${res.status}`);
    }

    if (json.status === "failed") {
      return { status: "failed", error: "A interação Omni falhou no provedor" };
    }
    if (json.status !== "completed") return { status: "running" };

    const video = extractOmniVideo(json);
    if (!video) {
      return { status: "failed", error: "Interação Omni concluída sem vídeo na resposta" };
    }

    // Entrega inline (fallback): base64 direto na resposta.
    if (video.data) {
      const localUrl = await storage.saveBuffer(
        Buffer.from(video.data, "base64"),
        `omni-${interactionId.slice(0, 8)}`,
        ".mp4"
      );
      return { status: "succeeded", resultUrl: localUrl };
    }

    // Entrega por URI: aguarda o arquivo ficar ACTIVE na Files API.
    const fileName = video.uri ? extractFileName(video.uri) : null;
    if (!fileName) {
      return { status: "failed", error: `URI de vídeo Omni não reconhecida: ${video.uri}` };
    }

    const fileRes = await fetch(`${BASE_URL}/${fileName}`, {
      headers: this.headers(),
      cache: "no-store",
    });
    const file = (await fileRes.json()) as { state?: string; error?: { message?: string } };
    if (!fileRes.ok) {
      throw new Error(file.error?.message ?? `Files API respondeu ${fileRes.status}`);
    }
    if (file.state === "FAILED") {
      return { status: "failed", error: "Processamento do arquivo de vídeo falhou (Files API)" };
    }
    if (file.state !== "ACTIVE") return { status: "running" };

    const localUrl = await this.downloadToStorage(
      `${BASE_URL}/${fileName}:download?alt=media`,
      "omni"
    );
    return { status: "succeeded", resultUrl: localUrl };
  }

  /** Baixa o vídeo autenticado (header x-goog-api-key) e salva no storage local. */
  private async downloadToStorage(url: string, prefix: string): Promise<string> {
    const res = await fetch(url, {
      headers: { "x-goog-api-key": this.apiKey },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Falha ao baixar o vídeo do Google (${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return storage.saveBuffer(buffer, `${prefix}-video-${Date.now()}`, ".mp4");
  }
}

// ── Helpers Omni ───────────────────────────────────────────────────

interface OmniVideoPart {
  type?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
}

interface OmniInteraction {
  id?: string;
  status?: string;
  output_video?: OmniVideoPart;
  steps?: Array<{ type?: string; content?: OmniVideoPart[] | OmniVideoPart }>;
}

function extractOmniVideo(interaction: OmniInteraction): OmniVideoPart | null {
  if (interaction.output_video) return interaction.output_video;
  for (const step of interaction.steps ?? []) {
    if (step.type !== "model_output") continue;
    const parts = Array.isArray(step.content) ? step.content : step.content ? [step.content] : [];
    const video = parts.find((p) => p.type === "video" && (p.data || p.uri));
    if (video) return video;
  }
  return null;
}

/** Extrai "files/{id}" de uma URI da Files API. */
function extractFileName(uri: string): string | null {
  const match = uri.match(/files\/[^/:?#]+/);
  return match ? match[0] : null;
}

/** Veo aceita apenas 4, 6 ou 8 segundos. */
function clampVeoDuration(seconds: number | undefined): number {
  if (!seconds || seconds >= 8) return 8;
  if (seconds >= 6) return 6;
  return 4;
}
