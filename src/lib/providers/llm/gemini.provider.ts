import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderConfig, ScriptAnalysisProvider } from "@/lib/providers/types";
import type { ScriptAnalysis } from "@/lib/schemas/script-analysis";
import { runScriptAnalysis } from "@/lib/providers/llm/analyze-shared";

export class GeminiProvider implements ScriptAnalysisProvider {
  readonly id = "gemini";
  readonly label = "Google (Gemini)";

  constructor(private config: ProviderConfig) {}

  async analyzeScript(script: string): Promise<ScriptAnalysis> {
    const google = createGoogleGenerativeAI({ apiKey: this.config.apiKey });
    return runScriptAnalysis(google(this.config.model), script);
  }
}
