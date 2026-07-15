import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderConfig, ScriptAnalysisProvider } from "@/lib/providers/types";
import type { ScriptAnalysis } from "@/lib/schemas/script-analysis";
import { runScriptAnalysis } from "@/lib/providers/llm/analyze-shared";

export class AnthropicProvider implements ScriptAnalysisProvider {
  readonly id = "anthropic";
  readonly label = "Anthropic (Claude)";

  constructor(private config: ProviderConfig) {}

  async analyzeScript(script: string): Promise<ScriptAnalysis> {
    const anthropic = createAnthropic({ apiKey: this.config.apiKey });
    return runScriptAnalysis(anthropic(this.config.model), script);
  }
}
