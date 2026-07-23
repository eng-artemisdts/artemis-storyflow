"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { GripVertical, ImageUp, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  isImageFile,
  isZipFile,
  parseBrollIdFromFilename,
} from "@/lib/brolls/google-flow";
import { extractImagesFromFlowZip } from "@/lib/brolls/extract-flow-zip";
import type { ProjectBroll } from "@/lib/schemas/brolls";
import { formatTimestamp } from "@/lib/transcription";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StagedFile = {
  key: string;
  file: File;
  brollId: number | null;
  previewUrl: string;
};

/** Limites por requisição de upload (evita timeout com muitas imagens). */
const UPLOAD_BATCH_MAX_FILES = 5;
const UPLOAD_BATCH_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Divide os arquivos em lotes pequenos por quantidade e tamanho acumulado.
 * Um arquivo maior que o limite vai sozinho no lote (o servidor decide
 * se aceita ou ignora).
 */
function chunkForUpload(items: StagedFile[]): StagedFile[][] {
  const chunks: StagedFile[][] = [];
  let current: StagedFile[] = [];
  let currentBytes = 0;
  for (const item of items) {
    const wouldOverflow =
      current.length >= UPLOAD_BATCH_MAX_FILES ||
      (current.length > 0 && currentBytes + item.file.size > UPLOAD_BATCH_MAX_BYTES);
    if (wouldOverflow) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += item.file.size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function stageFiles(files: File[], brollIds: Set<number>): StagedFile[] {
  return files.filter(isImageFile).map((file) => {
    const parsed = parseBrollIdFromFilename(file.name);
    return {
      key: fileKey(file),
      file,
      brollId: parsed != null && brollIds.has(parsed) ? parsed : null,
      previewUrl: URL.createObjectURL(file),
    };
  });
}

export function FlowImportDialog({
  projectId,
  brolls,
  open,
  onOpenChange,
  onImported,
}: {
  projectId: string;
  brolls: ProjectBroll[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (updates: Array<{ id: number; imageUrl: string }>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const busy = isPending || isExtractingZip;

  const brollIds = new Set(brolls.map((b) => b.id));
  const assigned = staged.filter((s) => s.brollId != null);
  const unassigned = staged.filter((s) => s.brollId == null);

  const revokeAll = useCallback((items: StagedFile[]) => {
    for (const item of items) URL.revokeObjectURL(item.previewUrl);
  }, []);

  const reset = useCallback(() => {
    setStaged((prev) => {
      revokeAll(prev);
      return [];
    });
    setDragOver(false);
    setDraggingKey(null);
    setDropTargetId(null);
  }, [revokeAll]);

  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  useEffect(() => {
    return () => revokeAll(stagedRef.current);
  }, [revokeAll]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function assignFile(fileKeyValue: string, brollId: number) {
    setStaged((prev) =>
      prev.map((item) => {
        if (item.key === fileKeyValue) return { ...item, brollId };
        if (item.brollId === brollId) return { ...item, brollId: null };
        return item;
      })
    );
    setDraggingKey(null);
    setDropTargetId(null);
  }

  function clearBrollAssignment(brollId: number) {
    setStaged((prev) =>
      prev.map((item) => (item.brollId === brollId ? { ...item, brollId: null } : item))
    );
  }

  async function expandIncomingFiles(files: FileList | File[]): Promise<File[]> {
    const expanded: File[] = [];
    for (const file of Array.from(files)) {
      if (isZipFile(file)) {
        setIsExtractingZip(true);
        try {
          const images = await extractImagesFromFlowZip(file);
          if (images.length === 0) {
            toast.error(`“${file.name}” não contém imagens válidas`);
          } else {
            expanded.push(...images);
            toast.success(`${images.length} imagem(ns) extraída(s) de “${file.name}”`);
          }
        } catch {
          toast.error(`Não foi possível abrir “${file.name}”`);
        } finally {
          setIsExtractingZip(false);
        }
      } else if (isImageFile(file)) {
        expanded.push(file);
      }
    }
    return expanded;
  }

  async function addFiles(files: FileList | File[]) {
    const expanded = await expandIncomingFiles(files);
    const next = stageFiles(expanded, brollIds);
    if (next.length === 0) {
      toast.error("Nenhuma imagem válida (PNG, JPG, WEBP ou .zip com imagens)");
      return;
    }
    setStaged((prev) => {
      const map = new Map<string, StagedFile>();
      for (const item of prev) map.set(item.key, item);
      for (const item of next) {
        const existing = map.get(item.key);
        if (existing) {
          URL.revokeObjectURL(item.previewUrl);
          continue;
        }
        map.set(item.key, item);
      }
      return [...map.values()];
    });
  }

  function removeStaged(key: string) {
    setStaged((prev) => {
      const item = prev.find((s) => s.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((s) => s.key !== key);
    });
  }

  function handleImport() {
    const toUpload = staged.filter((s) => s.brollId != null);
    if (toUpload.length === 0) {
      toast.error("Associe pelo menos uma imagem a uma cena");
      return;
    }

    startTransition(async () => {
      const chunks = chunkForUpload(toUpload);
      const allImported: Array<{ id: number; imageUrl: string }> = [];
      const allSkipped: Array<{ name: string; reason: string }> = [];
      setUploadProgress({ done: 0, total: chunks.length });

      try {
        for (let i = 0; i < chunks.length; i++) {
          const formData = new FormData();
          for (const item of chunks[i]!) {
            formData.append("files", item.file);
            formData.append("brollIds", String(item.brollId));
          }

          let json: {
            ok: boolean;
            error?: string;
            data?: {
              imported: Array<{ id: number; imageUrl: string }>;
              skipped: Array<{ name: string; reason: string }>;
            };
          };
          try {
            const res = await fetch(
              `/api/projects/${projectId}/brolls/import-flow`,
              { method: "POST", body: formData }
            );
            json = (await res.json()) as typeof json;
          } catch {
            json = { ok: false, error: "Falha de rede durante o envio" };
          }

          if (!json.ok || !json.data) {
            // Mantém o que já subiu; remove do staging apenas o que importou.
            if (allImported.length > 0) onImported(allImported);
            toast.error(json.error ?? "Falha ao importar imagens", {
              description:
                allImported.length > 0
                  ? `${allImported.length} imagem(ns) já importada(s) foram mantidas. Tente novamente para enviar o restante.`
                  : undefined,
            });
            const importedIds = new Set(allImported.map((row) => row.id));
            setStaged((prev) =>
              prev.filter((item) => {
                if (item.brollId != null && importedIds.has(item.brollId)) {
                  URL.revokeObjectURL(item.previewUrl);
                  return false;
                }
                return true;
              })
            );
            return;
          }

          allImported.push(...json.data.imported);
          allSkipped.push(...json.data.skipped);
          setUploadProgress({ done: i + 1, total: chunks.length });
        }

        onImported(allImported);
        toast.success(
          `${allImported.length} imagem(ns) importada(s)${allSkipped.length ? ` · ${allSkipped.length} ignorada(s)` : ""}`
        );
        handleOpenChange(false);
      } finally {
        setUploadProgress(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar do Google Flow</DialogTitle>
          <DialogDescription>
            Arraste imagens ou um <span className="font-mono">.zip</span> do Flow. Se o nome
            não tiver o ID da cena, arraste cada imagem até a cena correta abaixo.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif,.zip,application/zip"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={busy}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (busy) return;
            if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
            busy && "pointer-events-none opacity-60"
          )}
        >
          {busy ? (
            <Loader2 className="size-7 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="size-7 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {isExtractingZip
              ? "Extraindo imagens do .zip…"
              : dragOver
                ? "Solte aqui"
                : "Arraste imagens, .zip ou clique para escolher"}
          </span>
        </button>

        {staged.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                {assigned.length} associada(s)
              </span>
              {unassigned.length > 0 ? (
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-800 dark:text-amber-200">
                  {unassigned.length} aguardando cena
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 px-2 text-xs"
                onClick={reset}
                disabled={busy}
              >
                <X className="size-3" /> Limpar tudo
              </Button>
            </div>

            {unassigned.length > 0 ? (
              <div className="shrink-0 space-y-2 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Arraste cada imagem até a cena correspondente ↓
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassigned.map((item) => (
                    <div
                      key={item.key}
                      draggable={!busy}
                      onDragStart={(e) => {
                        setDraggingKey(item.key);
                        e.dataTransfer.setData("text/plain", item.key);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingKey(null);
                        setDropTargetId(null);
                      }}
                      className={cn(
                        "group relative flex w-24 shrink-0 cursor-grab flex-col overflow-hidden rounded-md border bg-background shadow-sm active:cursor-grabbing",
                        draggingKey === item.key && "opacity-50 ring-2 ring-primary"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="aspect-video w-full object-cover"
                        draggable={false}
                      />
                      <div className="flex items-center gap-0.5 px-1 py-0.5">
                        <GripVertical className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate font-mono text-[9px] text-muted-foreground">
                          {item.file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-background/90 p-0.5 opacity-0 shadow transition-opacity group-hover:opacity-100"
                        onClick={() => removeStaged(item.key)}
                        aria-label="Remover imagem"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <ScrollArea className="min-h-0 flex-1 rounded-lg border">
              <ul className="divide-y">
                {brolls.map((broll) => {
                  const mapped = staged.find((s) => s.brollId === broll.id) ?? null;
                  const isDropTarget = dropTargetId === broll.id;
                  return (
                    <li
                      key={broll.id}
                      onDragOver={(e) => {
                        if (!draggingKey || busy) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDropTargetId(broll.id);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDropTargetId((id) => (id === broll.id ? null : id));
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const key =
                          e.dataTransfer.getData("text/plain") || draggingKey;
                        if (key) assignFile(key, broll.id);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 transition-colors",
                        isDropTarget && "bg-primary/10 ring-2 ring-inset ring-primary/40",
                        mapped && "bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40",
                          isDropTarget && !mapped && "border-dashed border-primary"
                        )}
                      >
                        {mapped ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={mapped.previewUrl}
                              alt={mapped.file.name}
                              className="size-full object-cover"
                              draggable={!busy}
                              onDragStart={(e) => {
                                setDraggingKey(mapped.key);
                                e.dataTransfer.setData("text/plain", mapped.key);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => {
                                setDraggingKey(null);
                                setDropTargetId(null);
                              }}
                            />
                          </>
                        ) : (
                          <span className="px-1 text-center text-[10px] text-muted-foreground">
                            {draggingKey ? "Solte aqui" : "—"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="font-mono text-muted-foreground">#{broll.id}</span>{" "}
                          {broll.concept}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {formatTimestamp(broll.start)}–{formatTimestamp(broll.end)}
                        </p>
                        {mapped ? (
                          <p className="truncate font-mono text-[10px] text-primary">
                            {mapped.file.name}
                          </p>
                        ) : null}
                      </div>
                      {mapped ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          disabled={busy}
                          onClick={() => clearBrollAssignment(broll.id)}
                          aria-label={`Desassociar imagem da cena ${broll.id}`}
                        >
                          <X className="size-3.5" />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
        ) : null}

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={busy || assigned.length === 0}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageUp className="size-4" />
            )}
            {isPending && uploadProgress && uploadProgress.total > 1
              ? `Enviando lote ${Math.min(uploadProgress.done + 1, uploadProgress.total)}/${uploadProgress.total}…`
              : `Importar ${assigned.length > 0 ? `(${assigned.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
