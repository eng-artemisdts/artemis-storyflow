/**
 * Render Remotion fora do processo Next.js (webpack do bundler não pode
 * ser embutido numa API route).
 *
 * Uso:
 *   pnpm exec tsx scripts/render-static-video.ts --project <id> [--origin http://127.0.0.1:3000]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { prisma } from "../src/lib/prisma";
import { buildStaticExportProps } from "../src/lib/editor/build-export-props";
import {
  ensureRemotionFfmpegCompatible,
  formatRemotionMacosHint,
} from "../src/lib/editor/patch-remotion-ffmpeg";
import {
  exportWorkDir,
  remotionBundleCacheDir,
  remotionEntryPoint,
  resolveAppOrigin,
  STATIC_COMPOSITION_ID,
} from "../src/lib/editor/export-paths";
import {
  parseExportState,
  stringifyExportState,
  type ProjectExportState,
} from "../src/lib/editor/export-state";

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

async function setExportState(
  projectId: string,
  patch: Partial<ProjectExportState>,
  exportedVideoUrl?: string | null
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { exportJson: true, exportedVideoUrl: true },
  });
  const current = parseExportState(
    project?.exportJson,
    exportedVideoUrl === undefined ? project?.exportedVideoUrl : exportedVideoUrl
  );
  const next: ProjectExportState = { ...current, ...patch };
  await prisma.project.update({
    where: { id: projectId },
    data: {
      exportJson: stringifyExportState(next),
      ...(exportedVideoUrl !== undefined
        ? { exportedVideoUrl }
        : next.videoUrl
          ? { exportedVideoUrl: next.videoUrl }
          : {}),
    },
  });
}

async function main() {
  const projectId = argValue("--project");
  if (!projectId) {
    console.error("Uso: tsx scripts/render-static-video.ts --project <id>");
    process.exit(1);
  }

  const origin = resolveAppOrigin(argValue("--origin"));
  const workDir = exportWorkDir(projectId);
  await mkdir(workDir, { recursive: true });

  await setExportState(projectId, {
    status: "bundling",
    progress: 2,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    pid: process.pid,
  });

  try {
    const ffmpegPatch = await ensureRemotionFfmpegCompatible();
    if (ffmpegPatch.patched) {
      console.log(
        `[export ${projectId}] Remotion FFmpeg patched for older macOS (${ffmpegPatch.reason})`
      );
    }

    const { props } = await buildStaticExportProps(projectId, origin);

    await writeFile(
      path.join(workDir, "props.json"),
      JSON.stringify(props, null, 2),
      "utf8"
    );

    console.log(`[export ${projectId}] bundling Remotion…`);
    const serveUrl = await bundle({
      entryPoint: remotionEntryPoint(),
      outDir: remotionBundleCacheDir(),
      webpackOverride: (config) => {
        config.resolve = config.resolve ?? {};
        config.resolve.alias = {
          ...(config.resolve.alias ?? {}),
          "@": path.join(process.cwd(), "src"),
        };
        return config;
      },
    });

    await setExportState(projectId, { status: "rendering", progress: 5 });

    const composition = await selectComposition({
      serveUrl,
      id: STATIC_COMPOSITION_ID,
      inputProps: props,
    });

    const fileName = `export-${projectId}-${Date.now()}.mp4`;
    const outputAbsolute = path.join(
      process.cwd(),
      "public",
      "uploads",
      fileName
    );
    await mkdir(path.dirname(outputAbsolute), { recursive: true });

    console.log(
      `[export ${projectId}] rendering ${composition.durationInFrames} frames @ ${composition.width}x${composition.height}`
    );

    let lastLogged = -1;
    let lastWritten = -1;
    let writeChain: Promise<void> = Promise.resolve();
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputAbsolute,
      inputProps: props,
      onProgress: ({ progress }) => {
        const pct = Math.min(99, Math.max(5, Math.round(progress * 100)));
        if (pct !== lastWritten && (pct === 5 || pct >= lastWritten + 2 || pct >= 99)) {
          lastWritten = pct;
          writeChain = writeChain.then(() =>
            setExportState(projectId, {
              status: "rendering",
              progress: pct,
            })
          );
        }
        if (pct >= lastLogged + 10) {
          lastLogged = pct;
          console.log(`[export ${projectId}] ${pct}%`);
        }
      },
    });
    await writeChain;

    const videoUrl = `/uploads/${fileName}`;
    await setExportState(
      projectId,
      {
        status: "done",
        progress: 100,
        error: null,
        videoUrl,
        finishedAt: new Date().toISOString(),
        pid: null,
      },
      videoUrl
    );
    console.log(`[export ${projectId}] done → ${videoUrl}`);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const message = formatRemotionMacosHint(raw);
    console.error(`[export ${projectId}] failed:`, message);
    await setExportState(projectId, {
      status: "error",
      error: message,
      finishedAt: new Date().toISOString(),
      pid: null,
    });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main();
