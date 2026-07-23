import type {
  ImageGenProvider,
  ImageProviderId,
  LlmProviderId,
  ProviderConfig,
  ScriptAnalysisProvider,
  VideoGenProvider,
  VideoProviderId,
} from "@/lib/providers/types";
import { GoogleFlowImageProvider } from "@/lib/providers/google-flow/google-flow-image.provider";
import { FalImageProvider } from "@/lib/providers/image/fal-image.provider";
import { ReplicateImageProvider } from "@/lib/providers/image/replicate-image.provider";
import { GeminiImageProvider } from "@/lib/providers/image/gemini-image.provider";
import { OpenAIImageProvider } from "@/lib/providers/image/openai-image.provider";
import { FalVideoProvider } from "@/lib/providers/video/fal-video.provider";
import { ReplicateVideoProvider } from "@/lib/providers/video/replicate-video.provider";
import { RunwayVideoProvider } from "@/lib/providers/video/runway-video.provider";
import { KlingVideoProvider } from "@/lib/providers/video/kling-video.provider";
import { GoogleVideoProvider } from "@/lib/providers/video/google-video.provider";
import { XaiVideoProvider } from "@/lib/providers/video/xai-video.provider";
import { AnthropicProvider } from "@/lib/providers/llm/anthropic.provider";
import { OpenAIProvider } from "@/lib/providers/llm/openai.provider";
import { GeminiProvider } from "@/lib/providers/llm/gemini.provider";

/**
 * Factory central de providers (Strategy pattern).
 * Adicionar um novo provider = criar 1 arquivo + registrar aqui.
 */

type Factory<T> = (config: ProviderConfig) => T;

const imageProviders: Record<ImageProviderId, Factory<ImageGenProvider>> = {
  fal: (c) => new FalImageProvider(c),
  replicate: (c) => new ReplicateImageProvider(c),
  gemini: (c) => new GeminiImageProvider(c),
  openai: (c) => new OpenAIImageProvider(c),
  "google-flow": (c) => new GoogleFlowImageProvider(c),
};

const videoProviders: Record<VideoProviderId, Factory<VideoGenProvider>> = {
  fal: (c) => new FalVideoProvider(c),
  replicate: (c) => new ReplicateVideoProvider(c),
  runway: (c) => new RunwayVideoProvider(c),
  kling: (c) => new KlingVideoProvider(c),
  gemini: (c) => new GoogleVideoProvider(c),
  xai: (c) => new XaiVideoProvider(c),
};

const llmProviders: Record<LlmProviderId, Factory<ScriptAnalysisProvider>> = {
  anthropic: (c) => new AnthropicProvider(c),
  openai: (c) => new OpenAIProvider(c),
  gemini: (c) => new GeminiProvider(c),
};

function assertKnown<K extends string>(
  registry: Record<K, unknown>,
  id: string,
  kind: string
): asserts id is K {
  if (!(id in registry)) {
    throw new Error(`Provider de ${kind} desconhecido: "${id}"`);
  }
}

export function createImageProvider(
  providerId: string,
  apiKey: string,
  model: string
): ImageGenProvider {
  assertKnown(imageProviders, providerId, "imagem");
  return imageProviders[providerId]({ apiKey, model });
}

export function createVideoProvider(
  providerId: string,
  apiKey: string,
  model: string
): VideoGenProvider {
  assertKnown(videoProviders, providerId, "vídeo");
  return videoProviders[providerId]({ apiKey, model });
}

export function createLlmProvider(
  providerId: string,
  apiKey: string,
  model: string
): ScriptAnalysisProvider {
  assertKnown(llmProviders, providerId, "LLM");
  return llmProviders[providerId]({ apiKey, model });
}
