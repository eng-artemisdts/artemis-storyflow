import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseAiContextFromRequest } from "@/lib/ai-request-context";
import { resolveAiProviders } from "@/lib/channel-ai";
import { resolveApiKey, runWithAiContext } from "@/lib/credentials";
import {
  enrichBrolls,
  enrichPartialBrollsForDisplay,
  formatBrollsGenerationPromptMd,
  startBrollsGenerationStream,
} from "@/lib/brolls/generate-brolls";
import { resolveProjectStylePreset } from "@/lib/resolve-style-preset";
import { parseProjectTranscription } from "@/lib/transcription";
import type { ProjectBrolls } from "@/lib/schemas/brolls";
import {
  BROLLS_LLM_TIMEOUT_MS,
  BROLLS_STREAM_HEARTBEAT_MS,
  createLlmAbortSignal,
  formatTimeoutError,
} from "@/lib/request-timeout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 360;

function revalidateScenes(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/projects/${projectId}/static/scenes`);
}

type StreamEvent =
  | { type: "started" }
  | { type: "ping" }
  | { type: "partial"; brolls: ProjectBrolls["brolls"]; count: number }
  | { type: "done"; brolls: ProjectBrolls }
  | { type: "error"; error: string };

function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Gera b-rolls via LLM com streaming NDJSON para exibir cenas conforme
 * a OpenAI (ou outro provedor) vai produzindo o JSON estruturado.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;
  const ai = parseAiContextFromRequest(request);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encodeEvent(event));
      };

      send({ type: "started" });

      try {
        await runWithAiContext(ai, async () => {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { channel: true },
          });
          if (!project) {
            send({ type: "error", error: "Projeto não encontrado" });
            return;
          }
          if (project.videoKind !== "static") {
            send({
              type: "error",
              error: "Geração de b-rolls disponível apenas para vídeos static",
            });
            return;
          }

          const transcription = parseProjectTranscription(project.transcriptionJson);
          if (!transcription) {
            send({
              type: "error",
              error: "Gere a transcrição antes de criar as cenas (b-rolls).",
            });
            return;
          }

          const providers = resolveAiProviders(project);
          if (!providers.llmProvider || !providers.llmModel) {
            send({
              type: "error",
              error: "Configure o provedor de LLM em Configurações.",
            });
            return;
          }

          const apiKey = await resolveApiKey(projectId, providers.llmProvider);
          const stylePreset = await resolveProjectStylePreset(project);
          const { result, system, user, audioEnd } = startBrollsGenerationStream({
            providerId: providers.llmProvider,
            apiKey,
            model: providers.llmModel,
            transcription,
            stylePreset,
            aspectRatio: project.videoAspectRatio || "16:9",
            channelNiche: project.channel?.niche ?? null,
            channelDescription: project.channel?.description ?? null,
            abortSignal: createLlmAbortSignal(BROLLS_LLM_TIMEOUT_MS),
          });

          const heartbeat = setInterval(() => {
            send({ type: "ping" });
          }, BROLLS_STREAM_HEARTBEAT_MS);

          try {
            for await (const partial of result.partialObjectStream) {
              const brolls = enrichPartialBrollsForDisplay(
                partial.brolls,
                audioEnd
              );
              if (brolls.length === 0) continue;
              send({ type: "partial", brolls, count: brolls.length });
            }

            const object = await result.object;
            const enriched = enrichBrolls(object.brolls, audioEnd);
            const generationPromptMd = formatBrollsGenerationPromptMd({
              projectName: project.name,
              system,
              user,
            });

            const brolls: ProjectBrolls = {
              brolls: enriched,
              styleId: project.styleId,
              styleLabel: stylePreset?.label ?? null,
              createdAt: new Date().toISOString(),
              generationPromptMd,
            };

            await prisma.project.update({
              where: { id: project.id },
              data: { brollsJson: JSON.stringify(brolls) },
            });

            revalidateScenes(project.id);
            send({ type: "done", brolls });
          } finally {
            clearInterval(heartbeat);
          }
        });
      } catch (err) {
        const message = formatTimeoutError(err, "Geração de cenas");
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
