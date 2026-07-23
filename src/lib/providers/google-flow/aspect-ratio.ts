import type { AspectRatio } from "@/lib/providers/types";

/** Mapeia aspect ratio do StoryFlow → parâmetro da API Google Flow. */
export function toGoogleFlowAspectRatio(ratio: AspectRatio | undefined): string {
  switch (ratio) {
    case "9:16":
      return "portrait";
    case "16:9":
      return "landscape";
    case "1:1":
      return "1:1";
    case "4:3":
      return "4:3";
    default:
      return "landscape";
  }
}
