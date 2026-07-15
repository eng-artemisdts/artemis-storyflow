"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/video-player";

/** Lightbox de clipe gerado — player ampliado. */
export function VideoLightbox({
  open,
  onOpenChange,
  videoUrl,
  poster,
  title,
  badge,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  poster?: string | null;
  title: string;
  badge?: string;
  description?: string;
}) {
  if (!videoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[94vw] gap-3 border-neutral-800 bg-neutral-950/95 p-3 sm:max-w-5xl"
        showCloseButton
      >
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle className="truncate text-base font-medium">{title}</DialogTitle>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
          <VideoPlayer src={videoUrl} poster={poster} autoPlay className="size-full" />
        </div>
        {description && (
          <p className="max-h-24 overflow-auto text-sm text-muted-foreground">{description}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
