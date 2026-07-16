import "server-only";
import {
  finalizeTranscriptionFromWords,
  type ProjectTranscription,
  type TranscriptionWord,
} from "@/lib/transcription";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

type OpenAiVerboseWord = {
  word?: string;
  text?: string;
  start?: number;
  end?: number;
};

type OpenAiVerboseSegment = {
  text?: string;
  start?: number;
  end?: number;
  words?: OpenAiVerboseWord[];
};

type OpenAiVerboseJson = {
  text?: string;
  language?: string;
  words?: OpenAiVerboseWord[];
  segments?: OpenAiVerboseSegment[];
};

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeOpenAiWord(raw: OpenAiVerboseWord): TranscriptionWord | null {
  const text = (raw.word ?? raw.text ?? "").trim();
  const start = asFinite(raw.start);
  const end = asFinite(raw.end);
  if (!text || start == null || end == null) return null;
  return { text, start, end };
}

/**
 * Extrai words da resposta Whisper. Prefere o array top-level `words`;
 * se ausente, tenta words aninhadas nos segments.
 */
export function collectOpenAiWords(raw: OpenAiVerboseJson): TranscriptionWord[] {
  if (Array.isArray(raw.words) && raw.words.length > 0) {
    return raw.words.map(normalizeOpenAiWord).filter(Boolean) as TranscriptionWord[];
  }
  const nested: TranscriptionWord[] = [];
  if (Array.isArray(raw.segments)) {
    for (const seg of raw.segments) {
      if (!Array.isArray(seg.words)) continue;
      for (const w of seg.words) {
        const n = normalizeOpenAiWord(w);
        if (n) nested.push(n);
      }
    }
  }
  return nested;
}

/**
 * Converte verbose_json do Whisper. Usa palavras como fonte de verdade
 * (segments da API misturam texto errado com timestamps ruins).
 */
export function normalizeOpenAiVerboseJson(raw: OpenAiVerboseJson): {
  text: string;
  language: string | null;
  segments: ReturnType<typeof finalizeTranscriptionFromWords>["segments"];
} {
  const words = collectOpenAiWords(raw);
  const finalized = finalizeTranscriptionFromWords(words, raw.text);
  return {
    text: finalized.text,
    language: raw.language?.trim() || null,
    segments: finalized.segments,
  };
}

export async function transcribeWithOpenAI(input: {
  apiKey: string;
  model: string;
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  language?: string | null;
}): Promise<Omit<ProjectTranscription, "createdAt">> {
  const mimeType = input.mimeType ?? "audio/mpeg";
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(input.buffer)], { type: mimeType }),
    input.fileName
  );
  form.append("model", input.model || "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  // FormData: repetir a chave com [] para arrays (requerido pela API OpenAI).
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");

  if (input.language?.trim()) {
    form.append("language", input.language.trim().slice(0, 2).toLowerCase());
  }

  const res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI transcription falhou (${res.status}): ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as OpenAiVerboseJson;
  const normalized = normalizeOpenAiVerboseJson(json);
  if (!normalized.text && normalized.segments.length === 0) {
    throw new Error("Transcrição vazia retornada pela OpenAI");
  }

  const taskId = `openai:${Date.now()}`;
  return {
    text: normalized.text,
    language: normalized.language,
    model: input.model || "whisper-1",
    source: "openai",
    taskId,
    segments: normalized.segments,
  };
}
