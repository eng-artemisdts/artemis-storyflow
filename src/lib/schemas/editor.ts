import { z } from "zod";

export const EDITOR_FPS = 30;

export const EditorClipSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "audio"]),
  src: z.string().min(1),
  startSec: z.number().nonnegative(),
  durationSec: z.number().positive(),
  label: z.string().optional(),
  brollId: z.number().int().positive().optional(),
});

export const EditorTrackSchema = z.object({
  id: z.enum(["narration", "brolls"]),
  label: z.string().min(1),
  clips: z.array(EditorClipSchema),
});

export const EditorStateSchema = z.object({
  fps: z.literal(EDITOR_FPS).or(z.number().int().positive()),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSec: z.number().positive(),
  aspectRatio: z.enum(["16:9", "9:16"]),
  tracks: z.array(EditorTrackSchema).min(1),
  updatedAt: z.string(),
});

/** Transições disponíveis no mini-editor static. */
export const EditorTransitionSchema = z.enum([
  "cut",
  "crossfade",
  "fade-black",
  "fade-white",
  "slide-left",
  "slide-right",
  "slide-up",
  "zoom",
  "wipe",
]);
export type EditorTransition = z.infer<typeof EditorTransitionSchema>;

/** Motion contínuo nas imagens estáticas (durante o hold do clipe). */
export const EditorImageMotionSchema = z.enum([
  "none",
  "ken-burns",
  "zoom-in",
  "zoom-out",
  "drift",
  "random",
]);
export type EditorImageMotion = z.infer<typeof EditorImageMotionSchema>;

/** Estilos de legenda no mini-editor static. */
export const EditorCaptionStyleSchema = z.enum([
  "off",
  "boxed",
  "outline",
  "karaoke",
  "minimal",
]);
export type EditorCaptionStyle = z.infer<typeof EditorCaptionStyleSchema>;

export const EditorCaptionPositionSchema = z.enum(["bottom", "middle"]);
export type EditorCaptionPosition = z.infer<typeof EditorCaptionPositionSchema>;

/** Famílias tipográficas disponíveis para legendas. */
export const EditorCaptionFontSchema = z.enum([
  "impact",
  "arial-black",
  "helvetica",
  "georgia",
  "mono",
]);
export type EditorCaptionFont = z.infer<typeof EditorCaptionFontSchema>;

const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida")
  .default("#FFFFFF");

export const EditorSettingsSchema = z.object({
  transition: EditorTransitionSchema.default("crossfade"),
  /** Duração da transição em ms (ignorado em `cut`). */
  transitionMs: z.number().int().min(0).max(2000).default(350),
  /** Animação contínua da imagem (Ken Burns, zoom, drift, random). */
  imageMotion: EditorImageMotionSchema.default("ken-burns"),
  /** Intensidade do motion (0.5 = sutil, 1 = padrão, 1.5 = forte). */
  imageMotionIntensity: z.number().min(0.5).max(1.5).default(1),
  /** Estilo de legenda (`off` = desligado). Default boxed para já aparecer com transcrição. */
  captionStyle: EditorCaptionStyleSchema.default("boxed"),
  /** Escala tipográfica das legendas. */
  captionScale: z.number().min(0.75).max(1.5).default(1),
  /** Posição vertical das legendas. */
  captionPosition: EditorCaptionPositionSchema.default("bottom"),
  /** Fonte da legenda. */
  captionFont: EditorCaptionFontSchema.default("arial-black"),
  /** Cor do texto (#RRGGBB). */
  captionColor: HexColorSchema.default("#FFFFFF"),
  /** Cor do highlight karaoke (#RRGGBB). */
  captionHighlightColor: HexColorSchema.default("#FFE566"),
  /** Cor de fundo da caixa (#RRGGBB). */
  captionBgColor: HexColorSchema.default("#000000"),
  /** Opacidade do fundo da caixa (0–1). */
  captionBgOpacity: z.number().min(0).max(1).default(0.72),
  /** Força texto em maiúsculas. */
  captionUppercase: z.boolean().default(false),
  musicUrl: z.string().nullable().default(null),
  /** Volume da música de fundo (0–1). */
  musicVolume: z.number().min(0).max(1).default(0.35),
});

export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  transition: "crossfade",
  transitionMs: 350,
  imageMotion: "ken-burns",
  imageMotionIntensity: 1,
  captionStyle: "boxed",
  captionScale: 1,
  captionPosition: "bottom",
  captionFont: "arial-black",
  captionColor: "#FFFFFF",
  captionHighlightColor: "#FFE566",
  captionBgColor: "#000000",
  captionBgOpacity: 0.72,
  captionUppercase: false,
  musicUrl: null,
  musicVolume: 0.35,
};

/** Blob persistido em Project.editorJson. */
export const EditorPersistedSchema = z.object({
  version: z.literal(1).default(1),
  settings: EditorSettingsSchema.default(DEFAULT_EDITOR_SETTINGS),
});

export type EditorPersisted = z.infer<typeof EditorPersistedSchema>;

export type EditorClip = z.infer<typeof EditorClipSchema>;
export type EditorTrack = z.infer<typeof EditorTrackSchema>;
export type EditorState = z.infer<typeof EditorStateSchema>;
