import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getProjectExportState,
  startStaticVideoExport,
} from "@/lib/editor/start-export";
import { resolveAppOrigin } from "@/lib/editor/export-paths";

export const runtime = "nodejs";
export const maxDuration = 60;

function requestOrigin(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const scheme = proto ?? (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${scheme}://${host}`.replace(/\/$/, "");
  }
  return resolveAppOrigin();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado" }, { status: 404 });
    }
    const state = await getProjectExportState(projectId);
    return NextResponse.json({ ok: true, data: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado" }, { status: 404 });
    }
    if (project.videoKind !== "static") {
      return NextResponse.json(
        { ok: false, error: "Export disponível apenas para vídeos static" },
        { status: 400 }
      );
    }

    const state = await startStaticVideoExport({
      projectId,
      origin: requestOrigin(request),
    });
    return NextResponse.json({ ok: true, data: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
