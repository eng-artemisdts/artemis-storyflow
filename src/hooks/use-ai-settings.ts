"use client";

import { useCallback, useEffect, useState } from "react";
import type { AiApiKeys, AiClientContext, AiProviders, AiSettingsState } from "@/lib/ai-settings";
import { DEFAULT_AI_PROVIDERS } from "@/lib/ai-settings";
import {
  apiKeyLast4,
  deleteAiApiKey,
  getAiClientContext,
  readAiSettings,
  saveAiApiKey,
  saveAiProviders,
} from "@/lib/ai-settings-storage";

export function useAiSettings() {
  const [state, setState] = useState<AiSettingsState>({
    providers: DEFAULT_AI_PROVIDERS,
    apiKeys: {},
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readAiSettings());
    setHydrated(true);
  }, []);

  const setProviders = useCallback((providers: AiProviders) => {
    setState(saveAiProviders(providers));
  }, []);

  const setApiKey = useCallback((provider: string, apiKey: string) => {
    setState(saveAiApiKey(provider, apiKey));
  }, []);

  const removeApiKey = useCallback((provider: string) => {
    setState(deleteAiApiKey(provider));
  }, []);

  const getClientContext = useCallback((): AiClientContext => getAiClientContext(), []);

  const last4 = useCallback(
    (provider: string) => apiKeyLast4(state.apiKeys, provider),
    [state.apiKeys]
  );

  return {
    hydrated,
    providers: state.providers,
    apiKeys: state.apiKeys as AiApiKeys,
    setProviders,
    setApiKey,
    removeApiKey,
    getClientContext,
    last4,
  };
}
