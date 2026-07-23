/** Formato normalizado de transcrição alinhada (salvo em Project.transcriptionJson). */

export type TranscriptionWord = {
  text: string;
  start: number;
  end: number;
};

export type TranscriptionSegment = {
  text: string;
  start: number;
  end: number;
  words: TranscriptionWord[];
};

export type TranscriptionSource = "audioshake" | "openai" | "assemblyai";

export type ProjectTranscription = {
  text: string;
  language: string | null;
  /** Modelo/endpoint usado (ex.: alignment, whisper-1). */
  model: string;
  source: TranscriptionSource;
  taskId: string;
  segments: TranscriptionSegment[];
  createdAt: string;
};

export function parseProjectTranscription(raw: string | null | undefined): ProjectTranscription | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as ProjectTranscription;
    if (!data || !Array.isArray(data.segments)) return null;
    return data;
  } catch {
    return null;
  }
}

function roundTime(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/**
 * Remove timestamps impossíveis (alucinação típica do Whisper: 1 palavra cobrindo 30s).
 */
export function sanitizeTranscriptionWords(
  words: TranscriptionWord[],
  opts?: { maxWordDurationSec?: number }
): TranscriptionWord[] {
  const maxDur = opts?.maxWordDurationSec ?? 2.5;
  const cleaned: TranscriptionWord[] = [];
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
    if (w.end <= w.start) continue;
    if (w.end - w.start > maxDur) continue;
    cleaned.push({ text, start: roundTime(w.start), end: roundTime(w.end) });
  }
  cleaned.sort((a, b) => a.start - b.start || a.end - b.end);
  return cleaned;
}

function endsCueSentence(text: string): boolean {
  return /[.!?…]["”']?$/.test(text.trim());
}

/**
 * Agrupa words em cues legíveis (frases), em vez de parágrafos gigantes ou
 * segmentos quebrados da API.
 */
export function buildCueSegmentsFromWords(
  words: TranscriptionWord[],
  opts?: { maxDurationSec?: number; maxWords?: number }
): TranscriptionSegment[] {
  const maxDurationSec = opts?.maxDurationSec ?? 8;
  const maxWords = opts?.maxWords ?? 22;
  const sanitized = sanitizeTranscriptionWords(words);
  if (sanitized.length === 0) return [];

  const segments: TranscriptionSegment[] = [];
  let buf: TranscriptionWord[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    segments.push({
      text: buf.map((w) => w.text).join(" "),
      start: buf[0]!.start,
      end: buf[buf.length - 1]!.end,
      words: buf,
    });
    buf = [];
  };

  for (const w of sanitized) {
    if (buf.length === 0) {
      buf.push(w);
      continue;
    }
    const start = buf[0]!.start;
    const wouldDuration = w.end - start;
    const wouldWords = buf.length + 1;
    if (wouldDuration > maxDurationSec || wouldWords > maxWords) {
      flush();
      buf.push(w);
      continue;
    }
    buf.push(w);
    if (endsCueSentence(w.text)) flush();
  }
  flush();
  return segments;
}

/** Reconstrói segments a partir das words (fonte de verdade dos timestamps). */
export function finalizeTranscriptionFromWords(
  words: TranscriptionWord[],
  fallbackText?: string
): { text: string; segments: TranscriptionSegment[] } {
  const segments = buildCueSegmentsFromWords(words);
  const text =
    segments.map((s) => s.text).join("\n").trim() ||
    fallbackText?.trim() ||
    sanitizeTranscriptionWords(words)
      .map((w) => w.text)
      .join(" ");
  return { text, segments };
}

export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const totalMs = Math.round(seconds * 10);
  const tenths = totalMs % 10;
  const total = Math.floor(totalMs / 10);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
  }
  return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

/** Duração aproximada da transcrição (fim da última palavra/segmento). */
export function transcriptionDurationSec(
  transcription: ProjectTranscription | null | undefined
): number | null {
  if (!transcription?.segments.length) return null;
  const last = transcription.segments[transcription.segments.length - 1]!;
  const wordEnd = transcription.segments
    .flatMap((s) => s.words)
    .reduce((max, w) => Math.max(max, w.end), 0);
  const end = Math.max(last.end, wordEnd);
  return end > 0 ? end : null;
}

/**
 * Texto da narração falado no intervalo [startSec, endSec).
 * Prefere palavras word-level; cai para segmentos se não houver words.
 */
export function getNarrationTextForRange(
  transcription: ProjectTranscription | null | undefined,
  startSec: number,
  endSec: number
): string {
  if (!transcription?.segments.length) return "";
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
    return "";
  }

  const words: string[] = [];
  for (const seg of transcription.segments) {
    if (seg.words.length > 0) {
      for (const w of seg.words) {
        // Inclui palavra se o centro (ou overlap) cai no intervalo do b-roll.
        const mid = (w.start + w.end) / 2;
        const overlaps = w.end > startSec && w.start < endSec;
        if (overlaps || (mid >= startSec && mid < endSec)) {
          const t = w.text.trim();
          if (t) words.push(t);
        }
      }
    } else if (seg.end > startSec && seg.start < endSec && seg.text.trim()) {
      words.push(seg.text.trim());
    }
  }

  return words.join(" ").replace(/\s+/g, " ").trim();
}


/** Payload enxuto para download `{projeto}-timestamp.json`. */
export function buildTimestampExportPayload(transcription: ProjectTranscription) {
  return {
    text: transcription.text,
    language: transcription.language,
    model: transcription.model,
    source: transcription.source,
    createdAt: transcription.createdAt,
    segments: transcription.segments.map((seg) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      words: seg.words.map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    })),
  };
}

export function slugifyForFilename(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "projeto";
}

export function downloadTimestampJson(
  transcription: ProjectTranscription,
  projectName: string
): void {
  const payload = buildTimestampExportPayload(transcription);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyForFilename(projectName)}-timestamp.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadBrollsJson(
  brolls: { brolls: unknown[]; styleId?: string | null; styleLabel?: string | null; createdAt?: string },
  projectName: string
): void {
  const payload = {
    brolls: brolls.brolls,
    styleId: brolls.styleId ?? null,
    styleLabel: brolls.styleLabel ?? null,
    createdAt: brolls.createdAt ?? new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyForFilename(projectName)}-brolls.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Baixa o prompt de geração de b-rolls (system + user) como arquivo Markdown. */
export function downloadBrollsPromptMd(markdown: string, projectName: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyForFilename(projectName)}-brolls-prompt.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
