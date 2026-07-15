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

export type ProjectTranscription = {
  text: string;
  language: string | null;
  model: "alignment" | "transcription";
  source: "audioshake";
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

export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
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
