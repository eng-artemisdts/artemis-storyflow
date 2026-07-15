import type { Prediction } from "replicate";
import type { JobStatus } from "@/lib/providers/types";

/** Extrai a URL do output do Replicate (pode ser string, array ou objeto). */
export function extractReplicateOutputUrl(output: Prediction["output"]): string | undefined {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
  }
  if (output && typeof output === "object" && "url" in output) {
    const url = (output as { url: unknown }).url;
    if (typeof url === "string") return url;
  }
  return undefined;
}

export function mapReplicateStatus(
  status: Prediction["status"],
  getUrl: () => string | undefined
): JobStatus {
  switch (status) {
    case "starting":
      return { status: "queued" };
    case "processing":
      return { status: "running" };
    case "succeeded": {
      const url = getUrl();
      if (!url) return { status: "failed", error: "Prediction sem URL de output" };
      return { status: "succeeded", resultUrl: url };
    }
    case "failed":
    case "canceled":
      return { status: "failed", error: `Prediction ${status}` };
    default:
      return { status: "running" };
  }
}
