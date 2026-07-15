import { z } from "zod";

/** Saída bruta do LLM (formato do brolls-prompt). */
export const BrollsLlmSchema = z.object({
  brolls: z
    .array(
      z.object({
        id: z.number().int().positive(),
        timestamp_seconds: z.number().nonnegative(),
        concept: z.string().min(1).max(120),
        image_prompt: z.string().min(10).max(4_000),
      })
    )
    .min(1)
    .max(400),
});

export type BrollsLlmResult = z.infer<typeof BrollsLlmSchema>;

/** B-roll enriquecido persistido no projeto (pronto para gerador de imagem). */
export type ProjectBroll = {
  id: number;
  concept: string;
  image_prompt: string;
  /** Início em segundos (igual a timestamp_seconds). */
  start: number;
  /** Fim em segundos (início do próximo ou fim do áudio). */
  end: number;
  duration: number;
  timestamp_seconds: number;
  timestamp_display: string;
  imageUrl?: string | null;
};

export type ProjectBrolls = {
  brolls: ProjectBroll[];
  styleId: string | null;
  styleLabel: string | null;
  createdAt: string;
  /** Prompt completo (system + user) usado na análise LLM, exportável em .md. */
  generationPromptMd?: string | null;
};
