"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DurationMinutesPicker } from "@/components/channel/duration-minutes-picker";
import { VideoKindPicker } from "@/components/project/video-kind-picker";
import type { VideoKind } from "@/lib/video-kind";

export function CreateProjectDialog({
  channelId,
  defaultDurationMin,
  videoAspectRatio,
}: {
  channelId: string;
  defaultDurationMin: number;
  videoAspectRatio: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [videoKind, setVideoKind] = useState<VideoKind | null>(null);
  const [videoTopic, setVideoTopic] = useState("");
  const [targetDurationMin, setTargetDurationMin] = useState(defaultDurationMin);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName("");
    setVideoKind(null);
    setVideoTopic("");
    setTargetDurationMin(defaultDurationMin);
  }

  function handleCreate() {
    if (!videoKind) {
      toast.error("Selecione o tipo do vídeo: Motion ou Static");
      return;
    }
    if (!name.trim()) {
      toast.error("Dê um nome ao projeto");
      return;
    }
    if (videoKind === "static" && videoTopic.trim().length < 3) {
      toast.error("Informe o tópico do vídeo");
      return;
    }

    startTransition(async () => {
      const result = await createProject({
        name,
        channelId,
        videoKind,
        targetDurationMin,
        videoTopic: videoKind === "static" ? videoTopic : "",
      });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            Formato {videoAspectRatio} herdado do canal. Escolha o tipo de produção e ajuste a
            duração só se este vídeo for diferente da média.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de vídeo</Label>
            <VideoKindPicker value={videoKind} onChange={setVideoKind} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-name">Nome do projeto</Label>
            <Input
              id="project-name"
              placeholder="Ex.: O custo silencioso de desistir"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>

          {videoKind === "static" && (
            <div className="space-y-2">
              <Label htmlFor="video-topic">Tópico do vídeo</Label>
              <Textarea
                id="video-topic"
                placeholder="Ex.: Guerra dos Cem Anos — por que durou tanto e o que mudou no final"
                value={videoTopic}
                onChange={(e) => setVideoTopic(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Usado para preencher o master prompt do canal (CHANNEL CONFIG + VIDEO_TOPIC).
              </p>
            </div>
          )}

          <DurationMinutesPicker
            value={targetDurationMin}
            onChange={setTargetDurationMin}
            label="Duração deste vídeo"
            hint="Pré-preenchida com a média do canal. Altere só se necessário."
            showScriptPreview={videoKind !== "static"}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !videoKind}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Criar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
