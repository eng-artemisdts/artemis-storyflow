import "server-only";
import {
  AiClientContextSchema,
  AI_CONTEXT_HEADER,
  type AiClientContext,
} from "@/lib/ai-settings";

/** Lê o header x-storyflow-ai-context (base64url JSON) enviado pelo cliente. */
export function parseAiContextFromRequest(request: Request): AiClientContext | undefined {
  const encoded = request.headers.get(AI_CONTEXT_HEADER);
  if (!encoded) return undefined;
  try {
    const raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const parsed = AiClientContextSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
