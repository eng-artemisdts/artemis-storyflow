import React from "react";
import { Composition } from "remotion";
import { StaticComposition } from "@/components/editor/static-composition";
import {
  DEFAULT_STATIC_COMPOSITION_PROPS,
  EDITOR_FPS,
  STATIC_COMPOSITION_ID,
  type StaticCompositionProps,
} from "@/lib/schemas/editor";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={STATIC_COMPOSITION_ID}
      component={StaticComposition}
      durationInFrames={DEFAULT_STATIC_COMPOSITION_PROPS.durationInFrames}
      fps={EDITOR_FPS}
      width={1920}
      height={1080}
      defaultProps={DEFAULT_STATIC_COMPOSITION_PROPS}
      calculateMetadata={({ props }: { props: StaticCompositionProps }) => ({
        durationInFrames: Math.max(1, props.durationInFrames || 1),
        width: props.width && props.width > 0 ? props.width : 1920,
        height: props.height && props.height > 0 ? props.height : 1080,
        fps: EDITOR_FPS,
      })}
    />
  );
};
