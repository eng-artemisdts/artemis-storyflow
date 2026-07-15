"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_CONTEXT_HEADER } from "@/lib/ai-settings";
import { getAiClientContext } from "@/lib/ai-settings-storage";

export interface PolledJob {
  id: string;
  kind: "image" | "video";
  targetType: "character" | "scenario" | "scene_keyframe" | "scene_video" | "broll";
  targetId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error: string | null;
  resultUrl: string | null;
}

interface UseJobPollingOptions {
  /** Chamado uma única vez quando um job atinge estado terminal. */
  onJobFinished?: (job: PolledJob) => void;
  /** Intervalo base em ms (cresce com backoff até 3x). */
  baseIntervalMs?: number;
}

function encodeAiContextHeader(): string {
  const ctx = getAiClientContext();
  return btoa(unescape(encodeURIComponent(JSON.stringify(ctx))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Faz polling de GET /api/jobs/:id para um conjunto dinâmico de jobs.
 * Para automaticamente quando todos terminam; aplica backoff progressivo.
 */
export function useJobPolling(options: UseJobPollingOptions = {}) {
  const { onJobFinished, baseIntervalMs = 3500 } = options;
  const [jobs, setJobs] = useState<Record<string, PolledJob>>({});
  const [isPolling, setIsPolling] = useState(false);

  const activeIds = useRef<Set<string>>(new Set());
  const finishedIds = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickCount = useRef(0);
  const tickRef = useRef<() => Promise<void>>(async () => {});
  const onFinishedRef = useRef(onJobFinished);

  useEffect(() => {
    onFinishedRef.current = onJobFinished;
  }, [onJobFinished]);

  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setIsPolling(false);
  }, []);

  const tick = useCallback(async () => {
    const ids = [...activeIds.current];
    if (ids.length === 0) {
      stop();
      return;
    }

    const aiHeader = encodeAiContextHeader();
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/jobs/${id}`, {
          cache: "no-store",
          headers: { [AI_CONTEXT_HEADER]: aiHeader },
        });
        if (!res.ok) throw new Error(`Job ${id} não encontrado`);
        return (await res.json()) as PolledJob;
      })
    );

    const updates: Record<string, PolledJob> = {};
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const job = result.value;
      updates[job.id] = job;
      if (job.status === "succeeded" || job.status === "failed") {
        activeIds.current.delete(job.id);
        if (!finishedIds.current.has(job.id)) {
          finishedIds.current.add(job.id);
          onFinishedRef.current?.(job);
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setJobs((prev) => ({ ...prev, ...updates }));
    }

    if (activeIds.current.size > 0) {
      tickCount.current += 1;
      const backoff = Math.min(3, 1 + tickCount.current / 10);
      timer.current = setTimeout(() => void tickRef.current(), baseIntervalMs * backoff);
    } else {
      stop();
    }
  }, [baseIntervalMs, stop]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  /** Adiciona jobs ao polling (ids repetidos/terminados são ignorados). */
  const track = useCallback((jobIds: string[]) => {
    let added = false;
    for (const id of jobIds) {
      if (!finishedIds.current.has(id) && !activeIds.current.has(id)) {
        activeIds.current.add(id);
        added = true;
      }
    }
    if (added && !timer.current) {
      tickCount.current = 0;
      setIsPolling(true);
      timer.current = setTimeout(() => void tickRef.current(), 400);
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { jobs, track, isPolling };
}
