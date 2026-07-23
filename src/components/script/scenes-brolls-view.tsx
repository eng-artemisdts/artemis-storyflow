"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Check,
  Clapperboard,
  Copy,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  ImageUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateProjectBrolls,
  getBrollsGenerationPromptMd,
  refreshProjectBrollPromptsBatch,
  resetProjectBrolls,
  updateBrollPrompt,
} from "@/actions/brolls.actions";
import { generateAssetImage } from "@/actions/asset.actions";
import { getAiClientContext, encodeAiContextHeader } from "@/lib/ai-settings-storage";
import { AI_CONTEXT_HEADER } from "@/lib/ai-settings";
import {
  downloadBrollsJson,
  downloadBrollsPromptMd,
  formatTimestamp,
  getNarrationTextForRange,
  transcriptionDurationSec,
  type ProjectTranscription,
} from "@/lib/transcription";
import type { ProjectBroll, ProjectBrolls } from "@/lib/schemas/brolls";
import { copyGoogleFlowPromptMd } from "@/lib/brolls/google-flow";
import { normalizeProjectBrollsTimes } from "@/lib/brolls/normalize-times";
import type { VideoAspectRatio } from "@/lib/video-aspect";
import { FlowImportDialog } from "@/components/script/flow-import-dialog";
import { useJobPolling, type PolledJob } from "@/hooks/use-job-polling";
import { useImageGenErrorAlert } from "@/hooks/use-image-gen-error-alert";
import { isImageSafetyError } from "@/lib/image-gen-errors";
import { AssetLightbox } from "@/components/asset-lightbox";
import { EditImageDialog } from "@/components/assets/edit-image-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Máximo de cenas por lote de geração. */
const MAX_BATCH = 10;

/** Cenas por chamada ao atualizar prompts (evita timeout em vídeos longos). */
const PROMPT_REFRESH_BATCH = 15;

/** Espera um único job terminar (polling leve). */
async function waitForImageJob(jobId: string): Promise<PolledJob | null> {
  const header = encodeAiContextHeader();
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 600 : 1800));
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        cache: "no-store",
        headers: { [AI_CONTEXT_HEADER]: header },
      });
      if (!res.ok) continue;
      const job = (await res.json()) as PolledJob;
      if (job.status === "succeeded" || job.status === "failed") return job;
    } catch {
      /* retry */
    }
  }
  return null;
}

export function ScenesBrollsView({
  projectId,
  projectName,
  hasTranscription,
  hasStyle,
  styleLabel,
  aspectRatio = "16:9",
  initialBrolls,
  transcription = null,
  activeJobIds,
}: {
  projectId: string;
  projectName: string;
  hasTranscription: boolean;
  hasStyle: boolean;
  styleLabel: string | null;
  aspectRatio?: VideoAspectRatio;
  initialBrolls: ProjectBrolls | null;
  transcription?: ProjectTranscription | null;
  activeJobIds: string[];
}) {
  const router = useRouter();
  const [brollsData, setBrollsData] = useState(initialBrolls);
  const [flowImportOpen, setFlowImportOpen] = useState(false);
  const [flowPromptCopied, setFlowPromptCopied] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [refreshPromptsConfirmOpen, setRefreshPromptsConfirmOpen] = useState(false);
  const [isAnalyzing, startAnalyze] = useTransition();
  const [isRefreshingPrompts, startRefreshPrompts] = useTransition();
  const [refreshPromptsProgress, setRefreshPromptsProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [isGeneratingBatch, startGenerateBatch] = useTransition();
  const [isExportingPrompt, startExportPrompt] = useTransition();
  const [busyTargets, setBusyTargets] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
    currentId: number | null;
  } | null>(null);
  const muteJobToastsRef = useRef(false);
  const { reportImageGenError, alertDialog } = useImageGenErrorAlert();

  useEffect(() => {
    setBrollsData(initialBrolls);
  }, [initialBrolls]);

  const { jobs, track } = useJobPolling({
    onJobFinished: (job) => {
      setBusyTargets((prev) => {
        const next = new Set(prev);
        next.delete(job.targetId);
        return next;
      });
      if (job.status === "succeeded") {
        if (job.resultUrl && job.targetType === "broll") {
          const id = Number(job.targetId);
          setBrollsData((prev) => {
            if (!prev || !Number.isFinite(id)) return prev;
            return {
              ...prev,
              brolls: prev.brolls.map((b) =>
                b.id === id ? { ...b, imageUrl: job.resultUrl } : b
              ),
            };
          });
        }
        if (!muteJobToastsRef.current) router.refresh();
      } else if (!muteJobToastsRef.current) {
        reportImageGenError(job.error);
      }
    },
  });

  useEffect(() => {
    if (activeJobIds.length > 0) track(activeJobIds);
  }, [activeJobIds, track]);

  const runningTargets = new Set<string>();
  for (const job of Object.values(jobs)) {
    if (job.status === "queued" || job.status === "running") {
      runningTargets.add(job.targetId);
    }
  }
  for (const t of busyTargets) runningTargets.add(t);

  const list = brollsData?.brolls ?? [];
  const totalDuration = list.reduce((acc, b) => acc + b.duration, 0);
  const missingImages = list.filter((b) => !b.imageUrl).length;
  const selectedCount = selectedIds.size;

  function toggleSelect(brollId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(brollId)) {
        next.delete(brollId);
        return next;
      }
      if (next.size >= MAX_BATCH) {
        toast.message(`Selecione no máximo ${MAX_BATCH} cenas por lote`);
        return prev;
      }
      next.add(brollId);
      return next;
    });
  }

  function selectMissingUpToMax() {
    const ids = list
      .filter((b) => !b.imageUrl)
      .slice(0, MAX_BATCH)
      .map((b) => b.id);
    setSelectedIds(new Set(ids));
    if (ids.length === 0) {
      toast.info("Todas as cenas já têm imagem");
    } else if (missingImages > MAX_BATCH) {
      toast.message(`Selecionadas as primeiras ${MAX_BATCH} sem imagem`, {
        description: `${missingImages - MAX_BATCH} ficam para o próximo lote`,
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runAnalyze() {
    const result = await generateProjectBrolls({
      projectId,
      ai: getAiClientContext(),
    });
    if (result.ok) {
      setBrollsData(
        normalizeProjectBrollsTimes(
          result.data.brolls,
          transcriptionDurationSec(transcription)
        )
      );
      setSelectedIds(new Set());
      toast.success(`${result.data.brolls.brolls.length} b-rolls gerados`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleAnalyze() {
    if (!hasTranscription) {
      toast.error("Gere a transcrição antes");
      return;
    }
    startAnalyze(runAnalyze);
  }

  function handleResetAndRegenerate() {
    setResetConfirmOpen(false);
    startAnalyze(async () => {
      const reset = await resetProjectBrolls({ projectId });
      if (!reset.ok) {
        toast.error(reset.error);
        return;
      }
      setBrollsData(null);
      setSelectedIds(new Set());
      await runAnalyze();
    });
  }

  function handleRefreshPrompts() {
    setRefreshPromptsConfirmOpen(false);
    startRefreshPrompts(async () => {
      const allIds = list.map((b) => b.id);
      const chunks: number[][] = [];
      for (let i = 0; i < allIds.length; i += PROMPT_REFRESH_BATCH) {
        chunks.push(allIds.slice(i, i + PROMPT_REFRESH_BATCH));
      }

      let updatedCount = 0;
      setRefreshPromptsProgress({ done: 0, total: chunks.length });

      try {
        for (let i = 0; i < chunks.length; i++) {
          const result = await refreshProjectBrollPromptsBatch({
            projectId,
            brollIds: chunks[i]!,
            ai: getAiClientContext(),
          });
          if (!result.ok) {
            toast.error(result.error, {
              description:
                updatedCount > 0
                  ? `${updatedCount} prompts já atualizados foram mantidos.`
                  : undefined,
            });
            return;
          }
          updatedCount += chunks[i]!.length;
          setBrollsData(result.data.brolls);
          setRefreshPromptsProgress({ done: i + 1, total: chunks.length });
        }

        toast.success(`${updatedCount} prompts atualizados`, {
          description: "As cenas, tempos e imagens existentes foram preservados.",
        });
        router.refresh();
      } finally {
        setRefreshPromptsProgress(null);
      }
    });
  }

  function handleGenerateSelected() {
    const ids = [...selectedIds].sort((a, b) => a - b);
    if (ids.length === 0) {
      toast.error("Selecione até 10 cenas para gerar");
      return;
    }
    if (ids.length > MAX_BATCH) {
      toast.error(`Máximo de ${MAX_BATCH} cenas por lote`);
      return;
    }

    startGenerateBatch(async () => {
      muteJobToastsRef.current = true;
      let okCount = 0;
      let failCount = 0;
      setBatchProgress({ done: 0, total: ids.length, currentId: ids[0] ?? null });

      try {
        for (let i = 0; i < ids.length; i++) {
          const brollId = ids[i]!;
          const targetId = String(brollId);
          setBatchProgress({ done: i, total: ids.length, currentId: brollId });
          setBusyTargets((prev) => new Set(prev).add(targetId));

          const result = await generateAssetImage({
            projectId,
            targetType: "broll",
            targetId,
            ai: getAiClientContext(),
          });

          if (!result.ok) {
            failCount += 1;
            setBusyTargets((prev) => {
              const next = new Set(prev);
              next.delete(targetId);
              return next;
            });
            if (isImageSafetyError(result.error)) {
              reportImageGenError(result.error);
            }
            continue;
          }

          track([result.data.jobId]);
          const finished = await waitForImageJob(result.data.jobId);

          setBusyTargets((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });

          if (finished?.status === "succeeded" && finished.resultUrl) {
            okCount += 1;
            setBrollsData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                brolls: prev.brolls.map((b) =>
                  b.id === brollId ? { ...b, imageUrl: finished.resultUrl } : b
                ),
              };
            });
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(brollId);
              return next;
            });
          } else {
            failCount += 1;
            const err =
              finished?.error ?? "tempo esgotado aguardando o provedor";
            if (isImageSafetyError(err)) {
              reportImageGenError(err);
            }
          }

          setBatchProgress({
            done: i + 1,
            total: ids.length,
            currentId: ids[i + 1] ?? null,
          });
        }

        if (okCount > 0 && failCount === 0) {
          toast.success(`${okCount} imagem(ns) gerada(s)`);
        } else if (okCount > 0) {
          toast.warning(`${okCount} ok · ${failCount} falharam`);
        } else {
          toast.error("Nenhuma imagem foi gerada neste lote");
        }
        router.refresh();
      } finally {
        muteJobToastsRef.current = false;
        setBatchProgress(null);
      }
    });
  }

  function handleRegenerate(brollId: number) {
    const targetId = String(brollId);
    setBusyTargets((prev) => new Set(prev).add(targetId));
    void (async () => {
      const result = await generateAssetImage({
        projectId,
        targetType: "broll",
        targetId,
        ai: getAiClientContext(),
      });
      if (result.ok) {
        track([result.data.jobId]);
      } else {
        setBusyTargets((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        toast.error(result.error);
      }
    })();
  }

  function handleEditStarted(targetId: string, jobId: string) {
    setBusyTargets((prev) => new Set(prev).add(targetId));
    track([jobId]);
  }

  async function handleCopyFlowPrompt() {
    if (!brollsData?.brolls.length) return;
    try {
      await copyGoogleFlowPromptMd(brollsData.brolls, projectName, aspectRatio);
      setFlowPromptCopied(true);
      toast.success("Prompts copiados — cole no Google Flow");
      setTimeout(() => setFlowPromptCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar os prompts");
    }
  }

  function handleFlowImported(updates: Array<{ id: number; imageUrl: string }>) {
    const map = new Map(updates.map((u) => [u.id, u.imageUrl]));
    setBrollsData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        brolls: prev.brolls.map((b) =>
          map.has(b.id) ? { ...b, imageUrl: map.get(b.id)! } : b
        ),
      };
    });
    router.refresh();
  }

  function handleExport() {
    if (!brollsData) return;
    downloadBrollsJson(brollsData, projectName);
    toast.success("Arquivo baixado");
  }

  function handleExportPromptMd() {
    startExportPrompt(async () => {
      if (brollsData?.generationPromptMd?.trim()) {
        downloadBrollsPromptMd(brollsData.generationPromptMd, projectName);
        toast.success("Prompt baixado em .md");
        return;
      }
      const result = await getBrollsGenerationPromptMd({ projectId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBrollsPromptMd(result.data.markdown, projectName);
      setBrollsData((prev) =>
        prev ? { ...prev, generationPromptMd: result.data.markdown } : prev
      );
      toast.success("Prompt baixado em .md");
    });
  }

  if (!hasTranscription) {
    return (
      <div className="rounded-xl border border-dashed bg-card/30 p-8 text-center">
        <CircleHelp className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Transcrição necessária</p>
        <p className="mt-1 text-xs text-muted-foreground">
          As cenas (b-rolls) são geradas a partir da transcrição word-level + estilo.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/projects/${projectId}/static/transcription`}>
            <ArrowLeft className="size-4" /> Ir para Transcrição
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 flex-col">
        {alertDialog}
        <FlowImportDialog
          projectId={projectId}
          brolls={list}
          open={flowImportOpen}
          onOpenChange={setFlowImportOpen}
          onImported={handleFlowImported}
        />

        <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remover todos os b-rolls?</DialogTitle>
              <DialogDescription>
                As {list.length} cenas atuais e suas imagens geradas serão removidas.
                Em seguida, uma nova análise da transcrição será feita para gerar as
                cenas do zero. Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setResetConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleResetAndRegenerate}>
                <Trash2 className="size-4" />
                Remover e gerar novamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={refreshPromptsConfirmOpen}
          onOpenChange={setRefreshPromptsConfirmOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Atualizar todos os prompts?</DialogTitle>
              <DialogDescription>
                Os prompts atuais, inclusive os editados manualmente, serão
                reescritos conforme o estilo, proporção e configurações atuais do
                projeto. As cenas, os tempos e as imagens existentes serão
                preservados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setRefreshPromptsConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleRefreshPrompts}>
                <Sparkles className="size-4" />
                Atualizar prompts
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="sticky top-0 z-20 shrink-0 bg-background/95 pb-4 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {hasStyle && styleLabel ? (
                  <Badge variant="secondary">Estilo: {styleLabel}</Badge>
                ) : (
                  <Badge variant="outline">Sem estilo selecionado</Badge>
                )}
                {list.length > 0 && (
                  <>
                    <Badge variant="secondary">{list.length} cenas</Badge>
                    <Badge variant="outline" className="font-mono tabular-nums">
                      ~{formatTimestamp(totalDuration)}
                    </Badge>
                    {missingImages > 0 && (
                      <Badge variant="outline">{missingImages} sem imagem</Badge>
                    )}
                    {selectedCount > 0 && (
                      <Badge variant="default">
                        {selectedCount}/{MAX_BATCH} selecionadas
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <p className="max-w-2xl text-xs text-muted-foreground">
                Selecione até {MAX_BATCH} cenas e gere as imagens uma a uma, ou copie os prompts
                para o Google Flow e importe de volta — por ID no nome ou arrastando até a cena.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={list.length > 0 ? "outline" : "default"}
                    size={list.length > 0 ? "icon" : "default"}
                    onClick={handleAnalyze}
                    disabled={
                      isAnalyzing || isRefreshingPrompts || isGeneratingBatch
                    }
                    aria-label={
                      isAnalyzing
                        ? "Gerando cenas"
                        : list.length > 0
                          ? "Gerar cenas novamente"
                          : "Analisar e gerar cenas"
                    }
                  >
                    {isAnalyzing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : list.length > 0 ? (
                      <RefreshCw className="size-4" />
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Analisar e gerar cenas
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {list.length > 0 ? (
                  <TooltipContent>
                    {isAnalyzing ? "Gerando cenas…" : "Gerar cenas novamente"}
                  </TooltipContent>
                ) : null}
              </Tooltip>
              {list.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRefreshPromptsConfirmOpen(true)}
                    disabled={
                      isAnalyzing || isRefreshingPrompts || isGeneratingBatch
                    }
                  >
                    {isRefreshingPrompts ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {isRefreshingPrompts
                      ? refreshPromptsProgress && refreshPromptsProgress.total > 1
                        ? `Atualizando lote ${Math.min(
                            refreshPromptsProgress.done + 1,
                            refreshPromptsProgress.total
                          )}/${refreshPromptsProgress.total}…`
                        : "Atualizando prompts…"
                      : "Atualizar prompts"}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setResetConfirmOpen(true)}
                        disabled={
                          isAnalyzing || isRefreshingPrompts || isGeneratingBatch
                        }
                        aria-label="Remover todos os b-rolls e gerar novamente"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Remover todos os b-rolls e gerar novamente
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={selectMissingUpToMax}
                    disabled={
                      isGeneratingBatch ||
                      isAnalyzing ||
                      isRefreshingPrompts ||
                      missingImages === 0
                    }
                  >
                    Selecionar sem imagem
                  </Button>
                  {selectedCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearSelection}
                      disabled={isGeneratingBatch}
                    >
                      Limpar seleção
                    </Button>
                  )}
                  <Button
                    onClick={handleGenerateSelected}
                    disabled={
                      isGeneratingBatch ||
                      isAnalyzing ||
                      isRefreshingPrompts ||
                      selectedCount === 0
                    }
                  >
                    {isGeneratingBatch ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImageIcon className="size-4" />
                    )}
                    {isGeneratingBatch && batchProgress
                      ? `Gerando ${batchProgress.done + 1}/${batchProgress.total}…`
                      : `Gerar selecionadas (${selectedCount})`}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleCopyFlowPrompt()}>
                    {flowPromptCopied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {flowPromptCopied ? "Copiado" : "Copiar prompt Flow"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFlowImportOpen(true)}
                  >
                    <ImageUp className="size-4" />
                    Importar do Flow
                  </Button>
                  <Button type="button" variant="outline" onClick={handleExport}>
                    <Download className="size-4" />
                    Exportar JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportPromptMd}
                    disabled={isExportingPrompt}
                  >
                    {isExportingPrompt ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    Exportar prompt .md
                  </Button>
                  {list.some((b) => b.imageUrl) && (
                    <Button asChild>
                      <Link href={`/projects/${projectId}/static/edit`}>
                        Ir para Edição <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  )}
                </>
              )}
              {!list.length && hasTranscription && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportPromptMd}
                  disabled={isExportingPrompt}
                >
                  {isExportingPrompt ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  Exportar prompt .md
                </Button>
              )}
            </div>
          </div>
        </div>

        <Separator className="shrink-0" />

        <ScrollArea className="min-h-0 flex-1">
        <div className="py-4 pr-3">
          {isAnalyzing && list.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden py-0 gap-0">
                  <div className="flex aspect-video items-center justify-center bg-muted/40">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card/30 p-10 text-center">
              <Clapperboard className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhuma cena ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique em “Analisar e gerar cenas” para criar a lista de b-rolls.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((broll) => {
                const targetId = String(broll.id);
                const narrationText = getNarrationTextForRange(
                  transcription,
                  broll.start,
                  broll.end
                );
                const selected = selectedIds.has(broll.id);
                const isCurrentBatch =
                  batchProgress?.currentId === broll.id && isGeneratingBatch;
                return (
                  <BrollCard
                    key={broll.id}
                    projectId={projectId}
                    broll={broll}
                    narrationText={narrationText}
                    selected={selected}
                    selectionDisabled={
                      isGeneratingBatch ||
                      isRefreshingPrompts ||
                      (!selected && selectedCount >= MAX_BATCH)
                    }
                    interactionDisabled={isRefreshingPrompts}
                    isGenerating={runningTargets.has(targetId) || isCurrentBatch}
                    onToggleSelect={() => toggleSelect(broll.id)}
                    onRegenerate={() => handleRegenerate(broll.id)}
                    onEditStarted={(jobId) => handleEditStarted(targetId, jobId)}
                    onPromptSaved={(imagePrompt) => {
                      setBrollsData((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          brolls: prev.brolls.map((b) =>
                            b.id === broll.id ? { ...b, image_prompt: imagePrompt } : b
                          ),
                        };
                      });
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

function BrollCard({
  projectId,
  broll,
  narrationText,
  selected,
  selectionDisabled,
  interactionDisabled,
  isGenerating,
  onToggleSelect,
  onRegenerate,
  onEditStarted,
  onPromptSaved,
}: {
  projectId: string;
  broll: ProjectBroll;
  narrationText: string;
  selected: boolean;
  selectionDisabled: boolean;
  interactionDisabled: boolean;
  isGenerating: boolean;
  onToggleSelect: () => void;
  onRegenerate: () => void;
  onEditStarted?: (jobId: string) => void;
  onPromptSaved?: (imagePrompt: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [prompt, setPrompt] = useState(broll.image_prompt);
  const [isPending, startTransition] = useTransition();
  const targetId = String(broll.id);
  const title = `#${broll.id} — ${broll.concept}`;
  const timing = `${formatTimestamp(broll.start)}–${formatTimestamp(broll.end)}`;

  useEffect(() => {
    setPrompt(broll.image_prompt);
  }, [broll.image_prompt]);

  function handleSavePrompt() {
    startTransition(async () => {
      const result = await updateBrollPrompt({
        projectId,
        brollId: broll.id,
        imagePrompt: prompt,
      });
      if (result.ok) {
        toast.success("Prompt atualizado");
        onPromptSaved?.(prompt);
        setEditOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card
      role="button"
      tabIndex={selectionDisabled && !selected ? -1 : 0}
      aria-pressed={selected}
      aria-label={`${selected ? "Desselecionar" : "Selecionar"} cena ${broll.id}`}
      onClick={() => {
        if (selectionDisabled && !selected) return;
        onToggleSelect();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (selectionDisabled && !selected) return;
        onToggleSelect();
      }}
      className={cn(
        "group overflow-hidden py-0 gap-0 border bg-card outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "cursor-pointer border-primary/50 bg-primary/[0.04] shadow-md ring-2 ring-primary"
          : selectionDisabled
            ? "cursor-not-allowed opacity-55"
            : "cursor-pointer"
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {broll.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={broll.imageUrl}
              alt={broll.concept}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <button
              type="button"
              className="absolute right-2 bottom-2 z-10 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100"
              title="Ampliar imagem"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
            >
              Ampliar
            </button>
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageIcon className="size-6 opacity-60 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[11px] opacity-70">
              {selected ? "Selecionada" : "Clique para selecionar"}
            </span>
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
        <div
          className={cn(
            "absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-md px-1.5 py-1 shadow-sm backdrop-blur-sm transition-colors",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-background/90 text-muted-foreground group-hover:bg-background"
          )}
        >
          <Checkbox
            checked={selected}
            disabled={selectionDisabled && !selected}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => {
              if (selectionDisabled && !selected) return;
              onToggleSelect();
            }}
            aria-label={`Selecionar cena ${broll.id}`}
            className={cn(selected && "border-primary-foreground data-checked:bg-primary-foreground data-checked:text-primary")}
          />
          <span className="font-mono text-[11px] tabular-nums">#{broll.id}</span>
        </div>
        {selected && (
          <div className="pointer-events-none absolute inset-0 z-[5] ring-inset ring-2 ring-primary/40" />
        )}
      </div>
      <CardContent className="space-y-2 p-4">
        <h3 className="font-medium leading-snug">{broll.concept}</h3>
        <p className="font-mono text-[11px] text-muted-foreground">
          {broll.duration.toFixed(1)}s · {timing}
        </p>
        {narrationText ? (
          <blockquote
            className="line-clamp-4 rounded-md border-l-2 border-primary/40 bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed text-foreground/90"
            title={narrationText}
          >
            “{narrationText}”
          </blockquote>
        ) : (
          <p className="text-[11px] italic text-muted-foreground">
            Sem texto da narração neste intervalo
          </p>
        )}
        <p className="line-clamp-2 text-xs text-muted-foreground" title={broll.image_prompt}>
          {broll.image_prompt}
        </p>
        <div
          className="flex flex-wrap gap-2 pt-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            disabled={interactionDisabled}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" /> Prompt
          </Button>
          {broll.imageUrl && (
            <EditImageDialog
              projectId={projectId}
              targetType="broll"
              targetId={targetId}
              title={title}
              disabled={isGenerating || interactionDisabled}
              onStarted={onEditStarted}
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                disabled={isGenerating || interactionDisabled}
                onClick={onRegenerate}
                aria-label={broll.imageUrl ? "Regenerar imagem" : "Gerar imagem"}
              >
                {isGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {broll.imageUrl ? "Regenerar imagem" : "Gerar imagem"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>

      <AssetLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={broll.imageUrl ?? null}
        title={title}
        badge="B-roll"
        description={
          narrationText
            ? `${timing} · “${narrationText}”`
            : `${timing} · ${broll.timestamp_display}`
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Prompt visual — {title}</DialogTitle>
            <DialogDescription>
              Em inglês, otimizado para o modelo de imagem. Inclui o suffix de estilo do
              projeto; edite e regenere a imagem se necessário.
            </DialogDescription>
          </DialogHeader>
          {narrationText ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Narração neste trecho</p>
              <p>“{narrationText}”</p>
            </div>
          ) : null}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-40 font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePrompt} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
