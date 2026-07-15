import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudioshakeAlignmentTask,
  getAudioshakeApiKey,
  guessAudioshakeLanguage,
  readLocalUploadBuffer,
  uploadAudioshakeAsset,
} from "@/lib/providers/audioshake";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Inicia transcrição AudioShake (modelo alignment) a partir do áudio do projeto.
 * Se houver roteiro, usa como transcript de alinhamento.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        videoKind: true,
        audioUrl: true,
        script: true,
        channel: { select: { outputLanguage: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado" }, { status: 404 });
    }
    if (project.videoKind !== "static") {
      return NextResponse.json(
        { ok: false, error: "Transcrição disponível apenas para vídeos static" },
        { status: 400 }
      );
    }
    if (!project.audioUrl?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Envie o áudio da narração antes de transcrever" },
        { status: 400 }
      );
    }

    const apiKey = getAudioshakeApiKey();
    const { buffer, fileName } = await readLocalUploadBuffer(project.audioUrl);
    const assetId = await uploadAudioshakeAsset(apiKey, buffer, fileName);

    let transcriptAssetId: string | undefined;
    const script = project.script?.trim();
    if (script) {
      transcriptAssetId = await uploadAudioshakeAsset(
        apiKey,
        Buffer.from(script, "utf8"),
        `script-${project.id}.txt`,
        "text/plain"
      );
    }

    const language = guessAudioshakeLanguage(project.channel?.outputLanguage);
    const taskId = await createAudioshakeAlignmentTask({
      apiKey,
      assetId,
      language,
      transcriptAssetId,
    });

    return NextResponse.json({
      ok: true,
      data: { taskId, usedScript: Boolean(transcriptAssetId), language },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
