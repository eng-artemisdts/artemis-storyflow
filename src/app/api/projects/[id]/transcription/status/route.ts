import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseAiContextFromRequest } from "@/lib/ai-request-context";
import { runWithAiContext } from "@/lib/credentials";
import {
  downloadAndNormalizeTranscript,
  getAudioshakeApiKey,
} from "@/lib/providers/audioshake";
import { parseProjectTranscription } from "@/lib/transcription";

export const runtime = "nodejs";

/**
 * Consulta status da task. AudioShake: polling externo.
 * OpenAI / AssemblyAI: transcrição já persistida no POST — lê do banco se taskId
 * começa com openai: ou assemblyai:.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  const taskId = new URL(request.url).searchParams.get("taskId")?.trim();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId é obrigatório" }, { status: 400 });
  }

  const ai = parseAiContextFromRequest(request);

  try {
    return await runWithAiContext(ai, async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, videoKind: true, transcriptionJson: true },
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

      // OpenAI / AssemblyAI: resultado já salvo no POST
      if (taskId.startsWith("openai:") || taskId.startsWith("assemblyai:")) {
        const transcription = parseProjectTranscription(project.transcriptionJson);
        if (transcription?.taskId === taskId) {
          return NextResponse.json({
            ok: true,
            data: { status: "completed" as const, transcription },
          });
        }
        const label = taskId.startsWith("assemblyai:") ? "AssemblyAI" : "OpenAI";
        return NextResponse.json(
          { ok: false, error: `Transcrição ${label} não encontrada no projeto` },
          { status: 404 }
        );
      }

      const apiKey = getAudioshakeApiKey();
      const result = await downloadAndNormalizeTranscript(apiKey, taskId);

      if (result.status === "processing") {
        return NextResponse.json({ ok: true, data: { status: "processing" as const } });
      }
      if (result.status === "error" || !result.transcription) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "Falha na transcrição" },
          { status: 500 }
        );
      }

      const transcription = {
        ...result.transcription,
        createdAt: new Date().toISOString(),
      };

      await prisma.project.update({
        where: { id: project.id },
        data: {
          transcriptionJson: JSON.stringify(transcription),
          brollsJson: null,
        },
      });
      revalidatePath(`/projects/${project.id}`, "layout");

      return NextResponse.json({
        ok: true,
        data: { status: "completed" as const, transcription },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
