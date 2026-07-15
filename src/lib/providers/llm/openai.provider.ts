import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig, ScriptAnalysisProvider } from "@/lib/providers/types";
import type { ScriptAnalysis } from "@/lib/schemas/script-analysis";
import { runScriptAnalysis } from "@/lib/providers/llm/analyze-shared";

export class OpenAIProvider implements ScriptAnalysisProvider {
  readonly id = "openai";
  readonly label = "OpenAI (GPT)";

  constructor(private config: ProviderConfig) {}

  async analyzeScript(script: string): Promise<ScriptAnalysis> {
    const openai = createOpenAI({ apiKey: this.config.apiKey });
    return runScriptAnalysis(openai(this.config.model), script);
  }
}
