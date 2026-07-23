import type { GoogleFlowErrorBody } from "@/lib/providers/google-flow/types";

export class GoogleFlowError extends Error {
  readonly status: number;
  readonly body: GoogleFlowErrorBody;
  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    status: number,
    body: GoogleFlowErrorBody = {},
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = "GoogleFlowError";
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(
  header: string | null,
  body: GoogleFlowErrorBody
): number | null {
  if (typeof body.retryAfter === "number" && body.retryAfter > 0) {
    return body.retryAfter * 1000;
  }
  if (header) {
    const sec = Number.parseFloat(header);
    if (Number.isFinite(sec) && sec > 0) return Math.round(sec * 1000);
  }
  return null;
}

/** Mensagem legível para UI a partir do status HTTP + body da useapi. */
export function formatGoogleFlowError(status: number, body: GoogleFlowErrorBody): string {
  const raw = body.error?.trim() ?? "";
  const reason = body.reason?.trim();

  if (status === 401) {
    return "Token useapi inválido. Configure em Configurações → Chaves de API.";
  }
  if (status === 402) {
    return "Assinatura useapi ou créditos insuficientes.";
  }
  if (status === 403) {
    if (raw.includes("captcha_quality:") || raw.toLowerCase().includes("captcha")) {
      return "reCAPTCHA rejeitado. Configure um provedor de captcha em useapi.net ou aumente captchaRetry.";
    }
    return raw || "Acesso negado (403). Verifique plano Flow e captcha.";
  }
  if (status === 404) {
    return "Conta Google Flow não encontrada. Conecte a conta em useapi.net.";
  }
  if (status === 408) {
    return "Timeout aguardando geração no Google Flow. Tente novamente.";
  }
  if (status === 429) {
    const hint =
      reason === "USER_QUOTA_REACHED"
        ? "Cota diária da conta Flow atingida."
        : reason === "USER_REQUESTS_THROTTLED"
          ? "Muitas requisições — aguarde ~30 min ou reduza o lote."
          : reason === "PER_MODEL_DAILY_QUOTA_REACHED"
            ? "Cota diária do modelo atingida (reset à meia-noite UTC)."
            : "Limite de taxa atingido.";
    return `${hint}${raw ? ` (${raw})` : ""}`;
  }
  if (status === 503) {
    if (raw.startsWith("Captcha service failed:")) {
      return `Serviço de captcha falhou: ${raw.slice("Captcha service failed:".length).trim()}`;
    }
    return raw || "Google Flow temporariamente indisponível. Tente em alguns segundos.";
  }
  if (status === 596) {
    return "Sessão Google Flow expirada. Reconfigure a conta em useapi.net.";
  }
  if (status === 400) {
    if (
      raw.includes("PUBLIC_ERROR_UNSAFE") ||
      raw.includes("PUBLIC_ERROR_MINOR") ||
      raw.toLowerCase().includes("unsafe")
    ) {
      return "Moderação de conteúdo bloqueou a geração. Edite o prompt ou tente de novo.";
    }
    return raw || "Requisição inválida para o Google Flow.";
  }

  return raw || `Google Flow falhou (HTTP ${status})`;
}

export async function throwGoogleFlowError(
  res: Response,
  data: GoogleFlowErrorBody
): Promise<never> {
  const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"), data);
  const message = formatGoogleFlowError(res.status, data);
  throw new GoogleFlowError(message, res.status, data, retryAfterMs);
}

export function isGoogleFlowModerationError(err: unknown): boolean {
  if (!(err instanceof GoogleFlowError) || err.status !== 400) return false;
  const e = err.body.error ?? "";
  return (
    e.includes("PUBLIC_ERROR_UNSAFE") ||
    e.includes("PUBLIC_ERROR_MINOR") ||
    e.toLowerCase().includes("unsafe")
  );
}
