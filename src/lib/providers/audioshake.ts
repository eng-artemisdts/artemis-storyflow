import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { localUploadAbsolutePath } from "@/lib/local-uploads";
import { resolveProviderApiKey } from "@/lib/credentials";
import type {
  ProjectTranscription,
  TranscriptionSegment,
  TranscriptionWord,
} from "@/lib/transcription";
import { finalizeTranscriptionFromWords } from "@/lib/transcription";

const AUDIOSHAKE_BASE = "https://api.audioshake.ai";

export function getAudioshakeApiKey(): string {
  return resolveProviderApiKey("audioshake");
}

type AudioshakeTarget = {
  id: string;
  model: string;
  status: "processing" | "completed" | "error";
  formats: string[];
  output: Array<{ name: string; format: string; link: string }>;
  error?: { code: number; message: string } | null;
  language?: string;
  duration?: number;
};

type AudioshakeTask = {
  id: string;
  targets: AudioshakeTarget[];
};

function headers(apiKey: string, json = false): HeadersInit {
  return json
    ? { "Content-Type": "application/json", "x-api-key": apiKey }
    : { "x-api-key": apiKey };
}

async function audioshakeFetch(
  apiKey: string,
  pathname: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`${AUDIOSHAKE_BASE}${pathname}`, {
    ...init,
    headers: {
      ...headers(apiKey, init?.body != null && !(init.body instanceof FormData)),
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function uploadAudioshakeAsset(
  apiKey: string,
  data: Buffer,
  fileName: string,
  mimeType = "audio/mpeg"
): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(data)], { type: mimeType }),
    fileName
  );
  const res = await audioshakeFetch(apiKey, "/assets", {
    method: "POST",
    body: form,
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AudioShake upload falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("AudioShake não retornou assetId");
  return json.id;
}

export async function createAudioshakeAlignmentTask(input: {
  apiKey: string;
  assetId: string;
  language?: string | null;
  transcriptAssetId?: string | null;
}): Promise<string> {
  const target: Record<string, unknown> = {
    model: "alignment",
    formats: ["json"],
  };
  if (input.language?.trim()) target.language = input.language.trim().slice(0, 2).toLowerCase();
  if (input.transcriptAssetId) target.transcriptAssetId = input.transcriptAssetId;

  const res = await audioshakeFetch(input.apiKey, "/tasks", {
    method: "POST",
    body: JSON.stringify({
      assetId: input.assetId,
      targets: [target],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AudioShake create task falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("AudioShake não retornou task id");
  return json.id;
}

export async function getAudioshakeTask(apiKey: string, taskId: string): Promise<AudioshakeTask> {
  const res = await audioshakeFetch(apiKey, `/tasks/${encodeURIComponent(taskId)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AudioShake get task falhou (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as AudioshakeTask;
}

/** Resolve caminho local de um asset em /uploads/... */
export async function readLocalUploadBuffer(publicUrl: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  if (!publicUrl.startsWith("/uploads/")) {
    throw new Error("Áudio precisa estar em /uploads/ para transcrição local");
  }
  const relative = publicUrl.replace(/^\//, "");
  const filePath = localUploadAbsolutePath(publicUrl);
  const buffer = await readFile(filePath);
  return { buffer, fileName: path.basename(relative) };
}

/**
 * Mapeia idioma do canal (texto livre) para ISO 639-1 do AudioShake.
 */
export function guessAudioshakeLanguage(outputLanguage: string | null | undefined): string | null {
  if (!outputLanguage?.trim()) return null;
  const v = outputLanguage.trim().toLowerCase();
  if (v.length === 2) return v;
  if (v.includes("portugu") || v === "pt-br" || v === "pt_br") return "pt";
  if (v.includes("engl") || v.includes("inglês") || v.includes("ingles")) return "en";
  if (v.includes("span") || v.includes("espanh") || v.includes("castell")) return "es";
  if (v.includes("franç") || v.includes("franc")) return "fr";
  if (v.includes("deutsch") || v.includes("alem")) return "de";
  if (v.includes("ital")) return "it";
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function wordFromUnknown(raw: unknown): TranscriptionWord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = asText(o.text ?? o.word ?? o.token ?? o.lyric).trim();
  const start = asNumber(o.start ?? o.startTime ?? o.start_s ?? o.begin);
  const end = asNumber(o.end ?? o.endTime ?? o.end_s ?? o.finish);
  if (!text || start == null || end == null) return null;
  return { text, start, end };
}

function segmentFromUnknown(raw: unknown): TranscriptionSegment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = asText(o.text ?? o.line ?? o.lyric ?? o.content).trim();
  const start = asNumber(o.start ?? o.startTime ?? o.start_s ?? o.begin);
  const end = asNumber(o.end ?? o.endTime ?? o.end_s ?? o.finish);
  const wordsRaw = o.words ?? o.tokens ?? o.aligned_words;
  const words = Array.isArray(wordsRaw)
    ? (wordsRaw.map(wordFromUnknown).filter(Boolean) as TranscriptionWord[])
    : [];

  if (words.length > 0) {
    const segStart = start ?? words[0]!.start;
    const segEnd = end ?? words[words.length - 1]!.end;
    const segText = text || words.map((w) => w.text).join(" ");
    return { text: segText, start: segStart, end: segEnd, words };
  }

  if (!text || start == null || end == null) return null;
  return { text, start, end, words: [] };
}

/**
 * Normaliza o JSON do AudioShake (alignment/transcription) para nosso formato.
 * Aceita variações de schema que a API pode devolver.
 */
export function normalizeAudioshakeTranscriptJson(raw: unknown): {
  text: string;
  segments: TranscriptionSegment[];
} {
  let root: unknown = raw;
  if (typeof raw === "string") {
    try {
      root = JSON.parse(raw);
    } catch {
      return { text: raw, segments: [] };
    }
  }

  if (Array.isArray(root)) {
    const segments = root.map(segmentFromUnknown).filter(Boolean) as TranscriptionSegment[];
    if (segments.length > 0) {
      return { text: segments.map((s) => s.text).join("\n"), segments };
    }
    const words = root.map(wordFromUnknown).filter(Boolean) as TranscriptionWord[];
    if (words.length > 0) {
      const text = words.map((w) => w.text).join(" ");
      return {
        text,
        segments: [
          {
            text,
            start: words[0]!.start,
            end: words[words.length - 1]!.end,
            words,
          },
        ],
      };
    }
  }

  if (root && typeof root === "object") {
    const o = root as Record<string, unknown>;
    const candidates = [o.lines, o.segments, o.lyrics, o.transcript, o.results];
    for (const c of candidates) {
      if (Array.isArray(c)) {
        const parsed = normalizeAudioshakeTranscriptJson(c);
        if (parsed.segments.length > 0) {
          const text = asText(o.text) || parsed.text;
          return { text, segments: parsed.segments };
        }
      }
    }
    if (Array.isArray(o.words)) {
      const words = o.words.map(wordFromUnknown).filter(Boolean) as TranscriptionWord[];
      if (words.length > 0) {
        const text = asText(o.text) || words.map((w) => w.text).join(" ");
        return {
          text,
          segments: [
            {
              text,
              start: words[0]!.start,
              end: words[words.length - 1]!.end,
              words,
            },
          ],
        };
      }
    }
    const textOnly = asText(o.text ?? o.transcript);
    if (textOnly) return { text: textOnly, segments: [] };
  }

  return { text: "", segments: [] };
}

export async function downloadAndNormalizeTranscript(
  apiKey: string,
  taskId: string
): Promise<{
  status: "processing" | "completed" | "error";
  error?: string;
  transcription?: Omit<ProjectTranscription, "createdAt"> & { createdAt?: string };
}> {
  const task = await getAudioshakeTask(apiKey, taskId);
  const target = task.targets[0];
  if (!target) return { status: "error", error: "Task sem targets" };

  if (target.status === "processing") return { status: "processing" };
  if (target.status === "error") {
    return {
      status: "error",
      error: target.error?.message ?? "Falha na transcrição AudioShake",
    };
  }

  const jsonOut = target.output.find((o) => o.format === "json") ?? target.output[0];
  if (!jsonOut?.link) {
    return { status: "error", error: "AudioShake não retornou link do JSON" };
  }

  const fileRes = await fetch(jsonOut.link);
  if (!fileRes.ok) {
    return { status: "error", error: `Falha ao baixar JSON (${fileRes.status})` };
  }
  const rawJson = await fileRes.json();
  const normalized = normalizeAudioshakeTranscriptJson(rawJson);
  const allWords = normalized.segments.flatMap((s) => s.words);
  const finalized =
    allWords.length > 0
      ? finalizeTranscriptionFromWords(allWords, normalized.text)
      : { text: normalized.text, segments: normalized.segments };

  if (!finalized.text && finalized.segments.length === 0) {
    return { status: "error", error: "Transcrição vazia retornada pelo AudioShake" };
  }

  return {
    status: "completed",
    transcription: {
      text: finalized.text,
      language: target.language ?? null,
      model: "alignment",
      source: "audioshake",
      taskId,
      segments: finalized.segments,
    },
  };
}
