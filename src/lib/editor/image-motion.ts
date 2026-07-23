/**
 * Movimentos contínuos para imagens do slideshow.
 */
import type { EditorImageMotion } from "@/lib/schemas/editor";

export type { EditorImageMotion };

export type ImageMotionTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type Endpoint = { scale: number; x: number; y: number };

const KEN_BURNS_PATHS: Array<{ from: Endpoint; to: Endpoint }> = [
  { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.14, x: -3.5, y: -2.5 } },
  { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.14, x: 3.5, y: -2.5 } },
  { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.14, x: -3.5, y: 2.5 } },
  { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.14, x: 3.5, y: 2.5 } },
  { from: { scale: 1.14, x: -3, y: -2 }, to: { scale: 1, x: 0, y: 0 } },
  { from: { scale: 1.14, x: 3, y: -2 }, to: { scale: 1, x: 0, y: 0 } },
];

const DRIFT_PATHS: Array<{ from: Endpoint; to: Endpoint }> = [
  { from: { scale: 1.06, x: -2, y: -1.5 }, to: { scale: 1.06, x: 2, y: 1.5 } },
  { from: { scale: 1.06, x: 2, y: -1.5 }, to: { scale: 1.06, x: -2, y: 1.5 } },
  { from: { scale: 1.08, x: -1.5, y: 2 }, to: { scale: 1.08, x: 1.5, y: -2 } },
  { from: { scale: 1.08, x: 1.5, y: 2 }, to: { scale: 1.08, x: -1.5, y: -2 } },
];

const RANDOM_MOTION_POOL = [
  "ken-burns",
  "zoom-in",
  "zoom-out",
  "drift",
] as const satisfies ReadonlyArray<Exclude<EditorImageMotion, "none" | "random">>;

const RANDOM_TYPE_ORDER = [0, 2, 1, 3] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function easeInOutCubic(value: number): number {
  const x = clamp01(value);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function resolveEffectiveMotion(
  motion: EditorImageMotion,
  clipIndex: number
): Exclude<EditorImageMotion, "random"> {
  if (motion !== "random") return motion;
  const index = Math.max(0, clipIndex);
  return RANDOM_MOTION_POOL[
    RANDOM_TYPE_ORDER[index % RANDOM_TYPE_ORDER.length]!
  ]!;
}

function endpoints(
  motion: Exclude<EditorImageMotion, "random">,
  index: number
): { from: Endpoint; to: Endpoint } | null {
  switch (motion) {
    case "none":
      return null;
    case "zoom-in":
      return {
        from: { scale: 1, x: 0, y: 0 },
        to: { scale: 1.12, x: 0, y: 0 },
      };
    case "zoom-out":
      return {
        from: { scale: 1.12, x: 0, y: 0 },
        to: { scale: 1, x: 0, y: 0 },
      };
    case "drift":
      return DRIFT_PATHS[index % DRIFT_PATHS.length]!;
    default:
      return KEN_BURNS_PATHS[index % KEN_BURNS_PATHS.length]!;
  }
}

export function computeImageMotion(
  progress: number,
  motion: EditorImageMotion,
  clipIndex: number,
  intensity = 1
): ImageMotionTransform {
  const effective = resolveEffectiveMotion(motion, clipIndex);
  const path = endpoints(
    effective,
    motion === "random" ? clipIndex * 5 + 3 : Math.max(0, clipIndex)
  );
  if (!path) return { scale: 1, translateX: 0, translateY: 0 };

  const t = easeInOutCubic(progress);
  const amount = Math.max(0.25, Math.min(2, intensity));
  return {
    scale: lerp(
      1 + (path.from.scale - 1) * amount,
      1 + (path.to.scale - 1) * amount,
      t
    ),
    translateX: lerp(path.from.x * amount, path.to.x * amount, t),
    translateY: lerp(path.from.y * amount, path.to.y * amount, t),
  };
}

export function imageMotionCssTransform(
  transform: ImageMotionTransform
): string {
  const { scale, translateX, translateY } = transform;
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
  { value: "none", label: "Nenhum", description: "Imagem parada" },
  {
    value: "ken-burns",
    label: "Ken Burns",
    description: "Zoom + pan cinemático",
  },
  { value: "zoom-in", label: "Zoom in", description: "Aproxima suave" },
  { value: "zoom-out", label: "Zoom out", description: "Afasta suave" },
  { value: "drift", label: "Drift", description: "Deslize lateral" },
  { value: "random", label: "Aleatório", description: "Varia por cena" },
];
