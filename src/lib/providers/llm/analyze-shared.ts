import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { ScriptAnalysisSchema, type ScriptAnalysis } from "@/lib/schemas/script-analysis";

export const ANALYSIS_SYSTEM_PROMPT = `Você é um diretor de arte e roteirista especializado em pré-produção de vídeo com IA generativa.

Sua tarefa: analisar o roteiro fornecido e extrair personagens, cenários e uma decupagem em cenas, preparada para geração de imagem e vídeo por IA.

Regras obrigatórias:

1. PERSONAGENS — para cada personagem, escreva "description" em português com detalhes físicos COMPLETOS e REUTILIZÁVEIS: idade aparente, formato do rosto, cor e corte de cabelo, cor dos olhos, tom de pele, tipo físico, roupa completa e estilo visual. Todo detalhe deve poder ser repetido de forma idêntica em várias cenas.

2. visualPrompt (personagens e cenários) — escreva SEMPRE EM INGLÊS, otimizado para modelos de difusão de imagem (Nano Banana, FLUX, Seedream): descrição física completa, roupa, estilo cinematográfico, "character reference sheet, neutral pose, full body, clean neutral background" para personagens; para cenários, ambiente sem pessoas, iluminação e atmosfera.

3. CENAS — decupe o roteiro em cenas curtas (clipes de 5 a 10 segundos). "videoPrompt" SEMPRE EM INGLÊS, no formato cinematográfico: sujeito + ação + movimento de câmera + iluminação + atmosfera + áudio/diálogo (quando houver). Ex.: "A middle-aged detective walks slowly through a rain-soaked neon alley, handheld camera tracking from behind, cold blue lighting with pink neon reflections, tense atmosphere, distant thunder and footsteps echoing".

4. CONSISTÊNCIA — "characterNames" e "scenarioName" das cenas devem bater EXATAMENTE com os nomes declarados em characters[] e scenarios[].

5. Não invente personagens ou locações que não estejam no roteiro (figurantes genéricos podem ficar apenas no videoPrompt).`;

export async function runScriptAnalysis(
  model: LanguageModel,
  script: string
): Promise<ScriptAnalysis> {
  const { object } = await generateObject({
    model,
    schema: ScriptAnalysisSchema,
    system: ANALYSIS_SYSTEM_PROMPT,
    prompt: `Analise o roteiro a seguir e produza a decupagem estruturada.\n\n<roteiro>\n${script}\n</roteiro>`,
  });
  return object;
}
