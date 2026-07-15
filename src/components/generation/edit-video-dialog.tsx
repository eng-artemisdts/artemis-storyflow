"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { editSceneVideo } from "@/actions/job.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function supportsVideoEdit(provider: string | null, model: string | null): boolean {
  if (provider === "xai") return true;
  if (provider === "gemini" && model && /omni/i.test(model)) return true;
  return false;
}

export function EditVideoDialog({
  projectId,
  sceneId,
  sceneTitle,
  videoProvider,
  videoModel,
  disabled,
  onStarted,
}: {
  projectId: string;
  sceneId: string;
  sceneTitle: string;
  videoProvider: string | null;
  videoModel: string | null;
  disabled?: boolean;
  onStarted?: (jobId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();
  const canEdit = supportsVideoEdit(videoProvider, videoModel);

  function handleSubmit() {
    startTransition(async () => {
      const result = await editSceneVideo({
        projectId,
        sceneId,
        editPrompt: prompt, ai: getAiClientContext() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Edição enfileirada");
      setOpen(false);
      setPrompt("");
      onStarted?.(result.data.jobId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Pencil className="size-4" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar vídeo — {sceneTitle}</DialogTitle>
          <DialogDescription>
            Descreva só o que deve mudar. O modelo preserva o restante da cena.
            Funciona melhor com instruções curtas (ex.: &quot;Add falling snow&quot;,
            &quot;Change the sky to golden hour&quot;).
          </DialogDescription>
        </DialogHeader>

        {!canEdit && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            O provedor/modelo atual não suporta edição. Use{" "}
            <strong>Google Omni Flash</strong> ou <strong>xAI (Grok Imagine)</strong> em
            Configurações.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`edit-prompt-${sceneId}`}>Instrução de edição</Label>
          <Textarea
            id={`edit-prompt-${sceneId}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-28"
            placeholder="Ex.: Add soft snowfall and warm lantern light. Keep everything else the same."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || prompt.trim().length < 3}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Aplicar edição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
