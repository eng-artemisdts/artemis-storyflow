import { z } from "zod";
import { AiClientContextSchema } from "@/lib/ai-settings";

export const NarrationTypeSchema = z.enum(["second-person", "first-person", "third-person"]);

export const ChannelTypeSchema = z.enum([
  "narrative-story",
  "documentary",
  "listicle",
  "explainer",
  "case-study",
  "comparison",
  "tutorial",
  "custom",
]);

export const VideoAspectRatioSchema = z.enum(["16:9", "9:16"]);
export { AiClientContextSchema };

export const CreateChannelSchema = z.object({
  name: z.string().trim().min(1, "Nome do canal é obrigatório").max(120),
  niche: z.string().trim().min(1, "Nicho é obrigatório").max(500),
  description: z.string().trim().min(1, "Descrição é obrigatória").max(2_000),
  videoAspectRatio: VideoAspectRatioSchema,
  targetDurationMin: z
    .number()
    .int("Use minutos inteiros")
    .min(1, "Mínimo de 1 minuto")
    .max(120, "Máximo de 120 minutos"),
  outputLanguage: z.string().trim().min(1, "Idioma é obrigatório").max(120),
  channelType: ChannelTypeSchema.default("narrative-story"),
  channelTypeDescription: z.string().trim().max(2_000).optional().default(""),
  hasReferenceCharacter: z.boolean().default(false),
  referenceCharacterName: z.string().trim().max(120).optional().default(""),
  referenceCharacterDescription: z.string().trim().max(1_000).optional().default(""),
  narrationType: NarrationTypeSchema.default("second-person"),
  addressForm: z.string().trim().min(1).max(40),
  forbiddenForms: z.string().trim().min(1).max(300),
  suspensePhrase: z.string().trim().max(200).optional().default(""),
  concreteUnits: z.string().trim().max(500).optional().default(""),
  brandSignoff: z.string().trim().max(200).optional().default("none"),
}).superRefine((data, ctx) => {
  if (data.channelType === "custom" && data.channelTypeDescription.trim().length < 10) {
    ctx.addIssue({
      code: "custom",
      message: "Descreva o formato personalizado (mín. 10 caracteres)",
      path: ["channelTypeDescription"],
    });
  }
  if (data.hasReferenceCharacter && data.referenceCharacterName.trim().length < 1) {
    ctx.addIssue({
      code: "custom",
      message: "Informe o nome do personagem de referência",
      path: ["referenceCharacterName"],
    });
  }
});

export const UpdateChannelSchema = CreateChannelSchema.extend({
  channelId: z.string().min(1),
});

export const PreviewChannelMasterPromptSchema = CreateChannelSchema.extend({
  ai: AiClientContextSchema.optional(),
});

export const ChannelIdSchema = z.object({
  channelId: z.string().min(1),
});

export const VideoKindSchema = z.enum(["motion", "static"]);

export const CreateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120),
    channelId: z.string().min(1, "Canal é obrigatório"),
    videoKind: VideoKindSchema,
    targetDurationMin: z
      .number()
      .int("Use minutos inteiros")
      .min(1, "Mínimo de 1 minuto")
      .max(120, "Máximo de 120 minutos")
      .optional(),
    videoTopic: z.string().trim().max(2_000).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.videoKind === "static" && data.videoTopic.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o tópico do vídeo",
        path: ["videoTopic"],
      });
    }
  });

export const GenerateNarrativeScriptSchema = z.object({
  projectId: z.string().min(1),
  videoTopic: z.string().trim().min(3, "Informe o tópico do vídeo").max(2_000),
  ai: AiClientContextSchema.optional(),
});

export const RenameProjectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

export const ProjectIdSchema = z.object({
  projectId: z.string().min(1),
});

export const AnalyzeScriptSchema = z.object({
  projectId: z.string().min(1),
  ai: AiClientContextSchema.optional(),
});

export const SaveScriptSchema = z.object({
  projectId: z.string().min(1),
  script: z.string().max(200_000, "Roteiro grande demais"),
});

export const ImportScriptMarkdownSchema = z.object({
  projectId: z.string().min(1),
  script: z.string().trim().min(1, "Arquivo vazio").max(200_000, "Roteiro grande demais"),
});

export const GenerateBrollsSchema = z.object({
  projectId: z.string().min(1),
  ai: AiClientContextSchema.optional(),
});

export const UploadNarrationAudioSchema = z.object({
  projectId: z.string().min(1),
});

export const SaveVideoAspectRatioSchema = z.object({
  projectId: z.string().min(1),
  videoAspectRatio: VideoAspectRatioSchema,
});

export const SaveProjectStyleSchema = z.object({
  projectId: z.string().min(1),
  // null = sem estilo (prompts passam sem modificação)
  styleId: z.string().min(1).nullable(),
});

export const SaveStylePromptOverrideSchema = z.object({
  projectId: z.string().min(1),
  styleId: z.string().min(1),
  /** null ou string vazia = remove o override e volta ao prompt padrão do preset */
  prompt: z.string().max(4_000).nullable(),
});

export const CreateCustomStyleSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(120),
  prompt: z.string().trim().min(1, "Informe o prompt do estilo").max(4_000),
  previewImageUrl: z.string().trim().min(1).max(2_000).nullable().optional(),
});

export const UpdateCustomStyleSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Informe o título").max(120),
  prompt: z.string().trim().min(1, "Informe o prompt do estilo").max(4_000),
  previewImageUrl: z.string().trim().min(1).max(2_000).nullable().optional(),
});

export const DeleteCustomStyleSchema = z.object({
  id: z.string().min(1),
});

export const PreviewCustomStyleSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().trim().min(1, "Informe o prompt do estilo").max(4_000),
  styleId: z.string().min(1).optional(),
  ai: AiClientContextSchema.optional(),
});

export const SuggestChannelFieldSchema = z.object({
  field: z.enum(["niche", "description"]),
  name: z.string().trim().max(120).optional().default(""),
  niche: z.string().trim().max(500).optional().default(""),
  description: z.string().trim().max(2_000).optional().default(""),
  outputLanguage: z.string().trim().min(1).max(120).optional(),
  ai: AiClientContextSchema.optional(),
});

export const UpdateVisualPromptSchema = z.object({
  targetType: z.enum(["character", "scenario"]),
  targetId: z.string().min(1),
  visualPrompt: z.string().trim().min(1).max(10_000),
});

export const CreateCharacterSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  description: z.string().trim().min(1, "Descrição é obrigatória").max(10_000),
  visualPrompt: z.string().trim().max(10_000).optional(),
});

export const CreateScenarioSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  description: z.string().trim().min(1, "Descrição é obrigatória").max(10_000),
  visualPrompt: z.string().trim().max(10_000).optional(),
});

export const CreateSceneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1, "Título é obrigatório").max(200),
  summary: z.string().trim().min(1, "Resumo é obrigatório").max(10_000),
  videoPrompt: z.string().trim().min(1, "Prompt de vídeo é obrigatório").max(10_000),
  durationSec: z.number().int().min(3).max(15).optional(),
  dialogue: z.string().trim().max(10_000).optional().nullable(),
  scenarioId: z.string().min(1).optional().nullable(),
  characterIds: z.array(z.string().min(1)).optional(),
});

export const DeleteEntitySchema = z.object({
  projectId: z.string().min(1),
  targetType: z.enum(["character", "scenario", "scene"]),
  targetId: z.string().min(1),
});

export const UpdateSceneSchema = z.object({
  sceneId: z.string().min(1),
  videoPrompt: z.string().trim().min(1).max(10_000).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(10_000).optional(),
  durationSec: z.number().int().min(3).max(15).optional(),
});

export const GenerateAssetImageSchema = z.object({
  projectId: z.string().min(1),
  targetType: z.enum(["character", "scenario", "scene_keyframe", "broll"]),
  targetId: z.string().min(1),
  ai: AiClientContextSchema.optional(),
});

export const GenerateVideosSchema = z.object({
  projectId: z.string().min(1),
  sceneIds: z.array(z.string().min(1)).min(1, "Selecione ao menos uma cena"),
  ai: AiClientContextSchema.optional(),
});

export const EditSceneVideoSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  editPrompt: z
    .string()
    .trim()
    .min(3, "Descreva a edição desejada")
    .max(4_000, "Instrução de edição muito longa"),
  ai: AiClientContextSchema.optional(),
});

export const EditAssetImageSchema = z.object({
  projectId: z.string().min(1),
  targetType: z.enum(["character", "scenario", "scene_keyframe", "broll"]),
  targetId: z.string().min(1),
  editPrompt: z
    .string()
    .trim()
    .min(3, "Descreva a edição desejada")
    .max(4_000, "Instrução de edição muito longa"),
  ai: AiClientContextSchema.optional(),
});

export const UpdateBrollPromptSchema = z.object({
  projectId: z.string().min(1),
  brollId: z.number().int().positive(),
  imagePrompt: z.string().trim().min(1).max(8_000),
});

export const SaveWhiteboardSchema = z.object({
  projectId: z.string().min(1),
  nodes: z.string().max(2_000_000),
  edges: z.string().max(2_000_000),
});
