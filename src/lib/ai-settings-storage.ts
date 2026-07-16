"use client";

import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_PROVIDERS,
  type AiApiKeys,
  type AiClientContext,
  type AiProviders,
  type AiSettingsState,
} from "@/lib/ai-settings";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readAiSettings(): AiSettingsState {
  if (!canUseStorage()) {
    return { providers: DEFAULT_AI_PROVIDERS, apiKeys: {} };
  }
  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { providers: DEFAULT_AI_PROVIDERS, apiKeys: {} };
    const parsed = JSON.parse(raw) as Partial<AiSettingsState>;
    return {
      providers: { ...DEFAULT_AI_PROVIDERS, ...parsed.providers },
      apiKeys: parsed.apiKeys && typeof parsed.apiKeys === "object" ? parsed.apiKeys : {},
    };
  } catch {
    return { providers: DEFAULT_AI_PROVIDERS, apiKeys: {} };
  }
}

export function writeAiSettings(next: AiSettingsState): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
}

export function saveAiProviders(providers: AiProviders): AiSettingsState {
  const current = readAiSettings();
  const next = { ...current, providers };
  writeAiSettings(next);
  return next;
}

export function saveAiApiKey(provider: string, apiKey: string): AiSettingsState {
  const current = readAiSettings();
  const next = {
    ...current,
    apiKeys: { ...current.apiKeys, [provider]: apiKey.trim() },
  };
  writeAiSettings(next);
  return next;
}

export function deleteAiApiKey(provider: string): AiSettingsState {
  const current = readAiSettings();
  const apiKeys: AiApiKeys = { ...current.apiKeys };
  delete apiKeys[provider];
  const next = { ...current, apiKeys };
  writeAiSettings(next);
  return next;
}

/** Contexto para enviar às server actions (provedores + chaves). */
export function getAiClientContext(): AiClientContext {
  const { providers, apiKeys } = readAiSettings();
  return { providers, apiKeys };
}

/** Header x-storyflow-ai-context (base64url) para fetch às API routes. */
export function encodeAiContextHeader(): string {
  const ctx = getAiClientContext();
  return btoa(unescape(encodeURIComponent(JSON.stringify(ctx))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function apiKeyLast4(apiKeys: AiApiKeys, provider: string): string | null {
  const key = apiKeys[provider]?.trim();
  if (!key || key.length < 4) return null;
  return key.slice(-4);
}
