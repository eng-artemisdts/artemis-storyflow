import { existsSync } from "node:fs";
import { chmod, copyFile, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Remotion ≥4.0.4xx passa a empacotar ffmpeg/ffprobe com minos=15.0.
 * Em macOS 13/14 (Darwin < 24) o dyld aborta com:
 *   Symbol not found: _AVCaptureDeviceTypeContinuityCamera
 *
 * Workaround: trocar os binários do compositor por wrappers que chamam
 * o ffmpeg/ffprobe do sistema (Homebrew). O binário `remotion` do compositor
 * continua ok (minos 11).
 */

const MARKER = ".storyflow-ffmpeg-patched";

function darwinMajor(): number | null {
  if (process.platform !== "darwin") return null;
  const major = Number(os.release().split(".")[0]);
  return Number.isFinite(major) ? major : null;
}

/** Darwin 24 = macOS 15 Sequoia (mínimo oficial do compositor atual). */
export function remotionNeedsSystemFfmpeg(): boolean {
  const major = darwinMajor();
  return major != null && major < 24;
}

function resolveSystemBinary(name: "ffmpeg" | "ffprobe"): string | null {
  const candidates = [
    process.env[name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"],
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveCompositorDir(): string | null {
  const pkgName =
    process.arch === "arm64"
      ? "@remotion/compositor-darwin-arm64"
      : "@remotion/compositor-darwin-x64";

  const tryResolve = (from?: string) => {
    try {
      const req = from ? createRequire(from) : require;
      return path.dirname(req.resolve(`${pkgName}/package.json`));
    } catch {
      return null;
    }
  };

  // 1) Resolução direta
  const direct = tryResolve();
  if (direct) return direct;

  // 2) Via @remotion/renderer (onde o compositor costuma ser dependência)
  try {
    const rendererPkg = require.resolve("@remotion/renderer/package.json");
    const viaRenderer = tryResolve(rendererPkg);
    if (viaRenderer) return viaRenderer;
  } catch {
    /* ignore */
  }

  // 3) Fallback pnpm: procura no store local
  try {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");
    if (!existsSync(pnpmDir)) return null;
    const prefix =
      process.arch === "arm64"
        ? "@remotion+compositor-darwin-arm64@"
        : "@remotion+compositor-darwin-x64@";
    const match = readdirSync(pnpmDir).find((name) => name.startsWith(prefix));
    if (!match) return null;
    const candidate = path.join(
      pnpmDir,
      match,
      "node_modules",
      "@remotion",
      pkgName.replace("@remotion/", "")
    );
    return existsSync(path.join(candidate, "package.json")) ? candidate : null;
  } catch {
    return null;
  }
}

async function installWrapper(
  compositorDir: string,
  name: "ffmpeg" | "ffprobe",
  systemPath: string
): Promise<void> {
  const target = path.join(compositorDir, name);
  const backup = path.join(compositorDir, `${name}.remotion-original`);
  const marker = path.join(compositorDir, `${MARKER}-${name}`);

  if (existsSync(marker)) {
    const previous = (await readFile(marker, "utf8")).trim();
    if (previous === systemPath && existsSync(target)) return;
  }

  // Preserva o binário original uma vez (para desfazer / inspecionar).
  if (existsSync(target) && !existsSync(backup)) {
    // Só faz backup se ainda for o binário Mach-O do Remotion (não um wrapper).
    const head = await readFile(target);
    const isWrapper =
      head.subarray(0, 80).toString("utf8").includes("storyflow-remotion-ffmpeg-wrapper");
    if (!isWrapper) {
      await copyFile(target, backup);
    }
  }

  const script = `#!/bin/sh
# storyflow-remotion-ffmpeg-wrapper
# Remotion compositor ffmpeg/ffprobe → binário do sistema (macOS < 15).
exec "${systemPath}" "$@"
`;
  // Escreve via temp + rename para não corromper se o processo cair no meio.
  const tmp = `${target}.tmp-${process.pid}`;
  await writeFile(tmp, script, "utf8");
  await chmod(tmp, 0o755);
  await rename(tmp, target);
  await writeFile(marker, `${systemPath}\n`, "utf8");
}

/**
 * Garante que Remotion use ffmpeg/ffprobe do sistema quando o compositor
 * bundled for incompatível com o macOS atual.
 * No-op em Linux/Windows ou macOS ≥ 15.
 */
export async function ensureRemotionFfmpegCompatible(): Promise<{
  patched: boolean;
  reason?: string;
}> {
  if (!remotionNeedsSystemFfmpeg()) {
    return { patched: false, reason: "macos-ok" };
  }

  const compositorDir = resolveCompositorDir();
  if (!compositorDir) {
    throw new Error(
      "Pacote @remotion/compositor-darwin-* não encontrado. Rode pnpm install."
    );
  }

  const ffmpeg = resolveSystemBinary("ffmpeg");
  const ffprobe = resolveSystemBinary("ffprobe");
  if (!ffmpeg || !ffprobe) {
    throw new Error(
      [
        "Seu macOS é anterior ao 15 (Sequoia) e o FFmpeg embutido do Remotion não roda aqui.",
        "Instale o FFmpeg do sistema e tente de novo:",
        "  brew install ffmpeg",
        "Ou atualize para macOS 15+.",
      ].join("\n")
    );
  }

  await installWrapper(compositorDir, "ffmpeg", ffmpeg);
  await installWrapper(compositorDir, "ffprobe", ffprobe);

  return { patched: true, reason: `using ${ffmpeg}` };
}

export function formatRemotionMacosHint(errMessage: string): string {
  if (
    !errMessage.includes("AVCaptureDeviceTypeContinuityCamera") &&
    !errMessage.includes("built for macOS 15")
  ) {
    return errMessage;
  }
  return [
    errMessage,
    "",
    "Causa: o FFmpeg do Remotion exige macOS 15+, mas este Mac está em versão anterior.",
    "Correção automática: brew install ffmpeg (o export usa o FFmpeg do Homebrew).",
    "Alternativa: atualizar o macOS para 15 Sequoia ou superior.",
  ].join("\n");
}
