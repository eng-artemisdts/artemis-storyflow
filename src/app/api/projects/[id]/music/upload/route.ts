import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import {
  parseEditorPersisted,
  stringifyEditorPersisted,
} from "@/lib/editor/editor-settings";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB

function isAudioFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime === "audio/mpeg" ||
    mime === "audio/mp3" ||
    mime === "audio/x-mpeg" ||
    mime === "audio/wav" ||
    mime === "audio/x-wav" ||
    mime === "audio/mp4" ||
    mime === "audio/aac" ||
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".m4a")
  );
}

function extForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".wav")) return ".wav";
  if (name.endsWith(".m4a")) return ".m4a";
  return ".mp3";
}

/**
 * Upload de música de fundo para o mini-editor static.
 * Persiste a URL em Project.editorJson.settings.musicUrl.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true, editorJson: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado" }, { status: 404 });
    }
    if (project.videoKind !== "static") {
      return NextResponse.json(
        { ok: false, error: "Música de fundo disponível apenas para vídeos static" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecione um arquivo de áudio" },
        { status: 400 }
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Arquivo muito grande (máx. 50 MB)" },
        { status: 413 }
      );
    }
    if (!isAudioFile(file)) {
      return NextResponse.json(
        { ok: false, error: "Envie MP3, WAV ou M4A" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const musicUrl = await storage.saveBuffer(
      buffer,
      `music-${project.id}`,
      extForFile(file)
    );

    const current = parseEditorPersisted(project.editorJson);
    const settings = { ...current.settings, musicUrl };

    await prisma.project.update({
      where: { id: project.id },
      data: { editorJson: stringifyEditorPersisted(settings) },
    });

    revalidatePath(`/projects/${project.id}`, "layout");
    revalidatePath(`/projects/${project.id}/static/edit`);
    return NextResponse.json({ ok: true, data: { musicUrl, settings } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
