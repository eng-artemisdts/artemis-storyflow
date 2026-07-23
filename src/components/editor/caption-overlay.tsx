"use client";

import type { CSSProperties } from "react";
import type {
  EditorCaptionPosition,
  EditorCaptionStyle,
} from "@/lib/schemas/editor";
import {
  captionFontCss,
  findActiveCaptionWordIndex,
  hexToRgba,
  DEFAULT_CAPTION_APPEARANCE,
  type CaptionAppearance,
  type CaptionCue,
} from "@/lib/editor/captions";

function strokeShadow(px: number, color = "#000000"): string {
  const s = `${px}px`;
  return [
    `-${s} -${s} 0 ${color}`,
    `${s} -${s} 0 ${color}`,
    `-${s} ${s} 0 ${color}`,
    `${s} ${s} 0 ${color}`,
    `0 -${s} 0 ${color}`,
    `0 ${s} 0 ${color}`,
    `-${s} 0 0 ${color}`,
    `${s} 0 0 ${color}`,
  ].join(", ");
}

function shellStyle(
  style: Exclude<EditorCaptionStyle, "off">,
  scale: number,
  baseFontPx: number,
  appearance: CaptionAppearance
): CSSProperties {
  const fontSize = Math.round(baseFontPx * scale);
  const stroke = Math.max(2, Math.round(fontSize * 0.08));
  const forceUpper =
    appearance.uppercase || style === "outline" || style === "karaoke";

  const base: CSSProperties = {
    fontFamily: captionFontCss(appearance.font),
    fontSize,
    fontWeight: appearance.font === "helvetica" || appearance.font === "georgia" ? 700 : 900,
    lineHeight: 1.25,
    letterSpacing: "0.01em",
    textAlign: "center",
    maxWidth: "92%",
    color: appearance.color,
    wordBreak: "break-word",
    textTransform: forceUpper ? ("uppercase" as const) : undefined,
  };

  switch (style) {
    case "boxed":
      return {
        ...base,
        backgroundColor: hexToRgba(appearance.bgColor, appearance.bgOpacity),
        padding: `${Math.round(fontSize * 0.28)}px ${Math.round(fontSize * 0.5)}px`,
        borderRadius: Math.round(fontSize * 0.28),
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      };
    case "outline":
      return {
        ...base,
        textShadow: strokeShadow(stroke),
        WebkitTextStroke: `${Math.max(0.5, stroke * 0.15)}px #000`,
      };
    case "karaoke":
      return {
        ...base,
        textShadow: strokeShadow(stroke),
      };
    case "minimal":
    default:
      return {
        ...base,
        fontWeight: 700,
        textShadow: "0 2px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)",
      };
  }
}

function KaraokeText({
  cue,
  currentSec,
  scale,
  color,
  highlightColor,
}: {
  cue: CaptionCue;
  currentSec: number;
  scale: number;
  color: string;
  highlightColor: string;
}) {
  const activeIdx = findActiveCaptionWordIndex(cue, currentSec);
  return (
    <>
      {cue.words.map((w, i) => {
        const isActive = i === activeIdx;
        const isPast = activeIdx >= 0 && i < activeIdx;
        return (
          <span
            key={`${w.startSec}-${i}`}
            style={{
              color: isActive ? highlightColor : isPast ? color : `${color}8C`,
              transform: isActive ? `scale(${1 + 0.06 * scale})` : undefined,
              display: "inline-block",
              marginRight: i < cue.words.length - 1 ? "0.28em" : 0,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </>
  );
}

/**
 * Overlay de legenda syncado ao tempo do áudio.
 * Estilos inline para manter o preview independente do Tailwind.
 */
export function CaptionOverlay({
  cue,
  currentSec,
  captionStyle,
  captionScale = 1,
  captionPosition = "bottom",
  appearance = DEFAULT_CAPTION_APPEARANCE,
  /** Tamanho-base do texto no preview. */
  baseFontPx = 22,
}: {
  cue: CaptionCue | null;
  currentSec: number;
  captionStyle: EditorCaptionStyle;
  captionScale?: number;
  captionPosition?: EditorCaptionPosition;
  appearance?: CaptionAppearance;
  baseFontPx?: number;
}) {
  if (captionStyle === "off" || !cue) return null;

  const scale = Math.max(0.75, Math.min(1.5, captionScale));
  const textStyle = shellStyle(captionStyle, scale, baseFontPx, appearance);

  const shell: CSSProperties =
    captionPosition === "middle"
      ? {
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 50,
          display: "flex",
          justifyContent: "center",
          paddingLeft: "4%",
          paddingRight: "4%",
          pointerEvents: "none",
        }
      : {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "7%",
          zIndex: 50,
          display: "flex",
          justifyContent: "center",
          paddingLeft: "4%",
          paddingRight: "4%",
          pointerEvents: "none",
        };

  return (
    <div style={shell} aria-hidden>
      <div style={textStyle}>
        {captionStyle === "karaoke" && cue.words.length > 0 ? (
          <KaraokeText
            cue={cue}
            currentSec={currentSec}
            scale={scale}
            color={appearance.color}
            highlightColor={appearance.highlightColor}
          />
        ) : (
          cue.text
        )}
      </div>
    </div>
  );
}
