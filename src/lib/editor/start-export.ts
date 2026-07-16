import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resolveAppOrigin } from "@/lib/editor/export-paths";
import {
  parseExportState,
  stringifyExportState,
  type ProjectExportState,
} from "@/lib/editor/export-state";

export async function getProjectExportState(
  projectId: string
): Promise<ProjectExportState> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { exportJson: true, exportedVideoUrl: true },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return parseExportState(project.exportJson, project.exportedVideoUrl);
}

export async function startStaticVideoExport(input: {
  projectId: string;
  origin?: string | null;
}): Promise<ProjectExportState> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      videoKind: true,
      audioUrl: true,
      exportJson: true,
      exportedVideoUrl: true,
    },
  });
  if (!project) throw new Error("Projeto não encontrado");
  if (project.videoKind !== "static") {
    throw new Error("Export disponível apenas para vídeos static");
  }
  if (!project.audioUrl) throw new Error("Narração ausente");

  const current = parseExportState(project.exportJson, project.exportedVideoUrl);
  if (current.status === "queued" || current.status === "bundling" || current.status === "rendering") {
    return current;
  }

  const origin = resolveAppOrigin(input.origin);
  const next: ProjectExportState = {
    status: "queued",
    progress: 0,
    error: null,
    videoUrl: current.videoUrl,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    pid: null,
  };

  await prisma.project.update({
    where: { id: project.id },
    data: { exportJson: stringifyExportState(next) },
  });

  const script = path.join(process.cwd(), "scripts", "render-static-video.ts");
  const child = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "tsx", script, "--project", project.id, "--origin", origin],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    }
  );
  child.unref();

  if (typeof child.pid === "number") {
    next.pid = child.pid;
    await prisma.project.update({
      where: { id: project.id },
      data: { exportJson: stringifyExportState(next) },
    });
  }

  return next;
}
