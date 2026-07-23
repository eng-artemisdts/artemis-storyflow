import "server-only";
import {
  finalizeTranscriptionFromWords,
  type ProjectTranscription,
  type TranscriptionWord,
} from "@/lib/transcription";

const ASSEMBLYAI_BASE = "https://api.assemblyai.com";

type AssemblyAiWord = {
  text?: string;
  start?: number;
  end?: number;
  confidence?: number;
};

type AssemblyAiTranscript = {
  id?: string;
  status?: string;
  text?: string | null;
  language_code?: string | null;
  error?: string | null;
  words?: AssemblyAiWord[] | null;
};

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** AssemblyAI retorna start/end em milissegundos. */
function normalizeAssemblyAiWord(raw: AssemblyAiWord): TranscriptionWord | null {
  const text = (raw.text ?? "").trim();
  const startMs = asFinite(raw.start);
  const endMs = asFinite(raw.end);
  if (!text || startMs == null || endMs == null) return null;
  return { text, start: startMs / 1000, end: endMs / 1000 };
}

export function collectAssemblyAiWords(raw: AssemblyAiTranscript): TranscriptionWord[] {
  if (!Array.isArray(raw.words) || raw.words.length === 0) return [];
  return raw.words.map(normalizeAssemblyAiWord).filter(Boolean) as TranscriptionWord[];
}

export function normalizeAssemblyAiTranscript(raw: AssemblyAiTranscript): {
  text: string;
  language: string | null;
  segments: ReturnType<typeof finalizeTranscriptionFromWords>["segments"];
} {
  const words = collectAssemblyAiWords(raw);
  const finalized = finalizeTranscriptionFromWords(words, raw.text ?? undefined);
  return {
    text: finalized.text,
    language: raw.language_code?.trim() || null,
    segments: finalized.segments,
  };
}

async function uploadAudio(apiKey: string, buffer: Buffer): Promise<string> {
  const res = await fetch(`${ASSEMBLYAI_BASE}/v2/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AssemblyAI upload falhou (${res.status}): ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { upload_url?: string };
  if (!json.upload_url?.trim()) {
    throw new Error("AssemblyAI upload não retornou upload_url");
  }
  return json.upload_url;
}

/** IDs antigos → speech_models atuais (speech_model singular foi deprecado). */
const LEGACY_SPEECH_MODELS: Record<string, string> = {
  universal: "universal-3-5-pro",
  nano: "universal-2",
  best: "universal-3-5-pro",
};

function resolveSpeechModels(model: string): string[] {
  const raw = model.trim() || "universal-3-5-pro";
  const resolved = LEGACY_SPEECH_MODELS[raw] ?? raw;
  // Pro cobre 18 idiomas; universal-2 entra como fallback (99 idiomas).
  if (resolved === "universal-3-5-pro") {
    return ["universal-3-5-pro", "universal-2"];
  }
  return [resolved];
}

async function createTranscript(input: {
  apiKey: string;
  audioUrl: string;
  model: string;
}): Promise<string> {
  // Sempre detecta o idioma do áudio — não usar o idioma do canal
  // (ex.: canal em PT com narração em EN gerava transcrição errada).
  const body: Record<string, unknown> = {
    audio_url: input.audioUrl,
    speech_models: resolveSpeechModels(input.model),
    language_detection: true,
  };

  const res = await fetch(`${ASSEMBLYAI_BASE}/v2/transcript`, {
    method: "POST",
    headers: {
      authorization: input.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AssemblyAI transcript falhou (${res.status}): ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id?.trim()) {
    throw new Error("AssemblyAI não retornou id da transcrição");
  }
  return json.id;
}

async function pollTranscript(
  apiKey: string,
  transcriptId: string,
  opts?: { maxAttempts?: number; intervalMs?: number }
): Promise<AssemblyAiTranscript> {
  const maxAttempts = opts?.maxAttempts ?? 90;
  const intervalMs = opts?.intervalMs ?? 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${ASSEMBLYAI_BASE}/v2/transcript/${encodeURIComponent(transcriptId)}`, {
      headers: { authorization: apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AssemblyAI poll falhou (${res.status}): ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as AssemblyAiTranscript;
    if (json.status === "completed") return json;
    if (json.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${json.error ?? "erro desconhecido"}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("AssemblyAI: timeout aguardando transcrição");
}

/**
 * Upload → cria job → poll até completed.
 * Retorna formato normalizado com timestamps word-level (em segundos).
 * @see https://www.assemblyai.com/docs/pre-recorded-audio/getting-started/transcribe-an-audio-file
 */
export async function transcribeWithAssemblyAI(input: {
  apiKey: string;
  model: string;
  buffer: Buffer;
}): Promise<Omit<ProjectTranscription, "createdAt">> {
  const uploadUrl = await uploadAudio(input.apiKey, input.buffer);
  const model = resolveSpeechModels(input.model)[0]!;
  const transcriptId = await createTranscript({
    apiKey: input.apiKey,
    audioUrl: uploadUrl,
    model,
  });
  const raw = await pollTranscript(input.apiKey, transcriptId);
  const normalized = normalizeAssemblyAiTranscript(raw);

  if (!normalized.text && normalized.segments.length === 0) {
    throw new Error("Transcrição vazia retornada pela AssemblyAI");
  }

  return {
    text: normalized.text,
    language: normalized.language,
    model,
    source: "assemblyai",
    taskId: `assemblyai:${transcriptId}`,
    segments: normalized.segments,
  };
}
