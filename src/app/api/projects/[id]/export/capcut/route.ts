import { createReadStream, existsSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCapcutExport,
  cleanupExpiredCapcutExports,
  resolveCapcutExportToken,
} from "@/lib/editor/capcut-export";

export const runtime = "nodejs";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — gera o draft CapCut (nativo) e devolve token de download.
 * GET  — transmite o ZIP pelo token (?token=...).
 */
export async function POST(_request: Request, context: Ctx) {
  const { id: projectId } = await context.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true },
    });
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Projeto não encontrado" },
        { status: 404 }
      );
    }
    if (project.videoKind !== "static") {
      return NextResponse.json(
        {
          ok: false,
          error: "Export CapCut disponível apenas para vídeos static",
        },
        { status: 400 }
      );
    }

    await cleanupExpiredCapcutExports();
    const result = await buildCapcutExport(projectId);

    return NextResponse.json({
      ok: true,
      data: {
        token: result.token,
        fileName: result.fileName,
        draftName: result.draftName,
        downloadUrl: `/api/projects/${projectId}/export/capcut?token=${result.token}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      /disco cheio|ENOSPC|no space/i.test(message) ? 507 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function GET(request: Request, context: Ctx) {
  const { id: projectId } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Use POST para gerar o draft e depois GET com ?token= para baixar.",
      },
      { status: 400 }
    );
  }

  try {
    const meta = await resolveCapcutExportToken(token);
    if (!meta || meta.projectId !== projectId) {
      return NextResponse.json(
        { ok: false, error: "Download expirado ou inválido. Gere novamente." },
        { status: 404 }
      );
    }
    if (!existsSync(meta.zipPath)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo ZIP não encontrado. Gere novamente." },
        { status: 404 }
      );
    }

    const size = statSync(meta.zipPath).size;
    const stream = createReadStream(meta.zipPath, { highWaterMark: 1 << 20 });
    const metaPath = meta.zipPath.replace(/\.zip$/, ".json");

    // Limpa depois do download (TTL de 2h cobre falhas).
    const cleanup = () => {
      void rm(meta.zipPath, { force: true }).catch(() => {});
      void rm(metaPath, { force: true }).catch(() => {});
    };
    stream.once("end", cleanup);
    stream.once("error", cleanup);

    return new NextResponse(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${meta.fileName}"`,
        "Content-Length": String(size),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
