"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { VideoKind } from "@/lib/video-kind";

/** Mantém motion e static nas rotas corretas (settings é compartilhada). */
export function VideoKindRouteGuard({
  projectId,
  videoKind,
}: {
  projectId: string;
  videoKind: VideoKind;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname.includes("/settings")) return;

    const staticBase = `/projects/${projectId}/static`;
    const isOnStatic = pathname === staticBase || pathname.startsWith(`${staticBase}/`);

    if (videoKind === "static" && !isOnStatic) {
      router.replace(staticBase);
      return;
    }

    if (videoKind === "motion" && isOnStatic) {
      router.replace(`/projects/${projectId}/script`);
    }
  }, [pathname, projectId, router, videoKind]);

  return null;
}
