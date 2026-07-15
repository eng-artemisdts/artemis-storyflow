"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createCharacter,
  createScenario,
  createScene,
  type CreatedGraphPayload,
} from "@/actions/asset.actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export type EntityKind = "character" | "scenario" | "scene";

const LABELS: Record<
  EntityKind,
  { title: string; description: string; trigger: string }
> = {
  character: {
    title: "Novo personagem",
    description: "Descreva aparência e personalidade. O prompt visual pode ser gerado a partir da descrição.",
    trigger: "Personagem",
  },
  scenario: {
    title: "Novo cenário",
    description: "Descreva o ambiente, luz e atmosfera. O prompt visual pode seguir a descrição.",
    trigger: "Cenário",
  },
  scene: {
    title: "Nova cena",
    description: "Defina título, resumo e o prompt cinematográfico usado na geração de vídeo.",
    trigger: "Cena",
  },
};

export function AddEntityDialog({
  projectId,
  kind,
  scenarios = [],
  characters = [],
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerLabel,
  onCreated,
}: {
  projectId: string;
  kind: EntityKind;
  scenarios?: Array<{ id: string; name: string }>;
  characters?: Array<{ id: string; name: string }>;
  triggerVariant?: "outline" | "secondary" | "default" | "ghost";
  triggerSize?: "sm" | "default" | "icon";
  triggerLabel?: string;
  onCreated?: (payload: CreatedGraphPayload & { id: string; kind: EntityKind }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = LABELS[kind];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visualPrompt, setVisualPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [durationSec, setDurationSec] = useState("8");
  const [dialogue, setDialogue] = useState("");
  const [scenarioId, setScenarioId] = useState<string>("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);

  const durationOptions = useMemo(() => ["4", "6", "8", "10", "12"], []);

  function reset() {
    setName("");
    setDescription("");
    setVisualPrompt("");
    setTitle("");
    setSummary("");
    setVideoPrompt("");
    setDurationSec("8");
    setDialogue("");
    setScenarioId("");
    setSelectedCharacterIds([]);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function toggleCharacter(id: string, checked: boolean) {
    setSelectedCharacterIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      if (kind === "character") {
        const result = await createCharacter({
          projectId,
          name,
          description,
          visualPrompt: visualPrompt || undefined,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Personagem criado");
        onCreated?.({ ...result.data, kind });
        handleOpenChange(false);
        return;
      }

      if (kind === "scenario") {
        const result = await createScenario({
          projectId,
          name,
          description,
          visualPrompt: visualPrompt || undefined,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Cenário criado");
        onCreated?.({ ...result.data, kind });
        handleOpenChange(false);
        return;
      }

      const result = await createScene({
        projectId,
        title,
        summary,
        videoPrompt,
        durationSec: Number(durationSec) || 8,
        dialogue: dialogue.trim() || null,
        scenarioId: scenarioId || null,
        characterIds: selectedCharacterIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cena criada");
      onCreated?.({ ...result.data, kind });
      handleOpenChange(false);
    });
  }

  const canSubmit =
    kind === "scene"
      ? Boolean(title.trim() && summary.trim() && videoPrompt.trim())
      : Boolean(name.trim() && description.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          <Plus className="size-3.5" />
          {triggerLabel ?? meta.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        {kind !== "scene" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`entity-name-${kind}`}>Nome</Label>
              <Input
                id={`entity-name-${kind}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === "character" ? "Ex.: Joana d'Arc" : "Ex.: Campo de Crécy"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`entity-desc-${kind}`}>Descrição</Label>
              <Textarea
                id={`entity-desc-${kind}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24"
                placeholder="Aparência, época, clima visual..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`entity-prompt-${kind}`}>Prompt visual (opcional)</Label>
              <Textarea
                id={`entity-prompt-${kind}`}
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                className="min-h-20 font-mono text-xs"
                placeholder="Se vazio, usa a descrição"
              />
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="scene-title">Título</Label>
              <Input
                id="scene-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: 1337 — A Coroa e a Fenda"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-summary">Resumo</Label>
              <Textarea
                id="scene-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scene-video-prompt">Prompt de vídeo</Label>
              <Textarea
                id="scene-video-prompt"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="min-h-28 font-mono text-xs"
                placeholder="Sujeito + ação + câmera + iluminação + áudio..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duração</Label>
                <Select value={durationSec} onValueChange={setDurationSec}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cenário (opcional)</Label>
                <Select
                  value={scenarioId || "__none__"}
                  onValueChange={(v) => setScenarioId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {scenarios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {characters.length > 0 && (
              <div className="space-y-2">
                <Label>Personagens nesta cena</Label>
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border p-2">
                  {characters.map((c) => {
                    const checked = selectedCharacterIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleCharacter(c.id, v === true)}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="scene-dialogue">Diálogo / narração (opcional)</Label>
              <Textarea
                id="scene-dialogue"
                value={dialogue}
                onChange={(e) => setDialogue(e.target.value)}
                className="min-h-16"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
