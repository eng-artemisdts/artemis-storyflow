import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB

function isMp3(file: File): boolean {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime === "audio/mpeg" ||
    mime === "audio/mp3" ||
    mime === "audio/x-mpeg" ||
    name.endsWith(".mp3")
  );
}

/** Upload de MP3 via Route Handler (evita o limite de 1 MB das Server Actions). */
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
        { ok: false, error: "Upload de narração disponível apenas para vídeos static" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Selecione um arquivo MP3" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Arquivo muito grande (máx. 50 MB)" },
        { status: 413 }
      );
    }
    if (!isMp3(file)) {
      return NextResponse.json(
        { ok: false, error: "Envie um arquivo MP3 (.mp3)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const audioUrl = await storage.saveBuffer(buffer, `narration-${project.id}`, ".mp3");

    await prisma.project.update({
      where: { id: project.id },
      data: { audioUrl, audioSource: "upload" },
    });

    revalidatePath(`/projects/${project.id}`, "layout");
    return NextResponse.json({ ok: true, data: { audioUrl } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
