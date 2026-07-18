/**
 * Motion contínuo em imagens estáticas (Ken Burns / zoom / drift).
 *
 * Inspirado em abordagens gratuitas usadas em slideshows Remotion
 * (interpolate scale+translate) e no clássico efeito Ken Burns —
 * sem dependências externas: preview e export compartilham a mesma matemática.
 */

import type { EditorImageMotion } from "@/lib/schemas/editor";

export type { EditorImageMotion };

export type ImageMotionTransform = {
  scale: number;
  /** Deslocamento horizontal em % do container. */
  translateX: number;
  /** Deslocamento vertical em % do container. */
  translateY: number;
};

type MotionEndpoint = {
  scale: number;
  x: number;
  y: number;
};

/** Direções determinísticas para variar cenas adjacentes. */
const KEN_BURNS_PATHS: Array<{ from: MotionEndpoint; to: MotionEndpoint }> = [
  { from: { scale: 1.0, x: 0, y: 0 }, to: { scale: 1.14, x: -3.5, y: -2.5 } },
  { from: { scale: 1.0, x: 0, y: 0 }, to: { scale: 1.14, x: 3.5, y: -2.5 } },
  { from: { scale: 1.0, x: 0, y: 0 }, to: { scale: 1.14, x: -3.5, y: 2.5 } },
  { from: { scale: 1.0, x: 0, y: 0 }, to: { scale: 1.14, x: 3.5, y: 2.5 } },
  { from: { scale: 1.14, x: -3, y: -2 }, to: { scale: 1.0, x: 0, y: 0 } },
  { from: { scale: 1.14, x: 3, y: -2 }, to: { scale: 1.0, x: 0, y: 0 } },
  { from: { scale: 1.12, x: -2.5, y: 2 }, to: { scale: 1.0, x: 1.5, y: -1.5 } },
  { from: { scale: 1.12, x: 2.5, y: 2 }, to: { scale: 1.0, x: -1.5, y: -1.5 } },
];

const DRIFT_PATHS: Array<{ from: MotionEndpoint; to: MotionEndpoint }> = [
  { from: { scale: 1.06, x: -2, y: -1.5 }, to: { scale: 1.06, x: 2, y: 1.5 } },
  { from: { scale: 1.06, x: 2, y: -1.5 }, to: { scale: 1.06, x: -2, y: 1.5 } },
  { from: { scale: 1.08, x: -1.5, y: 2 }, to: { scale: 1.08, x: 1.5, y: -2 } },
  { from: { scale: 1.08, x: 1.5, y: 2 }, to: { scale: 1.08, x: -1.5, y: -2 } },
];

function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/** Ease suave (ease-in-out cubic) — movimento cinematográfico, não linear. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixEndpoints(
  from: MotionEndpoint,
  to: MotionEndpoint,
  t: number,
  intensity: number
): ImageMotionTransform {
  const amp = Math.max(0.25, Math.min(2, intensity));
  const scaleFrom = 1 + (from.scale - 1) * amp;
  const scaleTo = 1 + (to.scale - 1) * amp;
  return {
    scale: lerp(scaleFrom, scaleTo, t),
    translateX: lerp(from.x * amp, to.x * amp, t),
    translateY: lerp(from.y * amp, to.y * amp, t),
  };
}

/** Tipos animados usados pelo modo aleatório (exclui none/random). */
const RANDOM_MOTION_POOL = [
  "ken-burns",
  "zoom-in",
  "zoom-out",
  "drift",
] as const satisfies ReadonlyArray<Exclude<EditorImageMotion, "none" | "random">>;

/**
 * Ordem que garante cenas adjacentes com tipos diferentes
 * (ciclo 4: A→C→B→D).
 */
const RANDOM_TYPE_ORDER = [0, 2, 1, 3] as const;

/**
 * Resolve o motion efetivo por clipe.
 * Em `random`, escolhe de forma determinística (preview = export) e
 * evita repetir o mesmo tipo em cenas consecutivas.
 */
export function resolveEffectiveMotion(
  motion: EditorImageMotion,
  clipIndex: number
): Exclude<EditorImageMotion, "random"> {
  if (motion !== "random") return motion;
  const i = Math.max(0, clipIndex);
  const typeIdx = RANDOM_TYPE_ORDER[i % RANDOM_TYPE_ORDER.length]!;
  return RANDOM_MOTION_POOL[typeIdx]!;
}

function pathForMotion(
  motion: Exclude<EditorImageMotion, "random">,
  pathSeed: number
): { from: MotionEndpoint; to: MotionEndpoint } | null {
  const i = Math.max(0, pathSeed);
  switch (motion) {
    case "none":
      return null;
    case "zoom-in":
      return {
        from: { scale: 1.0, x: 0, y: 0 },
        to: { scale: 1.12, x: 0, y: 0 },
      };
    case "zoom-out":
      return {
        from: { scale: 1.12, x: 0, y: 0 },
        to: { scale: 1.0, x: 0, y: 0 },
      };
    case "drift":
      return DRIFT_PATHS[i % DRIFT_PATHS.length]!;
    case "ken-burns":
    default:
      return KEN_BURNS_PATHS[i % KEN_BURNS_PATHS.length]!;
  }
}

/**
 * Calcula scale/translate para um progresso 0–1 no clipe.
 * `clipIndex` escolhe a variante (direção / tipo em random) de forma estável.
 */
export function computeImageMotion(
  progress: number,
  motion: EditorImageMotion,
  clipIndex: number,
  intensity = 1
): ImageMotionTransform {
  const effective = resolveEffectiveMotion(motion, clipIndex);
  // No modo random, mistura o seed da direção para ken-burns/drift não repetirem.
  const pathSeed =
    motion === "random" ? clipIndex * 5 + 3 : Math.max(0, clipIndex);
  const path = pathForMotion(effective, pathSeed);
  if (!path) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }
  return mixEndpoints(path.from, path.to, easeInOutCubic(progress), intensity);
}

export function imageMotionCssTransform(t: ImageMotionTransform): string {
  const { scale, translateX, translateY } = t;
  if (
    Math.abs(scale - 1) < 1e-4 &&
    Math.abs(translateX) < 1e-4 &&
    Math.abs(translateY) < 1e-4
  ) {
    return "none";
  }
  return `translate(${translateX}%, ${translateY}%) scale(${scale})`;
}

export type ImageMotionOption = {
  value: EditorImageMotion;
  label: string;
  description: string;
};

export const IMAGE_MOTION_OPTIONS: ImageMotionOption[] = [
  {
    value: "none",
    label: "Nenhum",
    description: "Imagem parada",
  },
  {
    value: "ken-burns",
    label: "Ken Burns",
    description: "Zoom + pan cinemático",
  },
  {
    value: "zoom-in",
    label: "Zoom in",
    description: "Aproxima suave",
  },
  {
    value: "zoom-out",
    label: "Zoom out",
    description: "Afasta suave",
  },
  {
    value: "drift",
    label: "Drift",
    description: "Deslize lateral",
  },
  {
    value: "random",
    label: "Aleatório",
    description: "Varia por cena",
  },
];
