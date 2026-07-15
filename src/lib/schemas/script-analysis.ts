import { z } from "zod";

export const ScriptAnalysisSchema = z.object({
  characters: z
    .array(
      z.object({
        name: z.string().describe("Nome do personagem como aparece no roteiro"),
        description: z
          .string()
          .describe(
            "Descrição física completa e reutilizável: idade, rosto, cabelo, corpo, roupa, estilo visual"
          ),
        visualPrompt: z
          .string()
          .describe(
            "Image generation prompt in English, optimized for diffusion models: full physical description, outfit, style, neutral pose, clean background"
          ),
      })
    )
    .describe("Todos os personagens presentes no roteiro"),
  scenarios: z
    .array(
      z.object({
        name: z.string().describe("Nome curto do cenário/locação"),
        description: z.string().describe("Descrição detalhada do ambiente, época, atmosfera"),
        visualPrompt: z
          .string()
          .describe(
            "Image generation prompt in English: environment, lighting, mood, style, no people"
          ),
      })
    )
    .describe("Todos os cenários/locações do roteiro"),
  scenes: z
    .array(
      z.object({
        order: z.number().int().describe("Ordem da cena na narrativa, começando em 1"),
        title: z.string().describe("Título curto da cena"),
        summary: z.string().describe("Resumo do que acontece na cena"),
        videoPrompt: z
          .string()
          .describe(
            "Cinematic video prompt in English: subject + action + camera movement + lighting + atmosphere + audio/dialogue cues"
          ),
        dialogue: z.string().nullable().describe("Diálogos da cena, se houver"),
        characterNames: z
          .array(z.string())
          .describe("Nomes dos personagens presentes (devem bater com characters[].name)"),
        scenarioName: z
          .string()
          .nullable()
          .describe("Nome do cenário da cena (deve bater com scenarios[].name)"),
        durationSec: z
          .number()
          .int()
          .min(3)
          .max(15)
          .describe("Duração sugerida do clipe em segundos (5-10 típico)"),
      })
    )
    .describe("Decupagem do roteiro em cenas/planos para geração de vídeo"),
});

export type ScriptAnalysis = z.infer<typeof ScriptAnalysisSchema>;
