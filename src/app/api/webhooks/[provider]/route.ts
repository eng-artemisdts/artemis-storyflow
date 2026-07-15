import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/:provider — stub de webhooks para fal.ai/Replicate.
 *
 * TODO para produção:
 * 1. fal.ai: passar `webhookUrl` em queue.submit(...); o fal envia um POST
 *    com { request_id, status, payload } — validar a assinatura via
 *    cabeçalhos X-Fal-Webhook-* (ed25519) antes de confiar no corpo.
 * 2. Replicate: passar `webhook` + `webhook_events_filter: ["completed"]`
 *    em predictions.create; validar a assinatura `webhook-signature`
 *    (HMAC-SHA256) com o secret de replicate.com/account/webhook.
 * 3. Localizar o GenerationJob por externalId e reutilizar a mesma lógica
 *    de syncJobStatus (download p/ storage + propagação ao alvo).
 *
 * Em dev, o polling via GET /api/jobs/:id já cobre o fluxo completo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params;
  // Consome o corpo para responder 200 e evitar retries do provedor.
  await request.text();
  console.info(`[webhook] recebido de "${provider}" — processamento ainda não implementado`);
  return NextResponse.json({ received: true });
}
