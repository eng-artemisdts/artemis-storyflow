"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleHelp,
  Clapperboard,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateAllBrollImages,
  generateProjectBrolls,
  getBrollsGenerationPromptMd,
  updateBrollPrompt,
} from "@/actions/brolls.actions";
import { generateAssetImage } from "@/actions/asset.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import { downloadBrollsJson, downloadBrollsPromptMd, formatTimestamp } from "@/lib/transcription";
import type { ProjectBroll, ProjectBrolls } from "@/lib/schemas/brolls";
import { useJobPolling } from "@/hooks/use-job-polling";
import { AssetLightbox } from "@/components/asset-lightbox";
import { EditImageDialog } from "@/components/assets/edit-image-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ScenesBrollsView({
  projectId,
  projectName,
  hasTranscription,
  hasStyle,
  styleLabel,
  initialBrolls,
  activeJobIds,
}: {
  projectId: string;
  projectName: string;
  hasTranscription: boolean;
  hasStyle: boolean;
  styleLabel: string | null;
  initialBrolls: ProjectBrolls | null;
  activeJobIds: string[];
}) {
  const router = useRouter();
  const [brollsData, setBrollsData] = useState(initialBrolls);
  const [isAnalyzing, startAnalyze] = useTransition();
  const [isGeneratingAll, startGenerateAll] = useTransition();
  const [isExportingPrompt, startExportPrompt] = useTransition();
  const [busyTargets, setBusyTargets] = useState<Set<string>>(new Set());

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
      if (job.status === "succeeded") router.refresh();
      else toast.error(`Falha na geração: ${job.error ?? "erro desconhecido"}`);
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

  function handleAnalyze() {
    if (!hasTranscription) {
      toast.error("Gere a transcrição antes");
      return;
    }
    startAnalyze(async () => {
      const result = await generateProjectBrolls({
        projectId,
        ai: getAiClientContext(),
      });
      if (result.ok) {
        setBrollsData(result.data.brolls);
        toast.success(`${result.data.brolls.brolls.length} b-rolls gerados`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleGenerateAll() {
    startGenerateAll(async () => {
      const result = await generateAllBrollImages({
        projectId,
        ai: getAiClientContext(),
      });
      if (result.ok) {
        if (result.data.jobIds.length === 0) {
          toast.info("Todas as cenas já têm imagem");
        } else {
          toast.success(`${result.data.jobIds.length} gerações iniciadas`);
          track(result.data.jobIds);
          router.refresh();
        }
      } else {
        toast.error(result.error);
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
    <div className="flex w-full min-w-0 flex-col gap-6">
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
              </>
            )}
          </div>
          <p className="max-w-2xl text-xs text-muted-foreground">
            O LLM monta b-rolls (3–7s) com prompt de imagem e intervalo de tempo. Gere,
            edite o prompt ou regenere as imagens como nos assets do motion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={list.length > 0 ? "outline" : "default"}
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : list.length > 0 ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isAnalyzing
              ? "Gerando cenas…"
              : list.length > 0
                ? "Gerar cenas novamente"
                : "Analisar e gerar cenas"}
          </Button>
          {list.length > 0 && (
            <>
              <Button onClick={handleGenerateAll} disabled={isGeneratingAll || isAnalyzing}>
                {isGeneratingAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                Gerar todas as imagens
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

      {isAnalyzing && list.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((broll) => {
            const targetId = String(broll.id);
            return (
              <BrollCard
                key={broll.id}
                projectId={projectId}
                broll={broll}
                isGenerating={runningTargets.has(targetId)}
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
  );
}

function BrollCard({
  projectId,
  broll,
  isGenerating,
  onRegenerate,
  onEditStarted,
  onPromptSaved,
}: {
  projectId: string;
  broll: ProjectBroll;
  isGenerating: boolean;
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
    <Card className="overflow-hidden py-0 gap-0">
      <div className="relative aspect-video bg-muted">
        {broll.imageUrl ? (
          <button
            type="button"
            className="block size-full cursor-zoom-in"
            title="Ampliar imagem"
            onClick={() => setLightboxOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={broll.imageUrl}
              alt={broll.concept}
              className="size-full object-cover"
            />
          </button>
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
        <Badge className="absolute left-2 top-2 font-mono tabular-nums" variant="secondary">
          #{broll.id}
        </Badge>
      </div>
      <CardContent className="space-y-2 p-4">
        <h3 className="font-medium leading-snug">{broll.concept}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground" title={broll.image_prompt}>
          {broll.image_prompt}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {broll.duration.toFixed(1)}s · {timing}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Prompt
          </Button>
          {broll.imageUrl && (
            <EditImageDialog
              projectId={projectId}
              targetType="broll"
              targetId={targetId}
              title={title}
              disabled={isGenerating}
              onStarted={onEditStarted}
            />
          )}
          <Button size="sm" variant="outline" disabled={isGenerating} onClick={onRegenerate}>
            {isGenerating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {broll.imageUrl ? "Regenerar" : "Gerar"}
          </Button>
        </div>
      </CardContent>

      <AssetLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={broll.imageUrl ?? null}
        title={title}
        badge="B-roll"
        description={`${timing} · ${broll.timestamp_display}`}
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
