"use client";

import { encodeAiContextHeader } from "@/lib/ai-settings-storage";
import { AI_CONTEXT_HEADER } from "@/lib/ai-settings";
import type { ProjectBrolls } from "@/lib/schemas/brolls";
import {
  BROLLS_GENERATION_TIMEOUT_MS,
  BROLLS_STREAM_IDLE_MS,
  formatTimeoutError,
} from "@/lib/request-timeout";

export type BrollsStreamEvent =
  | { type: "started" }
  | { type: "ping" }
  | { type: "partial"; brolls: ProjectBrolls["brolls"]; count: number }
  | { type: "done"; brolls: ProjectBrolls }
  | { type: "error"; error: string };

function idleTimeoutMessage(): string {
  const sec = Math.round(BROLLS_STREAM_IDLE_MS / 1000);
  return `Geração de cenas expirou por inatividade (${sec}s sem resposta). Tente novamente.`;
}

export async function streamProjectBrollsGeneration(
  projectId: string,
  handlers: {
    onStarted?: () => void;
    onPartial?: (brolls: ProjectBrolls["brolls"], count: number) => void;
    onDone?: (brolls: ProjectBrolls) => void;
    onError?: (error: string) => void;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), BROLLS_GENERATION_TIMEOUT_MS);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let idleTimedOut = false;

  const fail = (error: string) => {
    handlers.onError?.(error);
    return { ok: false as const, error };
  };

  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      controller.abort();
      void reader?.cancel();
    }, BROLLS_STREAM_IDLE_MS);
  };

  try {
    const response = await fetch(`/api/projects/${projectId}/brolls/generate`, {
      method: "POST",
      headers: {
        [AI_CONTEXT_HEADER]: encodeAiContextHeader(),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let error = `Erro ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) error = body.error;
      } catch {
        /* ignore */
      }
      return fail(error);
    }

    if (!response.body) {
      return fail("Resposta sem stream");
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: string | null = null;
    let doneReceived = false;
    let startedReceived = false;

    armIdleTimer();

    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;

      try {
        chunk = await reader.read();
      } catch (err) {
        if (doneReceived) break;
        if (idleTimedOut) {
          return fail(idleTimeoutMessage());
        }
        return fail(formatTimeoutError(err, "Geração de cenas"));
      }

      if (chunk.done) break;

      armIdleTimer();

      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let event: BrollsStreamEvent;
        try {
          event = JSON.parse(line) as BrollsStreamEvent;
        } catch {
          continue;
        }

        if (event.type === "started") {
          startedReceived = true;
          handlers.onStarted?.();
        } else if (event.type === "ping") {
          /* mantém o idle timer vivo enquanto o LLM processa */
        } else if (event.type === "partial") {
          handlers.onPartial?.(event.brolls, event.count);
        } else if (event.type === "done") {
          doneReceived = true;
          handlers.onDone?.(event.brolls);
        } else if (event.type === "error") {
          streamError = event.error;
          handlers.onError?.(event.error);
        }
      }
    }

    if (streamError) return { ok: false, error: streamError };

    if (!doneReceived) {
      const error = startedReceived
        ? "Geração interrompida antes de concluir"
        : "A geração não iniciou — verifique o provedor de LLM e tente novamente";
      return fail(error);
    }

    return { ok: true };
  } catch (err) {
    if (idleTimedOut) {
      return fail(idleTimeoutMessage());
    }
    return fail(formatTimeoutError(err, "Geração de cenas"));
  } finally {
    clearTimeout(totalTimer);
    clearIdleTimer();
    try {
      await reader?.cancel();
    } catch {
      /* ignore */
    }
  }
}
