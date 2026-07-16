"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Ban,
  Check,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { saveProjectStyle } from "@/actions/project.actions";
import {
  createCustomStyle,
  deleteCustomStyle,
  generateCustomStylePreview,
  updateCustomStyle,
  type CustomStyleDTO,
} from "@/actions/style.actions";
import { AI_CONTEXT_HEADER } from "@/lib/ai-settings";
import {
  encodeAiContextHeader,
  getAiClientContext,
} from "@/lib/ai-settings-storage";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { useImageGenErrorAlert } from "@/hooks/use-image-gen-error-alert";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PolledJob = {
  id: string;
  status: string;
  resultUrl?: string | null;
  error?: string | null;
};

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

export function StylePicker({
  projectId,
  currentStyleId,
  initialCustomStyles = [],
}: {
  projectId: string;
  currentStyleId: string | null;
  initialCustomStyles?: CustomStyleDTO[];
}) {
  const [selected, setSelected] = useState<string | null>(currentStyleId);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [customStyles, setCustomStyles] = useState(initialCustomStyles);
  const [, startTransition] = useTransition();
  const { reportImageGenError, alertDialog } = useImageGenErrorAlert();

  useEffect(() => {
    setCustomStyles(initialCustomStyles);
  }, [initialCustomStyles]);

  function findLabel(styleId: string | null) {
    if (!styleId) return "Sem estilo";
    return (
      STYLE_PRESETS.find((p) => p.id === styleId)?.label ??
      customStyles.find((s) => s.id === styleId)?.title ??
      styleId
    );
  }

  function handleSelect(styleId: string | null) {
    if (styleId === selected) return;
    const previous = selected;
    setSelected(styleId);
    setSavingId(styleId ?? "none");
    startTransition(async () => {
      const result = await saveProjectStyle({ projectId, styleId });
      setSavingId(null);
      if (result.ok) {
        toast.success(`Estilo definido: ${findLabel(styleId)}`);
      } else {
        setSelected(previous);
        toast.error(result.error);
      }
    });
  }

  function handleCreated(style: CustomStyleDTO) {
    setCustomStyles((prev) => [style, ...prev]);
    handleSelect(style.id);
  }

  function handleUpdated(style: CustomStyleDTO) {
    setCustomStyles((prev) => prev.map((s) => (s.id === style.id ? style : s)));
  }

  function handleDeleted(id: string) {
    setCustomStyles((prev) => prev.filter((s) => s.id !== id));
    if (selected === id) {
      setSelected(null);
    }
  }

  return (
    <div className="space-y-6">
      {alertDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Meus estilos</h2>
          <p className="text-xs text-muted-foreground">
            Cadastre um título e o prompt do estilo para reutilizar em projetos.
          </p>
        </div>
        <CustomStyleDialog
          mode="create"
          projectId={projectId}
          onSaved={handleCreated}
          onPreviewError={reportImageGenError}
        />
      </div>

      {customStyles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customStyles.map((style) => {
            const isActive = selected === style.id;
            return (
              <div
                key={style.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors",
                  isActive && "border-primary ring-2 ring-primary/30"
                )}
              >
                <SelectionBadge active={isActive} saving={savingId === style.id} />
                <div className="absolute bottom-3 right-3 z-10">
                  <CustomStyleMenu
                    projectId={projectId}
                    style={style}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                    onPreviewError={reportImageGenError}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSelect(style.id)}
                  className="flex w-full flex-col items-stretch text-left"
                >
                  <div className="relative aspect-video w-full bg-muted">
                    {style.previewImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={style.previewImageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <Sparkles className="size-7 opacity-50" />
                        <span className="text-[11px]">Sem preview</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 p-4 pb-10">
                    <span className="pr-8 font-medium">{style.title}</span>
                    <span className="line-clamp-3 text-sm text-muted-foreground">
                      {style.prompt}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium">Presets</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50",
              selected === null && "border-primary ring-2 ring-primary/30"
            )}
          >
            <SelectionBadge active={selected === null} saving={savingId === "none"} />
            <span className="text-3xl leading-none">
              <Ban className="size-7 text-muted-foreground" />
            </span>
            <span className="font-medium">Sem estilo</span>
            <span className="text-sm text-muted-foreground">
              Usa os prompts exatamente como saíram da análise do roteiro, sem nenhuma
              estilização extra.
            </span>
          </button>

          {STYLE_PRESETS.map((preset) => {
            const isActive = selected === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-2 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/50",
                  isActive && "border-primary ring-2 ring-primary/30"
                )}
              >
                <SelectionBadge active={isActive} saving={savingId === preset.id} />
                <span className="text-3xl leading-none">{preset.icon}</span>
                <span className="font-medium">{preset.label}</span>
                <span className="text-sm text-muted-foreground">{preset.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SelectionBadge({ active, saving }: { active: boolean; saving: boolean }) {
  if (saving) {
    return (
      <Badge className="absolute right-3 top-3 z-10 gap-1" variant="secondary">
        <Loader2 className="size-3 animate-spin" /> salvando
      </Badge>
    );
  }
  if (active) {
    return (
      <Badge className="absolute right-3 top-3 z-10 gap-1">
        <Check className="size-3" /> selecionado
      </Badge>
    );
  }
  return null;
}

function CustomStyleMenu({
  projectId,
  style,
  onUpdated,
  onDeleted,
  onPreviewError,
}: {
  projectId: string;
  style: CustomStyleDTO;
  onUpdated: (style: CustomStyleDTO) => void;
  onDeleted: (id: string) => void;
  onPreviewError: (error: string | null | undefined) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCustomStyle({ id: style.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Estilo excluído");
      setDeleteOpen(false);
      onDeleted(style.id);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 bg-background/80 opacity-70 backdrop-blur-sm hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Opções do estilo</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomStyleDialog
        mode="edit"
        projectId={projectId}
        style={style}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onUpdated}
        onPreviewError={onPreviewError}
        hideTrigger
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Excluir estilo?</DialogTitle>
            <DialogDescription>
              O estilo <strong>{style.title}</strong> será removido permanentemente.
              Projetos que o usam ficam sem estilo selecionado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CustomStyleDialog({
  mode,
  projectId,
  style,
  onSaved,
  onPreviewError,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  mode: "create" | "edit";
  projectId: string;
  style?: CustomStyleDTO;
  onSaved: (style: CustomStyleDTO) => void;
  onPreviewError: (error: string | null | undefined) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;
  const [isPending, startTransition] = useTransition();
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [title, setTitle] = useState(style?.title ?? "");
  const [prompt, setPrompt] = useState(style?.prompt ?? "");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(
    style?.previewImageUrl ?? null
  );

  function reset() {
    setTitle(style?.title ?? "");
    setPrompt(style?.prompt ?? "");
    setPreviewImageUrl(style?.previewImageUrl ?? null);
    setIsPreviewing(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTitle(style?.title ?? "");
      setPrompt(style?.prompt ?? "");
      setPreviewImageUrl(style?.previewImageUrl ?? null);
      setIsPreviewing(false);
    } else {
      reset();
    }
  }

  async function handlePreview() {
    const trimmed = prompt.trim();
    if (!trimmed || isPreviewing || isPending) return;

    setIsPreviewing(true);
    try {
      const result = await generateCustomStylePreview({
        projectId,
        prompt: trimmed,
        styleId: mode === "edit" ? style?.id : undefined,
        ai: getAiClientContext(),
      });
      if (!result.ok) {
        onPreviewError(result.error);
        return;
      }

      const finished = await waitForImageJob(result.data.jobId);
      if (!finished) {
        toast.error("Timeout ao gerar preview");
        return;
      }
      if (finished.status === "failed") {
        onPreviewError(finished.error);
        return;
      }
      if (!finished.resultUrl) {
        toast.error("Preview gerado sem URL de imagem");
        return;
      }

      setPreviewImageUrl(finished.resultUrl);
      toast.success("Preview gerado");

      // Em edição, o syncJob já grava no CustomStyle; sincroniza o card pai.
      if (mode === "edit" && style) {
        onSaved({
          ...style,
          title: title.trim() || style.title,
          prompt: trimmed,
          previewImageUrl: finished.resultUrl,
        });
      }
    } catch (err) {
      onPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPreviewing(false);
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      if (mode === "create") {
        const result = await createCustomStyle({
          title,
          prompt,
          previewImageUrl,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Estilo cadastrado");
        onSaved(result.data);
        handleOpenChange(false);
        return;
      }

      if (!style) return;
      const result = await updateCustomStyle({
        id: style.id,
        title,
        prompt,
        previewImageUrl,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Estilo atualizado");
      onSaved(result.data);
      handleOpenChange(false);
    });
  }

  const canSubmit = Boolean(title.trim() && prompt.trim()) && !isPreviewing;
  const canPreview = Boolean(prompt.trim()) && !isPreviewing && !isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button type="button" size="sm">
            <Plus className="size-3.5" />
            Novo estilo
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo estilo" : "Editar estilo"}
          </DialogTitle>
          <DialogDescription>
            Informe um título e o prompt. Use Preview para gerar uma imagem de exemplo
            do card.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="custom-style-title">Título</Label>
            <Input
              id="custom-style-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Aquarela urbana noturna"
              maxLength={120}
              disabled={isPreviewing}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-style-prompt">Prompt do estilo</Label>
            <Textarea
              id="custom-style-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-32 font-mono text-xs"
              placeholder="Descreva iluminação, texturas, paleta, linguagem visual..."
              maxLength={4000}
              disabled={isPreviewing}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Imagem de exemplo</Label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canPreview}
                onClick={() => void handlePreview()}
              >
                {isPreviewing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="size-3.5" />
                )}
                {isPreviewing ? "Gerando…" : "Preview"}
              </Button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
              {previewImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImageUrl}
                  alt="Preview do estilo"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-muted-foreground">
                  <ImageIcon className="size-6 opacity-40" />
                  <p className="text-xs">
                    {prompt.trim()
                      ? "Clique em Preview para gerar uma imagem de exemplo."
                      : "Defina o prompt do estilo para habilitar o preview."}
                  </p>
                </div>
              )}
              {isPreviewing ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                  <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                    <Loader2 className="size-3.5 animate-spin" />
                    Gerando preview…
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending || isPreviewing}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Cadastrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
