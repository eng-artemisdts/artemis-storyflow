import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { AiApiKeys, AiClientContext, AiProviders } from "@/lib/ai-settings";
import { DEFAULT_AI_PROVIDERS, mergeProviders } from "@/lib/ai-settings";

const aiContextStore = new AsyncLocalStorage<AiClientContext>();

/** Executa trabalho de IA com o contexto vindo do localStorage do cliente. */
export function runWithAiContext<T>(
  ctx: AiClientContext | null | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!ctx) return fn();
  return aiContextStore.run(ctx, fn);
}

export function getRequestAiContext(): AiClientContext | undefined {
  return aiContextStore.getStore();
}

/** Variáveis de fallback do dono do app, por provider. */
const ENV_FALLBACKS: Record<string, string | undefined> = {
  get fal() {
    return process.env.FAL_KEY;
  },
  get replicate() {
    return process.env.REPLICATE_API_TOKEN;
  },
  get anthropic() {
    return process.env.ANTHROPIC_API_KEY;
  },
  get openai() {
    return process.env.OPENAI_API_KEY;
  },
  get gemini() {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  },
  get runway() {
    return process.env.RUNWAY_API_KEY;
  },
  get xai() {
    return process.env.XAI_API_KEY;
  },
  get audioshake() {
    return process.env.AUDIOSHAKE_API_KEY;
  },
  get assemblyai() {
    return process.env.ASSEMBLYAI_API_KEY;
  },
  get "google-flow"() {
    return process.env.USEAPI_API_KEY;
  },
  get "google-flow-email"() {
    return process.env.GOOGLE_FLOW_EMAIL;
  },
};

/**
 * Resolve chave: contexto da request (localStorage) → .env → erro.
 */
export function resolveProviderApiKey(
  provider: string,
  clientKeys?: AiApiKeys | null
): string {
  const fromArg = clientKeys?.[provider]?.trim();
  if (fromArg) return fromArg;

  const fromStore = aiContextStore.getStore()?.apiKeys?.[provider]?.trim();
  if (fromStore) return fromStore;

  const fallback = ENV_FALLBACKS[provider];
  if (fallback) return fallback;

  throw new Error(
    `Nenhuma chave de API para "${provider}". Configure em Configurações → Chaves de API (ou no .env).`
  );
}

/** Email da conta Google Flow conectada em useapi.net (opcional — omitir usa load balancing). */
export function resolveGoogleFlowEmail(clientKeys?: AiApiKeys | null): string | null {
  const fromArg = clientKeys?.["google-flow-email"]?.trim();
  if (fromArg) return fromArg;

  const fromStore = aiContextStore.getStore()?.apiKeys?.["google-flow-email"]?.trim();
  if (fromStore) return fromStore;

  const fallback = ENV_FALLBACKS["google-flow-email"];
  return fallback?.trim() || null;
}

/** @deprecated Use resolveProviderApiKey — mantido para call sites antigos. */
export async function resolveApiKey(
  _projectId: string,
  provider: string
): Promise<string> {
  return resolveProviderApiKey(provider);
}

export function resolveProvidersFromClient(
  client?: Partial<AiProviders> | null
): AiProviders {
  const fromStore = aiContextStore.getStore()?.providers;
  return mergeProviders(client, fromStore, DEFAULT_AI_PROVIDERS);
}

export function resolveEnvLlm(): { providerId: string; apiKey: string; model: string } | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      providerId: "gemini",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      model: "gemini-2.5-flash",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      providerId: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      providerId: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-sonnet-4-20250514",
    };
  }
  return null;
}

export function resolveLlmFromClient(ai?: AiClientContext | null): {
  providerId: string;
  apiKey: string;
  model: string;
} {
  const providers = resolveProvidersFromClient(ai?.providers);
  try {
    const apiKey = resolveProviderApiKey(providers.llmProvider, ai?.apiKeys);
    return {
      providerId: providers.llmProvider,
      apiKey,
      model: providers.llmModel,
    };
  } catch (err) {
    const env = resolveEnvLlm();
    if (env) return env;
    throw err;
  }
}
