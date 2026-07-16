import { z } from "zod";

export const AiProvidersSchema = z.object({
  imageProvider: z.string().min(1),
  imageModel: z.string().min(1),
  videoProvider: z.string().min(1),
  videoModel: z.string().min(1),
  llmProvider: z.string().min(1),
  llmModel: z.string().min(1),
  transcriptionProvider: z.string().min(1).default("audioshake"),
  transcriptionModel: z.string().min(1).default("alignment"),
});

export type AiProviders = z.infer<typeof AiProvidersSchema>;

/** Chaves BYOK do usuário (provider id → api key). */
export type AiApiKeys = Record<string, string>;

export type AiSettingsState = {
  providers: AiProviders;
  /** Chaves em texto puro no localStorage (POC local / BYOK). */
  apiKeys: AiApiKeys;
};

export const DEFAULT_AI_PROVIDERS: AiProviders = {
  imageProvider: "fal",
  imageModel: "fal-ai/nano-banana-2",
  videoProvider: "fal",
  videoModel: "fal-ai/kling-video/v3/standard/image-to-video",
  llmProvider: "gemini",
  llmModel: "gemini-2.5-flash",
  transcriptionProvider: "audioshake",
  transcriptionModel: "alignment",
};

export const AI_SETTINGS_STORAGE_KEY = "storyflow.ai-settings.v1";
export const AI_CONTEXT_HEADER = "x-storyflow-ai-context";

/** Payload enviado pelo cliente às server actions / polling. */
export const AiClientContextSchema = z.object({
  providers: AiProvidersSchema,
  apiKeys: z.record(z.string(), z.string()).default({}),
});

export type AiClientContext = z.infer<typeof AiClientContextSchema>;

export function mergeProviders(
  ...layers: Array<Partial<AiProviders> | null | undefined>
): AiProviders {
  return {
    imageProvider:
      layers.map((l) => l?.imageProvider).find(Boolean) ?? DEFAULT_AI_PROVIDERS.imageProvider,
    imageModel: layers.map((l) => l?.imageModel).find(Boolean) ?? DEFAULT_AI_PROVIDERS.imageModel,
    videoProvider:
      layers.map((l) => l?.videoProvider).find(Boolean) ?? DEFAULT_AI_PROVIDERS.videoProvider,
    videoModel: layers.map((l) => l?.videoModel).find(Boolean) ?? DEFAULT_AI_PROVIDERS.videoModel,
    llmProvider: layers.map((l) => l?.llmProvider).find(Boolean) ?? DEFAULT_AI_PROVIDERS.llmProvider,
    llmModel: layers.map((l) => l?.llmModel).find(Boolean) ?? DEFAULT_AI_PROVIDERS.llmModel,
    transcriptionProvider:
      layers.map((l) => l?.transcriptionProvider).find(Boolean) ??
      DEFAULT_AI_PROVIDERS.transcriptionProvider,
    transcriptionModel:
      layers.map((l) => l?.transcriptionModel).find(Boolean) ??
      DEFAULT_AI_PROVIDERS.transcriptionModel,
  };
}
