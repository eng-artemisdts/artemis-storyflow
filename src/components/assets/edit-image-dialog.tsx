"use client";

import { useState, useTransition } from "react";
import { Loader2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { editAssetImage } from "@/actions/asset.actions";
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

type ImageTargetType = "character" | "scenario" | "scene_keyframe" | "broll";

export function EditImageDialog({
  projectId,
  targetType,
  targetId,
  title,
  disabled,
  onStarted,
}: {
  projectId: string;
  targetType: ImageTargetType;
  targetId: string;
  title: string;
  disabled?: boolean;
  onStarted?: (jobId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await editAssetImage({
        projectId,
        targetType,
        targetId,
        editPrompt: prompt,
        ai: getAiClientContext(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Edição de imagem enfileirada");
      setOpen(false);
      setPrompt("");
      onStarted?.(result.data.jobId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <WandSparkles className="size-3.5" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar imagem — {title}</DialogTitle>
          <DialogDescription>
            Descreva só o que deve mudar. A imagem atual é usada como base.
            Instruções curtas funcionam melhor (ex.: &quot;Add a red cape&quot;,
            &quot;Make the lighting warmer&quot;).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor={`edit-image-${targetId}`}>Instrução de edição</Label>
          <Textarea
            id={`edit-image-${targetId}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-28"
            placeholder="Ex.: Change the jacket to deep green velvet. Keep everything else the same."
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
