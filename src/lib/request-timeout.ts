/** Tempo máximo total da geração de cenas (cliente → API). */
export const BROLLS_GENERATION_TIMEOUT_MS = 6 * 60 * 1000;

/** Sem dados no stream por esse intervalo → cancela (heartbeats a cada 20s evitam falso positivo). */
export const BROLLS_STREAM_IDLE_MS = 2 * 60 * 1000;

/** Tempo máximo da chamada ao LLM no servidor. */
export const BROLLS_LLM_TIMEOUT_MS = 5 * 60 * 1000;

/** Intervalo de heartbeat enquanto o LLM processa. */
export const BROLLS_STREAM_HEARTBEAT_MS = 20 * 1000;

export function createTimeoutAbortSignal(ms: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

export function createLlmAbortSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export function formatTimeoutError(err: unknown, label: string): string {
  const isAbort =
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError"));

  if (isAbort) {
    return `${label} expirou. Tente novamente ou reduza a transcrição.`;
  }

  return err instanceof Error ? err.message : `${label} falhou`;
}
