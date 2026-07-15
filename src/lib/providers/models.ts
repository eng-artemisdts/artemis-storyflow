/**
 * Catálogo de providers e modelos sugeridos para a UI.
 * O campo `value` é o id/endpoint enviado ao adapter — no fal.ai é o
 * endpoint da queue, no Replicate é "owner/name", nos LLMs é o model id.
 * Este arquivo é seguro para importar no cliente (não contém segredos).
 */

export interface ModelOption {
  value: string;
  label: string;
}

export interface ProviderOption {
  id: string;
  label: string;
  models: ModelOption[];
  implemented: boolean;
  keyUrl: string;
}

export const IMAGE_PROVIDERS: ProviderOption[] = [
  {
    id: "fal",
    label: "fal.ai",
    implemented: true,
    keyUrl: "https://fal.ai/dashboard/keys",
    models: [
      { value: "fal-ai/nano-banana-2", label: "Nano Banana 2 (multi-referência)" },
      { value: "fal-ai/nano-banana-pro", label: "Nano Banana Pro" },
      { value: "openai/gpt-image-2", label: "GPT Image 2 (tipografia/foto-realismo)" },
      { value: "fal-ai/flux-2", label: "FLUX.2 (multi-referência)" },
      { value: "fal-ai/flux/schnell", label: "FLUX Schnell (rápido/barato)" },
      { value: "fal-ai/bytedance/seedream/v4.5/text-to-image", label: "Seedream 4.5" },
    ],
  },
  {
    id: "replicate",
    label: "Replicate",
    implemented: true,
    keyUrl: "https://replicate.com/account/api-tokens",
    models: [
      { value: "google/nano-banana", label: "Nano Banana" },
      { value: "openai/gpt-image-2", label: "GPT Image 2" },
      { value: "black-forest-labs/flux-1.1-pro", label: "FLUX 1.1 Pro" },
      { value: "black-forest-labs/flux-schnell", label: "FLUX Schnell" },
      { value: "bytedance/seedream-4", label: "Seedream 4" },
    ],
  },
  {
    id: "gemini",
    label: "Google AI Studio",
    implemented: true,
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { value: "gemini-2.5-flash-image", label: "Nano Banana (Gemini 2.5 Flash Image)" },
      { value: "imagen-4.0-generate-001", label: "Imagen 4" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    implemented: true,
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { value: "gpt-image-2", label: "GPT Image 2" },
      { value: "gpt-image-1", label: "GPT Image 1" },
    ],
  },
];

export const VIDEO_PROVIDERS: ProviderOption[] = [
  {
    id: "fal",
    label: "fal.ai",
    implemented: true,
    keyUrl: "https://fal.ai/dashboard/keys",
    models: [
      {
        value: "fal-ai/kling-video/v3/standard/image-to-video",
        label: "Kling 3.0 Standard (i2v)",
      },
      { value: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", label: "Kling 2.5 Turbo Pro (i2v)" },
      { value: "fal-ai/veo3/fast/image-to-video", label: "Veo 3 Fast (i2v, com áudio)" },
      { value: "fal-ai/veo3.1/image-to-video", label: "Veo 3.1 (i2v, com áudio)" },
      { value: "fal-ai/wan-25-preview/image-to-video", label: "Wan 2.5 (i2v)" },
      { value: "fal-ai/bytedance/seedance/v1/pro/image-to-video", label: "Seedance 1 Pro (i2v)" },
    ],
  },
  {
    id: "replicate",
    label: "Replicate",
    implemented: true,
    keyUrl: "https://replicate.com/account/api-tokens",
    models: [
      { value: "kwaivgi/kling-v2.1", label: "Kling 2.1 (i2v)" },
      { value: "minimax/video-01", label: "MiniMax Hailuo" },
      { value: "wan-video/wan-2.5-i2v", label: "Wan 2.5 (i2v)" },
      { value: "google/veo-3-fast", label: "Veo 3 Fast" },
    ],
  },
  {
    id: "gemini",
    label: "Google AI Studio",
    implemented: true,
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { value: "veo-3.1-generate-preview", label: "Veo 3.1 (com áudio)" },
      { value: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast (com áudio)" },
      { value: "veo-3.0-generate-001", label: "Veo 3 (com áudio)" },
      { value: "veo-3.0-fast-generate-001", label: "Veo 3 Fast (com áudio)" },
      { value: "gemini-omni-flash-preview", label: "Omni Flash (vídeo + áudio, preview)" },
    ],
  },
  {
    id: "xai",
    label: "xAI (Grok Imagine)",
    implemented: true,
    keyUrl: "https://console.x.ai",
    models: [
      { value: "grok-imagine-video-1.5", label: "Grok Imagine Video 1.5 (i2v)" },
      { value: "grok-imagine-video", label: "Grok Imagine Video" },
    ],
  },
  {
    id: "runway",
    label: "Runway (stub)",
    implemented: false,
    keyUrl: "https://dev.runwayml.com",
    models: [
      { value: "gen4_turbo", label: "Gen-4 Turbo" },
      { value: "gen3a_turbo", label: "Gen-3 Alpha Turbo" },
    ],
  },
  {
    id: "kling",
    label: "Kling API oficial (stub)",
    implemented: false,
    keyUrl: "https://app.klingai.com/global/dev",
    models: [{ value: "kling-v2-1", label: "Kling 2.1" }],
  },
];

export const LLM_PROVIDERS: ProviderOption[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    implemented: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    implemented: true,
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { value: "gpt-5.2", label: "GPT-5.2" },
      { value: "gpt-5-mini", label: "GPT-5 mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
    ],
  },
  {
    id: "gemini",
    label: "Google (Gemini)",
    implemented: true,
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
];

/** Providers para os quais o usuário pode cadastrar chave (união de todos). */
export const CREDENTIAL_PROVIDERS: Array<{ id: string; label: string; keyUrl: string }> = [
  { id: "fal", label: "fal.ai", keyUrl: "https://fal.ai/dashboard/keys" },
  { id: "replicate", label: "Replicate", keyUrl: "https://replicate.com/account/api-tokens" },
  { id: "anthropic", label: "Anthropic", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", label: "Google AI Studio", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "xai", label: "xAI (Grok)", keyUrl: "https://console.x.ai" },
  { id: "runway", label: "Runway", keyUrl: "https://dev.runwayml.com" },
  { id: "kling", label: "Kling", keyUrl: "https://app.klingai.com/global/dev" },
];
