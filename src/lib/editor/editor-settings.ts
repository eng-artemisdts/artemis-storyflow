import {
  DEFAULT_EDITOR_SETTINGS,
  EditorPersistedSchema,
  EditorSettingsSchema,
  type EditorPersisted,
  type EditorSettings,
  type EditorTransition,
} from "@/lib/schemas/editor";
import {
  IMAGE_MOTION_OPTIONS,
  type EditorImageMotion,
  type ImageMotionOption,
} from "@/lib/editor/image-motion";
import {
  CAPTION_COLOR_PRESETS,
  CAPTION_FONT_OPTIONS,
  CAPTION_POSITION_OPTIONS,
  CAPTION_STYLE_OPTIONS,
  type CaptionStyleOption,
} from "@/lib/editor/captions";

export {
  IMAGE_MOTION_OPTIONS,
  CAPTION_STYLE_OPTIONS,
  CAPTION_POSITION_OPTIONS,
  CAPTION_FONT_OPTIONS,
  CAPTION_COLOR_PRESETS,
  type EditorImageMotion,
  type ImageMotionOption,
  type CaptionStyleOption,
};

export function parseEditorPersisted(
  raw: string | null | undefined
): EditorPersisted {
  if (!raw?.trim()) {
    return { version: 1, settings: { ...DEFAULT_EDITOR_SETTINGS } };
  }
  try {
    const data = JSON.parse(raw) as unknown;
    const parsed = EditorPersistedSchema.safeParse(data);
    if (parsed.success) {
      return {
        version: 1,
        settings: { ...DEFAULT_EDITOR_SETTINGS, ...parsed.data.settings },
      };
    }
    const asSettings = EditorSettingsSchema.safeParse(data);
    if (asSettings.success) {
      return {
        version: 1,
        settings: { ...DEFAULT_EDITOR_SETTINGS, ...asSettings.data },
      };
    }
  } catch {
    /* ignore */
  }
  return { version: 1, settings: { ...DEFAULT_EDITOR_SETTINGS } };
}

export function parseEditorSettings(
  raw: string | null | undefined
): EditorSettings {
  return parseEditorPersisted(raw).settings;
}

export function stringifyEditorPersisted(settings: EditorSettings): string {
  const merged = EditorSettingsSchema.parse({
    ...DEFAULT_EDITOR_SETTINGS,
    ...settings,
  });
  return JSON.stringify({ version: 1, settings: merged } satisfies EditorPersisted);
}

export type TransitionOption = {
  value: EditorTransition;
  label: string;
  description: string;
};

export const TRANSITION_OPTIONS: TransitionOption[] = [
  {
    value: "cut",
    label: "Corte",
    description: "Troca seca",
  },
  {
    value: "crossfade",
    label: "Dissolve",
    description: "Suave",
  },
  {
    value: "fade-black",
    label: "Fade preto",
    description: "Via escuro",
  },
  {
    value: "fade-white",
    label: "Fade branco",
    description: "Via claro",
  },
  {
    value: "slide-left",
    label: "Slide ←",
    description: "Desliza",
  },
  {
    value: "slide-right",
    label: "Slide →",
    description: "Desliza",
  },
  {
    value: "slide-up",
    label: "Slide ↑",
    description: "Sobe",
  },
  {
    value: "zoom",
    label: "Zoom",
    description: "Aproxima",
  },
  {
    value: "wipe",
    label: "Wipe",
    description: "Varre",
  },
];

export function transitionNeedsDuration(t: EditorTransition): boolean {
  return t !== "cut";
}
