"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeScript } from "@/actions/script.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import {
  generateAllAssetImages,
  generateAllKeyframes,
  generateAssetImage,
} from "@/actions/asset.actions";
import { useJobPolling } from "@/hooks/use-job-polling";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetCard } from "@/components/assets/asset-card";
import { AddEntityDialog } from "@/components/assets/add-entity-dialog";
import { DeleteEntityButton } from "@/components/assets/delete-entity-button";
import { EditImageDialog } from "@/components/assets/edit-image-dialog";
import type { Character, Scenario, Scene } from "@/generated/prisma/client";

export function AssetsView({
  projectId,
  hasScript,
  characters,
  scenarios,
  scenes,
  activeJobIds,
}: {
  projectId: string;
  hasScript: boolean;
  characters: Character[];
  scenarios: Scenario[];
  scenes: Scene[];
  activeJobIds: string[];
}) {
  const router = useRouter();
  const [isAnalyzing, startAnalyze] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [busyTargets, setBusyTargets] = useState<Set<string>>(new Set());

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
    if (job.status === "queued" || job.status === "running") runningTargets.add(job.targetId);
  }
  for (const t of busyTargets) runningTargets.add(t);

  const hasEntities = characters.length + scenarios.length + scenes.length > 0;

  function handleAnalyze() {
    startAnalyze(async () => {
      const result = await analyzeScript({ projectId, ai: getAiClientContext() });
      if (result.ok) {
        toast.success("Roteiro analisado — personagens, cenários e cenas extraídos");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleGenerateAll() {
    startGenerate(async () => {
      const result = await generateAllAssetImages({ projectId });
      if (result.ok) {
        if (result.data.jobIds.length === 0) {
          toast.info("Todos os personagens e cenários já têm imagem");
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

  function handleGenerateKeyframes() {
    startGenerate(async () => {
      const result = await generateAllKeyframes({ projectId });
      if (result.ok) {
        if (result.data.jobIds.length === 0) {
          toast.info("Todas as cenas já têm keyframe");
        } else {
          toast.success(`${result.data.jobIds.length} keyframes em geração`);
          track(result.data.jobIds);
          router.refresh();
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRegenerate(
    targetType: "character" | "scenario" | "scene_keyframe",
    targetId: string
  ) {
    setBusyTargets((prev) => new Set(prev).add(targetId));
    void (async () => {
      const result = await generateAssetImage({ projectId, targetType, targetId, ai: getAiClientContext() });
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Análise & Assets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Extraia elementos com a IA ou adicione personagens, cenários e cenas manualmente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasScript && (
            <Button
              variant={hasEntities ? "outline" : "default"}
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {hasEntities ? "Reanalisar roteiro" : "Analisar roteiro"}
            </Button>
          )}
          {!hasScript && (
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/script`}>Escrever roteiro</Link>
            </Button>
          )}
          {hasEntities && (
            <>
              <Button onClick={handleGenerateAll} disabled={isGenerating}>
                <ImageIcon className="size-4" /> Gerar todas as imagens
              </Button>
              <Button variant="outline" onClick={handleGenerateKeyframes} disabled={isGenerating}>
                <RefreshCw className="size-4" /> Gerar keyframes das cenas
              </Button>
              <Button variant="secondary" asChild>
                <Link href={`/projects/${projectId}/whiteboard`}>
                  Whiteboard <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {isAnalyzing && !hasEntities && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-xl" />
          ))}
        </div>
      )}

      {!(isAnalyzing && !hasEntities) && (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <Users className="size-5" /> Personagens
                <Badge variant="secondary">{characters.length}</Badge>
              </h2>
              <AddEntityDialog
                projectId={projectId}
                kind="character"
                onCreated={() => router.refresh()}
              />
            </div>
            {characters.length === 0 ? (
              <EmptyHint text="Nenhum personagem ainda. Analise o roteiro ou adicione um manualmente." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {characters.map((c) => (
                  <AssetCard
                    key={c.id}
                    projectId={projectId}
                    name={c.name}
                    description={c.description}
                    visualPrompt={c.visualPrompt}
                    imageUrl={c.imageUrl}
                    isGenerating={runningTargets.has(c.id)}
                    targetType="character"
                    targetId={c.id}
                    onRegenerate={() => handleRegenerate("character", c.id)}
                    onEditStarted={(jobId) => handleEditStarted(c.id, jobId)}
                    onDeleted={() => router.refresh()}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <MapPin className="size-5" /> Cenários
                <Badge variant="secondary">{scenarios.length}</Badge>
              </h2>
              <AddEntityDialog
                projectId={projectId}
                kind="scenario"
                onCreated={() => router.refresh()}
              />
            </div>
            {scenarios.length === 0 ? (
              <EmptyHint text="Nenhum cenário ainda. Analise o roteiro ou adicione um manualmente." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {scenarios.map((s) => (
                  <AssetCard
                    key={s.id}
                    projectId={projectId}
                    name={s.name}
                    description={s.description}
                    visualPrompt={s.visualPrompt}
                    imageUrl={s.imageUrl}
                    isGenerating={runningTargets.has(s.id)}
                    targetType="scenario"
                    targetId={s.id}
                    onRegenerate={() => handleRegenerate("scenario", s.id)}
                    onEditStarted={(jobId) => handleEditStarted(s.id, jobId)}
                    onDeleted={() => router.refresh()}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-medium">
                <Film className="size-5" /> Cenas
                <Badge variant="secondary">{scenes.length}</Badge>
              </h2>
              <AddEntityDialog
                projectId={projectId}
                kind="scene"
                scenarios={scenarios.map((s) => ({ id: s.id, name: s.name }))}
                characters={characters.map((c) => ({ id: c.id, name: c.name }))}
                onCreated={() => router.refresh()}
              />
            </div>
            {scenes.length === 0 ? (
              <EmptyHint text="Nenhuma cena ainda. Analise o roteiro ou adicione uma manualmente." />
            ) : (
              <div className="space-y-3">
                {scenes.map((scene) => (
                  <Card key={scene.id}>
                    <CardContent className="flex gap-4 py-4">
                      <div className="relative aspect-video w-44 shrink-0 overflow-hidden rounded-md bg-muted">
                        {scene.keyframeUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={scene.keyframeUrl}
                            alt={scene.title}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            {runningTargets.has(scene.id) ? (
                              <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            ) : (
                              <ImageIcon className="size-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{scene.order}</Badge>
                          <h3 className="truncate font-medium">{scene.title}</h3>
                          <Badge variant="secondary">{scene.durationSec}s</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {scene.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {scene.keyframeUrl && (
                            <EditImageDialog
                              projectId={projectId}
                              targetType="scene_keyframe"
                              targetId={scene.id}
                              title={scene.title}
                              disabled={runningTargets.has(scene.id)}
                              onStarted={(jobId) => handleEditStarted(scene.id, jobId)}
                            />
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={runningTargets.has(scene.id)}
                            onClick={() => handleRegenerate("scene_keyframe", scene.id)}
                          >
                            {runningTargets.has(scene.id) ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5" />
                            )}
                            {scene.keyframeUrl ? "Regenerar keyframe" : "Gerar keyframe"}
                          </Button>
                          <DeleteEntityButton
                            projectId={projectId}
                            targetType="scene"
                            targetId={scene.id}
                            name={scene.title}
                            onDeleted={() => router.refresh()}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
