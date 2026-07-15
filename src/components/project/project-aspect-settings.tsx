"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveVideoAspectRatio } from "@/actions/project.actions";
import { AspectRatioPicker } from "@/components/project/aspect-ratio-picker";
import {
  resolveVideoAspectRatio,
  type VideoAspectRatio,
} from "@/lib/video-aspect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProjectAspectSettings({
  projectId,
  currentAspectRatio,
}: {
  projectId: string;
  currentAspectRatio: string | null;
}) {
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>(
    resolveVideoAspectRatio(currentAspectRatio)
  );
  const [isSaving, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setVideoAspectRatio(resolveVideoAspectRatio(currentAspectRatio));
  }, [currentAspectRatio]);

  function handleAspectChange(next: VideoAspectRatio) {
    const previous = videoAspectRatio;
    setVideoAspectRatio(next);
    startTransition(async () => {
      const result = await saveVideoAspectRatio({
        projectId,
        videoAspectRatio: next,
      });
      if (!result.ok) {
        setVideoAspectRatio(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Formato ${next} salvo`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Formato deste vídeo</CardTitle>
        <CardDescription>
          Proporção usada na geração dos clipes e keyframes. A alteração é salva na hora.
          {isSaving ? " Salvando…" : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AspectRatioPicker
          value={videoAspectRatio}
          onChange={handleAspectChange}
          className={isSaving ? "pointer-events-none opacity-70" : undefined}
        />
      </CardContent>
    </Card>
  );
}
