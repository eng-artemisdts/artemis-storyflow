import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import type { LlmProviderId } from "@/lib/providers/types";

function createLanguageModel(
  providerId: string,
  apiKey: string,
  model: string
): LanguageModel {
  switch (providerId as LlmProviderId) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    default:
      throw new Error(`Provider de LLM desconhecido: "${providerId}"`);
  }
}

/**
 * Gera o roteiro narrativo long-form a partir do master prompt já preenchido.
 * Retorna apenas o texto do roteiro (sem meta-comentário).
 */
export async function generateNarrativeScriptText(input: {
  providerId: string;
  apiKey: string;
  model: string;
  filledMasterPrompt: string;
}): Promise<string> {
  const languageModel = createLanguageModel(
    input.providerId,
    input.apiKey,
    input.model
  );

  const { text } = await generateText({
    model: languageModel,
    // O master prompt já contém system rules + INPUT com o tópico.
    prompt: input.filledMasterPrompt,
    // Long-form ~2700 palavras ≈ 4k+ tokens; margem para checklist interno.
    maxOutputTokens: 16_384,
  });

  return text.trim();
}
