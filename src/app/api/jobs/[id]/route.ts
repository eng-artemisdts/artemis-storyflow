import { NextResponse } from "next/server";
import { syncJobStatus } from "@/lib/jobs";
import { AiClientContextSchema, AI_CONTEXT_HEADER } from "@/lib/ai-settings";
import { runWithAiContext } from "@/lib/credentials";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/:id — consulta o status no provedor, atualiza o banco e
 * retorna o estado normalizado. Usado pelo hook useJobPolling.
 * Aceita header x-storyflow-ai-context (base64 JSON) com chaves do localStorage.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    let ai = undefined;
    const encoded = request.headers.get(AI_CONTEXT_HEADER);
    if (encoded) {
      try {
        const raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        const parsed = AiClientContextSchema.safeParse(raw);
        if (parsed.success) ai = parsed.data;
      } catch {
        /* ignora header inválido — cai no .env */
      }
    }

    const job = await runWithAiContext(ai, () => syncJobStatus(id));
    return NextResponse.json({
      id: job.id,
      kind: job.kind,
      targetType: job.targetType,
      targetId: job.targetId,
      status: job.status,
      error: job.error,
      resultUrl: job.resultUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar job";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
