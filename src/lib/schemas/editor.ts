import { z } from "zod";

export const EDITOR_FPS = 30;

/** ID da composition Remotion (usado no bundle do player e no export). */
export const STATIC_COMPOSITION_ID = "StaticVideo";

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

export const EditorSettingsSchema = z.object({
  transition: EditorTransitionSchema.default("crossfade"),
  /** Duração da transição em ms (ignorado em `cut`). */
  transitionMs: z.number().int().min(0).max(2000).default(350),
  musicUrl: z.string().nullable().default(null),
  /** Volume da música de fundo (0–1). */
  musicVolume: z.number().min(0).max(1).default(0.35),
});

export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  transition: "crossfade",
  transitionMs: 350,
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

/** Props passadas ao Player / Composition Remotion. */
export type StaticCompositionProps = {
  imageClips: Array<{
    id: string;
    src: string;
    fromFrame: number;
    durationInFrames: number;
  }>;
  audioSrc: string | null;
  musicSrc?: string | null;
  musicVolume?: number;
  durationInFrames: number;
  width?: number;
  height?: number;
  backgroundColor: string;
  /** Frames de overlap no crossfade (padrão ~0,4s). */
  crossfadeFrames?: number;
  transition?: EditorTransition;
};

export const DEFAULT_STATIC_COMPOSITION_PROPS: StaticCompositionProps = {
  imageClips: [],
  audioSrc: null,
  musicSrc: null,
  musicVolume: 0.35,
  durationInFrames: 30,
  width: 1920,
  height: 1080,
  backgroundColor: "#0a0a0a",
  crossfadeFrames: Math.round(EDITOR_FPS * 0.35),
  transition: "crossfade",
};
