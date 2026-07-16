import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseAiContextFromRequest } from "@/lib/ai-request-context";
import { resolveAiProviders } from "@/lib/channel-ai";
import { resolveProviderApiKey, runWithAiContext } from "@/lib/credentials";
import {
  createAudioshakeAlignmentTask,
  getAudioshakeApiKey,
  guessAudioshakeLanguage,
  readLocalUploadBuffer,
  uploadAudioshakeAsset,
} from "@/lib/providers/audioshake";
import { transcribeWithOpenAI } from "@/lib/providers/openai-transcription";
import type { ProjectTranscription } from "@/lib/transcription";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Inicia transcrição com o provedor configurado (AudioShake ou OpenAI).
 *
 * Importante: NÃO enviamos o roteiro para forced-alignment.
 * Quando o texto do roteiro é maior/diferente do áudio, o AudioShake comprime
 * os timestamps (~3× mais rápido). OpenAI com prompt longo alucina no início.
 * Ambos passam a transcrever o áudio real.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  const ai = parseAiContextFromRequest(request);

  try {
    return await runWithAiContext(ai, async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          videoKind: true,
          audioUrl: true,
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

      const providers = resolveAiProviders();
      const language = guessAudioshakeLanguage(project.channel?.outputLanguage);
      const { buffer, fileName } = await readLocalUploadBuffer(project.audioUrl);

      if (providers.transcriptionProvider === "openai") {
        const apiKey = resolveProviderApiKey("openai", ai?.apiKeys);
        const result = await transcribeWithOpenAI({
          apiKey,
          model: providers.transcriptionModel || "whisper-1",
          buffer,
          fileName,
          language,
        });

        const transcription: ProjectTranscription = {
          ...result,
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
          data: {
            taskId: transcription.taskId,
            usedScript: false,
            language,
            provider: "openai" as const,
            status: "completed" as const,
            transcription,
          },
        });
      }

      // AudioShake — alignment SEM roteiro (transcreve o áudio com timestamps reais)
      const apiKey = getAudioshakeApiKey();
      const assetId = await uploadAudioshakeAsset(apiKey, buffer, fileName);
      const taskId = await createAudioshakeAlignmentTask({
        apiKey,
        assetId,
        language,
      });

      return NextResponse.json({
        ok: true,
        data: {
          taskId,
          usedScript: false,
          language,
          provider: "audioshake" as const,
          status: "processing" as const,
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
