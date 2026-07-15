"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

/** Visualização ampliada de um asset (personagem/cenário/keyframe). */
export function AssetLightbox({
  open,
  onOpenChange,
  imageUrl,
  title,
  badge,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title: string;
  badge?: string;
  description?: string;
}) {
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[92vw] gap-3 border-neutral-800 bg-neutral-950/95 p-3 sm:max-w-4xl"
        showCloseButton
      >
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle className="truncate text-base font-medium">{title}</DialogTitle>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="max-h-[78vh] w-full rounded-lg object-contain"
        />
        {description && (
          <p className="max-h-24 overflow-auto text-sm text-muted-foreground">{description}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
