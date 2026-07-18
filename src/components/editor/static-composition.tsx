"use client";

import { useState, type CSSProperties } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  EditorCaptionPosition,
  EditorCaptionStyle,
  EditorImageMotion,
  EditorTransition,
  StaticCompositionProps,
} from "@/lib/schemas/editor";
import { EDITOR_FPS } from "@/lib/schemas/editor";
import {
  computeImageMotion,
  imageMotionCssTransform,
} from "@/lib/editor/image-motion";
import {
  findActiveCaptionCue,
  type CaptionAppearance,
  type CaptionCue,
} from "@/lib/editor/captions";
import { CaptionOverlay } from "@/components/editor/caption-overlay";

/** Crossfade padrão entre b-rolls (~0,35s), limitado a 1/4 da duração do clipe. */
export const DEFAULT_CROSSFADE_FRAMES = Math.round(EDITOR_FPS * 0.35);

/**
 * Composition Remotion: slideshow com transição + áudio da narração.
 *
 * A opacidade fica em 1 exatamente no intervalo [fromFrame, fromFrame+duration]
 * de cada b-roll. O fade / slide só ocorre nas bordas (antes/depois).
 * Durante o hold, aplica motion contínuo (Ken Burns / zoom / drift).
 */
export function StaticComposition({
  imageClips,
  audioSrc,
  musicSrc = null,
  musicVolume = 0.35,
  backgroundColor,
  durationInFrames,
  crossfadeFrames = DEFAULT_CROSSFADE_FRAMES,
  transition = "crossfade",
  imageMotion = "ken-burns",
  imageMotionIntensity = 1,
  captionCues = [],
  captionStyle = "boxed",
  captionScale = 1,
  captionPosition = "bottom",
  captionFont = "arial-black",
  captionColor = "#FFFFFF",
  captionHighlightColor = "#FFE566",
  captionBgColor = "#000000",
  captionBgOpacity = 0.72,
  captionUppercase = false,
}: StaticCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {imageClips.map((clip, index) => {
        const naturalFrom = clip.fromFrame;
        const naturalEnd = clip.fromFrame + clip.durationInFrames;
        const prevDur =
          index > 0
            ? imageClips[index - 1]!.durationInFrames
            : Number.POSITIVE_INFINITY;
        const nextDur =
          index < imageClips.length - 1
            ? imageClips[index + 1]!.durationInFrames
            : Number.POSITIVE_INFINITY;

        const fadeBudget = Math.max(
          0,
          Math.min(
            crossfadeFrames,
            Math.floor(clip.durationInFrames / 4),
            Math.floor(prevDur / 4),
            Math.floor(nextDur / 4)
          )
        );
        const fadeIn = index === 0 ? 0 : fadeBudget;
        const fadeOut = index === imageClips.length - 1 ? 0 : fadeBudget;

        const from = Math.max(0, naturalFrom - fadeIn);
        const end = Math.min(durationInFrames, naturalEnd + fadeOut);
        const seqDuration = Math.max(1, end - from);

        const opaqueStart = naturalFrom - from;
        const opaqueEnd = Math.max(opaqueStart, naturalEnd - from);

        return (
          <Sequence
            key={clip.id}
            from={from}
            durationInFrames={seqDuration}
            name={clip.id}
            layout="none"
          >
            <TransitionSlide
              src={clip.src}
              durationInFrames={seqDuration}
              opaqueStart={opaqueStart}
              opaqueEnd={opaqueEnd}
              transition={transition}
              imageMotion={imageMotion}
              imageMotionIntensity={imageMotionIntensity}
              clipIndex={index}
            />
          </Sequence>
        );
      })}
      {captionStyle !== "off" && captionCues.length > 0 ? (
        <CaptionsLayer
          cues={captionCues}
          captionStyle={captionStyle}
          captionScale={captionScale}
          captionPosition={captionPosition}
          appearance={{
            font: captionFont,
            color: captionColor,
            highlightColor: captionHighlightColor,
            bgColor: captionBgColor,
            bgOpacity: captionBgOpacity,
            uppercase: captionUppercase,
          }}
        />
      ) : null}
      {audioSrc ? (
        <Sequence
          from={0}
          durationInFrames={durationInFrames}
          name="narration"
          layout="none"
        >
          <Audio
            src={audioSrc}
            pauseWhenBuffering
            acceptableTimeShiftInSeconds={1}
          />
        </Sequence>
      ) : null}
      {musicSrc ? (
        <Sequence
          from={0}
          durationInFrames={durationInFrames}
          name="music"
          layout="none"
        >
          <Audio
            src={musicSrc}
            volume={Math.min(1, Math.max(0, musicVolume))}
            pauseWhenBuffering
            acceptableTimeShiftInSeconds={1}
          />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

function CaptionsLayer({
  cues,
  captionStyle,
  captionScale,
  captionPosition,
  appearance,
}: {
  cues: CaptionCue[];
  captionStyle: EditorCaptionStyle;
  captionScale: number;
  captionPosition: EditorCaptionPosition;
  appearance: CaptionAppearance;
}) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const currentSec = frame / EDITOR_FPS;
  const cue = findActiveCaptionCue(cues, currentSec);
  const baseFontPx = Math.round(height * 0.048);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <CaptionOverlay
        cue={cue}
        currentSec={currentSec}
        captionStyle={captionStyle}
        captionScale={captionScale}
        captionPosition={captionPosition}
        appearance={appearance}
        baseFontPx={baseFontPx}
      />
    </AbsoluteFill>
  );
}

function TransitionSlide({
  src,
  durationInFrames,
  opaqueStart,
  opaqueEnd,
  transition,
  imageMotion,
  imageMotionIntensity,
  clipIndex,
}: {
  src: string;
  durationInFrames: number;
  opaqueStart: number;
  opaqueEnd: number;
  transition: EditorTransition;
  imageMotion: EditorImageMotion;
  imageMotionIntensity: number;
  clipIndex: number;
}) {
  const frame = useCurrentFrame();

  const points: Array<{ at: number; opacity: number }> = [];
  const push = (at: number, opacity: number) => {
    const t = Math.max(0, Math.min(durationInFrames, Math.round(at)));
    const last = points[points.length - 1];
    if (last && last.at === t) {
      last.opacity = opacity;
      return;
    }
    if (last && t < last.at) return;
    points.push({ at: t, opacity });
  };

  const hardCut = transition === "cut";
  push(0, hardCut || opaqueStart <= 0 ? 1 : 0);
  push(opaqueStart, 1);
  push(opaqueEnd, 1);
  push(durationInFrames, hardCut || opaqueEnd >= durationInFrames ? 1 : 0);

  const opacity =
    points.length < 2
      ? 1
      : interpolate(
          frame,
          points.map((p) => p.at),
          points.map((p) => p.opacity),
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

  const progressIn =
    opaqueStart <= 0
      ? 1
      : interpolate(frame, [0, opaqueStart], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const progressOut =
    opaqueEnd >= durationInFrames
      ? 1
      : interpolate(frame, [opaqueEnd, durationInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const style = slideMotionStyle(transition, progressIn, progressOut, opacity);

  // Progresso do Ken Burns no intervalo opaco do clipe (hold da cena).
  const motionProgress = interpolate(
    frame,
    [opaqueStart, opaqueEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ ...style, overflow: "hidden" }}>
      <SafeSlideImage
        src={src}
        imageMotion={imageMotion}
        imageMotionIntensity={imageMotionIntensity}
        clipIndex={clipIndex}
        motionProgress={motionProgress}
      />
    </AbsoluteFill>
  );
}

function slideMotionStyle(
  transition: EditorTransition,
  progressIn: number,
  progressOut: number,
  opacity: number
): CSSProperties {
  const enter = 1 - progressIn;
  const exit = progressOut;

  switch (transition) {
    case "slide-left":
      return {
        opacity: 1,
        transform: `translateX(${enter * 100 - exit * 100}%)`,
      };
    case "slide-right":
      return {
        opacity: 1,
        transform: `translateX(${-enter * 100 + exit * 100}%)`,
      };
    case "slide-up":
      return {
        opacity: 1,
        transform: `translateY(${enter * 100 - exit * 100}%)`,
      };
    case "zoom":
      return {
        opacity,
        transform: `scale(${1 + enter * 0.2 - exit * 0.1})`,
      };
    case "wipe":
      return {
        opacity: 1,
        clipPath: `inset(0 ${(1 - progressIn) * 100}% 0 ${exit * 100}%)`,
      };
    case "fade-black":
    case "fade-white":
    case "crossfade":
    case "cut":
    default:
      return { opacity };
  }
}

/**
 * <img> nativo com decoding async — o Remotion <Img> chama image.decode()
 * e dispara EncodingError com muitas PNGs grandes na timeline.
 */
function SafeSlideImage({
  src,
  imageMotion,
  imageMotionIntensity,
  clipIndex,
  motionProgress,
}: {
  src: string;
  imageMotion: EditorImageMotion;
  imageMotionIntensity: number;
  clipIndex: number;
  motionProgress: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#141414",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    );
  }

  const motion = computeImageMotion(
    motionProgress,
    imageMotion,
    clipIndex,
    imageMotionIntensity
  );
  const transform = imageMotionCssTransform(motion);

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      src={src}
      decoding="async"
      loading="eager"
      draggable={false}
      onError={() => setFailed(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        transform,
        transformOrigin: "center center",
        willChange: transform === "none" ? undefined : "transform",
      }}
    />
  );
}
