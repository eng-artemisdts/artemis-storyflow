import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import type { LlmProviderId } from "@/lib/providers/types";
import { brollTimesLookLikeMs } from "@/lib/brolls/normalize-times";
import {
  BrollPromptUpdatesSchema,
  BrollsLlmSchema,
  type ProjectBroll,
  type ProjectBrolls,
  parseProjectBrolls as parseProjectBrollsFromSchema,
} from "@/lib/schemas/brolls";
import type { ProjectTranscription } from "@/lib/transcription";
import { formatTimestamp, getNarrationTextForRange } from "@/lib/transcription";
import type { StylePreset } from "@/lib/style-presets";

function createLanguageModel(
  providerId: string,
  apiKey: string,
  model: string
): LanguageModel {
  switch (providerId as LlmProviderId) {
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    default:
      throw new Error(`Provider de LLM desconhecido: "${providerId}"`);
  }
}

/** Palavras no formato AssemblyAI (ms) que o prompt de b-rolls espera. */
export function transcriptionWordsToMsJson(
  transcription: ProjectTranscription
): Array<{ text: string; start: number; end: number }> {
  const words: Array<{ text: string; start: number; end: number }> = [];
  for (const seg of transcription.segments) {
    if (seg.words.length > 0) {
      for (const w of seg.words) {
        words.push({
          text: w.text,
          start: Math.round(w.start * 1000),
          end: Math.round(w.end * 1000),
        });
      }
    } else if (seg.text.trim()) {
      words.push({
        text: seg.text.trim(),
        start: Math.round(seg.start * 1000),
        end: Math.round(seg.end * 1000),
      });
    }
  }
  return words;
}

export function lastWordEndSeconds(transcription: ProjectTranscription): number {
  const words = transcriptionWordsToMsJson(transcription);
  if (words.length === 0) {
    const last = transcription.segments[transcription.segments.length - 1];
    return last?.end ?? 0;
  }
  return words[words.length - 1]!.end / 1000;
}

/**
 * Monta o STYLE SUFFIX a partir do preset do projeto (família generica
 * como base legível; o modelo de imagem aplicará o dialeto depois).
 */
export function buildStyleSuffix(
  preset: StylePreset | null,
  aspectRatio: string
): string {
  const aspect =
    aspectRatio === "9:16" ? "9:16 vertical" : "16:9 horizontal";
  const styleCore = preset
    ? preset.image.generic
    : "clean cinematic still, natural lighting, cohesive color grade";
  return `, ${styleCore}, ${aspect}, negative prompt: do not render the b-roll id number anywhere in the image, no id digits, no index numbers, no watermark numbering`;
}

export function buildBrollsSystemPrompt(input: {
  styleSuffix: string;
  styleLabel: string | null;
  styleDescription: string | null;
  channelNiche: string | null;
  channelDescription: string | null;
  aspectRatio: string;
}): string {
  const aspectNote =
    input.aspectRatio === "9:16"
      ? "Every image is 9:16 vertical."
      : "Every image is 16:9 horizontal.";

  const channelBits = [
    input.channelNiche ? `Channel niche: ${input.channelNiche}.` : null,
    input.channelDescription ? `Channel description: ${input.channelDescription}.` : null,
    input.styleLabel ? `Selected visual style: ${input.styleLabel}.` : null,
    input.styleDescription ? `Style notes: ${input.styleDescription}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `You are a b-roll image-prompt generator. You receive a word-level timestamp
(word-by-word transcription with start/end times in MILLISECONDS) and produce a JSON list of
b-roll image prompts, one per visual moment of the video.

── SEGMENTATION RULES (do not change) ──

- Start a new b-roll whenever the central visual concept changes.
- Minimum duration per b-roll: 3 seconds. Maximum: 7 seconds. Target average: ~5s.
- Cover 100% of the video timeline with no gaps and no overlaps.
- The timestamp_seconds of each b-roll MUST equal the exact start time (in seconds)
of the FIRST spoken word of that segment, taken directly from the word list
(convert milliseconds → seconds by dividing by 1000).
Never estimate or round when a word start is available.

── OUTPUT FORMAT (do not change) ──
Return ONLY the structured object matching the schema:
{"brolls":[
{"id":1,"timestamp_seconds":0.0,"concept":"short label of the moment","image_prompt":"full English image description ending with the style suffix"},
{"id":2,"timestamp_seconds":7.2,"concept":"...","image_prompt":"..."}
]}

- "id" is sequential starting at 1, no gaps.
- "concept" is a 2-5 word label (any language) for internal reference.
- "image_prompt" is a complete English description of the image, ALWAYS ending
with the exact STYLE SUFFIX defined below.
- ${aspectNote}

── STYLE SUFFIX (append verbatim to the end of EVERY image_prompt) ──
"${input.styleSuffix}"

── STYLE & CONTENT GUIDANCE ──
${channelBits || "Match the narration: one clear focal idea per image, never cluttered."}
Scenes must match what the narrator is saying in each segment. Prefer visual metaphors over literal screenshots when helpful. Never include: gore, real public figures, real company logos, cluttered UI screenshots. Keep the world visually consistent across all b-rolls for this video.

── RECURRING CHARACTER ──
This project may not have a recurring character reference. Do NOT invent a mandatory character unless the narration clearly describes a specific person repeatedly. When there is no person, depict objects, places, symbols, or atmospheres alone.`;
}

/** Monta o prompt completo (system + user) usado para gerar a lista de b-rolls. */
export function buildBrollsGenerationPromptParts(input: {
  transcription: ProjectTranscription;
  stylePreset: StylePreset | null;
  channelNiche: string | null;
  channelDescription: string | null;
  aspectRatio: string;
}): { system: string; user: string; styleSuffix: string } {
  const words = transcriptionWordsToMsJson(input.transcription);
  if (words.length === 0) {
    throw new Error("Transcrição sem palavras/timestamps. Gere a transcrição novamente.");
  }

  const styleSuffix = buildStyleSuffix(input.stylePreset, input.aspectRatio);
  const system = buildBrollsSystemPrompt({
    styleSuffix,
    styleLabel: input.stylePreset?.label ?? null,
    styleDescription: input.stylePreset?.description ?? null,
    channelNiche: input.channelNiche,
    channelDescription: input.channelDescription,
    aspectRatio: input.aspectRatio,
  });
  const user = `Here is the word-level timestamp JSON (milliseconds). Produce the b-rolls list.\n\n${JSON.stringify(words)}`;
  return { system, user, styleSuffix };
}

export function formatBrollsGenerationPromptMd(input: {
  projectName?: string | null;
  system: string;
  user: string;
}): string {
  const title = input.projectName?.trim()
    ? `B-rolls generation prompt — ${input.projectName.trim()}`
    : "B-rolls generation prompt";
  return [
    `# ${title}`,
    "",
    `Gerado em ${new Date().toISOString()}`,
    "",
    "## System",
    "",
    input.system.trim(),
    "",
    "## User",
    "",
    input.user.trim(),
    "",
  ].join("\n");
}

export async function generateBrollsFromTranscription(input: {
  providerId: string;
  apiKey: string;
  model: string;
  transcription: ProjectTranscription;
  stylePreset: StylePreset | null;
  styleId: string | null;
  aspectRatio: string;
  channelNiche: string | null;
  channelDescription: string | null;
  projectName?: string | null;
}): Promise<ProjectBrolls> {
  const { system, user } = buildBrollsGenerationPromptParts({
    transcription: input.transcription,
    stylePreset: input.stylePreset,
    channelNiche: input.channelNiche,
    channelDescription: input.channelDescription,
    aspectRatio: input.aspectRatio,
  });

  const languageModel = createLanguageModel(input.providerId, input.apiKey, input.model);
  const { object } = await generateObject({
    model: languageModel,
    schema: BrollsLlmSchema,
    system,
    prompt: user,
    maxOutputTokens: 16_384,
  });

  const audioEnd = lastWordEndSeconds(input.transcription);
  const enriched = enrichBrolls(object.brolls, audioEnd);
  const generationPromptMd = formatBrollsGenerationPromptMd({
    projectName: input.projectName,
    system,
    user,
  });

  return {
    brolls: enriched,
    styleId: input.styleId,
    styleLabel: input.stylePreset?.label ?? null,
    createdAt: new Date().toISOString(),
    generationPromptMd,
  };
}

/**
 * Reescreve somente os prompts visuais de um subconjunto de cenas usando as
 * configurações atuais. Deve receber lotes pequenos: uma chamada única com
 * todas as cenas de um vídeo longo estoura tokens de saída e dá timeout.
 * Retorna um mapa id → novo image_prompt.
 */
export async function refreshBrollPromptsBatch(input: {
  providerId: string;
  apiKey: string;
  model: string;
  transcription: ProjectTranscription;
  brolls: ProjectBroll[];
  stylePreset: StylePreset | null;
  aspectRatio: string;
  channelNiche: string | null;
  channelDescription: string | null;
}): Promise<Map<number, string>> {
  const styleSuffix = buildStyleSuffix(input.stylePreset, input.aspectRatio);
  const aspectNote =
    input.aspectRatio === "9:16"
      ? "Every image must be composed for 9:16 vertical."
      : "Every image must be composed for 16:9 horizontal.";
  const context = [
    input.channelNiche ? `Channel niche: ${input.channelNiche}.` : null,
    input.channelDescription
      ? `Channel description: ${input.channelDescription}.`
      : null,
    input.stylePreset?.label
      ? `Selected visual style: ${input.stylePreset.label}.`
      : null,
    input.stylePreset?.description
      ? `Style notes: ${input.stylePreset.description}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const system = `You update image prompts for an existing b-roll list using the project's current configuration.

Return exactly one item for every supplied b-roll, preserving every id. Do not add, remove, reorder, merge, or split scenes.
Rewrite only image_prompt. Keep each scene faithful to its narration and existing visual intent while applying the current channel, style, and aspect-ratio settings.
Each image_prompt must be a complete English image description and must end verbatim with this STYLE SUFFIX:
"${styleSuffix}"

${aspectNote}
${context || "Match each scene's narration with one clear focal idea."}
Keep the video visually cohesive. Never include gore, real public figures, real company logos, cluttered UI screenshots, IDs, index numbers, or watermark numbering.`;

  const scenes = input.brolls.map((broll) => ({
    id: broll.id,
    concept: broll.concept,
    start: broll.start,
    end: broll.end,
    narration: getNarrationTextForRange(
      input.transcription,
      broll.start,
      broll.end
    ),
    previous_prompt: broll.image_prompt,
  }));
  const user = `Update the image prompts for these existing b-rolls:\n\n${JSON.stringify(scenes)}`;

  const languageModel = createLanguageModel(
    input.providerId,
    input.apiKey,
    input.model
  );
  const { object } = await generateObject({
    model: languageModel,
    schema: BrollPromptUpdatesSchema,
    system,
    prompt: user,
    maxOutputTokens: 16_384,
  });

  const expectedIds = new Set(input.brolls.map((broll) => broll.id));
  const updates = new Map<number, string>();
  for (const update of object.brolls) {
    if (!expectedIds.has(update.id) || updates.has(update.id)) {
      throw new Error("A IA retornou IDs de b-roll inválidos ou duplicados.");
    }
    updates.set(update.id, update.image_prompt);
  }
  if (updates.size !== expectedIds.size) {
    throw new Error("A IA não retornou um prompt para todas as cenas.");
  }

  return updates;
}

export function enrichBrolls(
  raw: Array<{
    id: number;
    timestamp_seconds: number;
    concept: string;
    image_prompt: string;
  }>,
  audioEndSec: number
): ProjectBroll[] {
  // O LLM recebe words em ms e às vezes devolve timestamp_seconds em ms.
  const maxTs = raw.reduce((m, r) => Math.max(m, r.timestamp_seconds), 0);
  const scale = brollTimesLookLikeMs(maxTs, audioEndSec) ? 0.001 : 1;

  const sorted = [...raw]
    .map((item) => ({
      ...item,
      timestamp_seconds: Math.max(0, item.timestamp_seconds * scale),
    }))
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  return sorted.map((item, index) => {
    const start = Math.max(0, item.timestamp_seconds);
    const nextStart = sorted[index + 1]?.timestamp_seconds;
    const end =
      nextStart != null && nextStart > start
        ? nextStart
        : Math.max(start + 3, audioEndSec);
    const duration = Math.max(0.1, end - start);
    return {
      id: index + 1,
      concept: item.concept,
      image_prompt: item.image_prompt,
      start,
      end,
      duration,
      timestamp_seconds: start,
      timestamp_display: formatTimestamp(start),
      imageUrl: null,
    };
  });
}

export function parseProjectBrolls(raw: string | null | undefined): ProjectBrolls | null {
  return parseProjectBrollsFromSchema(raw);
}
