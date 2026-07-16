import "server-only";
import type { AiProviders } from "@/lib/ai-settings";
import { DEFAULT_AI_PROVIDERS, mergeProviders } from "@/lib/ai-settings";
import { getRequestAiContext } from "@/lib/credentials";

export type { AiProviders };
export { DEFAULT_AI_PROVIDERS as DEFAULT_CHANNEL_AI_PROVIDERS };

/** Provedores efetivos: contexto do cliente (localStorage) → projeto → defaults. */
export function resolveAiProviders(
  project?: {
    imageProvider?: string | null;
    imageModel?: string | null;
    videoProvider?: string | null;
    videoModel?: string | null;
    llmProvider?: string | null;
    llmModel?: string | null;
    transcriptionProvider?: string | null;
    transcriptionModel?: string | null;
  } | null,
  _channel?: unknown
): AiProviders {
  const fromRequest = getRequestAiContext()?.providers;
  return mergeProviders(
    fromRequest,
    project
      ? {
          imageProvider: project.imageProvider ?? undefined,
          imageModel: project.imageModel ?? undefined,
          videoProvider: project.videoProvider ?? undefined,
          videoModel: project.videoModel ?? undefined,
          llmProvider: project.llmProvider ?? undefined,
          llmModel: project.llmModel ?? undefined,
          transcriptionProvider: project.transcriptionProvider ?? undefined,
          transcriptionModel: project.transcriptionModel ?? undefined,
        }
      : null,
    DEFAULT_AI_PROVIDERS
  );
}
