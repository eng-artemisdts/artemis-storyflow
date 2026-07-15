"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteEntity } from "@/actions/asset.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LABELS = {
  character: { noun: "personagem", article: "este", past: "excluído" },
  scenario: { noun: "cenário", article: "este", past: "excluído" },
  scene: { noun: "cena", article: "esta", past: "excluída" },
} as const;

export function DeleteEntityButton({
  projectId,
  targetType,
  targetId,
  name,
  variant = "outline",
  size = "sm",
  iconOnly = false,
  onDeleted,
}: {
  projectId: string;
  targetType: "character" | "scenario" | "scene";
  targetId: string;
  name: string;
  variant?: "outline" | "ghost" | "destructive";
  size?: "sm" | "icon" | "default";
  iconOnly?: boolean;
  onDeleted?: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const label = LABELS[targetType];

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEntity({ projectId, targetType, targetId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${label.noun[0].toUpperCase()}${label.noun.slice(1)} ${label.past}`
      );
      setOpen(false);
      onDeleted?.(result.data.nodeId);
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={iconOnly ? "size-6 text-destructive hover:text-destructive" : undefined}
        title={`Excluir ${label.noun}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
        {!iconOnly && "Excluir"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {label.noun}?</DialogTitle>
            <DialogDescription>
              {label.article[0].toUpperCase()}
              {label.article.slice(1)} {label.noun} <strong>{name}</strong> será removido
              permanentemente do projeto e do whiteboard. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
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
