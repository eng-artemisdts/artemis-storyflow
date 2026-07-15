import type { ScriptAnalysis } from "@/lib/schemas/script-analysis";

/** Status normalizado de um job assíncrono em qualquer provedor. */
export type JobState = "queued" | "running" | "succeeded" | "failed";

export interface JobStatus {
  status: JobState;
  /** URL do asset final no provedor (disponível quando succeeded). */
  resultUrl?: string;
  error?: string;
}

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3";

export interface ImageGenInput {
  prompt: string;
  /** URLs de imagens de referência — essencial p/ consistência de personagem. */
  referenceImages?: string[];
  aspectRatio?: AspectRatio;
  seed?: number;
}

export interface VideoGenInput {
  prompt: string;
  /** image-to-video a partir do keyframe da cena. */
  imageUrl?: string;
  /**
   * Vídeo-fonte para edição (Omni Flash / Grok Imagine).
   * Quando presente, o provider aplica `prompt` como instrução de edição
   * em cima deste clipe (não regenera do zero).
   */
  sourceVideoUrl?: string;
  /**
   * Interaction id Omni do clipe anterior (sem prefixo "omni:").
   * Permite edição stateful sem reenviar o arquivo.
   */
  previousInteractionId?: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16";
  withAudio?: boolean;
}

export interface ImageGenProvider {
  id: string;
  label: string;
  generateImage(input: ImageGenInput): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<JobStatus>;
}

export interface VideoGenProvider {
  id: string;
  label: string;
  generateVideo(input: VideoGenInput): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<JobStatus>;
}

export interface ScriptAnalysisProvider {
  id: string;
  label: string;
  analyzeScript(script: string): Promise<ScriptAnalysis>;
}

/** Configuração comum passada pelo registry a cada adapter. */
export interface ProviderConfig {
  apiKey: string;
  /** Endpoint/model id escolhido no projeto (ex.: "fal-ai/nano-banana-2"). */
  model: string;
}

export type ImageProviderId = "fal" | "replicate" | "gemini" | "openai";
export type VideoProviderId = "fal" | "replicate" | "runway" | "kling" | "gemini" | "xai";
export type LlmProviderId = "anthropic" | "openai" | "gemini";
