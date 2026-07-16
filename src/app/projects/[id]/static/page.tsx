import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fillMasterPrompt } from "@/lib/narrative/fill-master-prompt";
import { toNarrativeConfig } from "@/lib/narrative/channel-config";
import type { ChannelTypeId } from "@/lib/narrative/channel-types";
import { NarrativeScriptEditor } from "@/components/script/narrative-script-editor";

export const dynamic = "force-dynamic";

export default async function StaticProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { channel: true },
  });
  if (!project) notFound();

  const videoTopic = project.videoTopic?.trim() ?? "";
  const durationMin = project.targetDurationMin ?? project.channel?.targetDurationMin;

  // Sempre gera o master prompt a partir do template + config atual do canal.
  let masterPrompt = "";
  if (videoTopic && project.channel) {
    masterPrompt = fillMasterPrompt(
      toNarrativeConfig(project.channel, durationMin),
      videoTopic,
      {
        channelType: project.channel.channelType as ChannelTypeId,
        masterPromptTemplate: project.channel.masterPromptTemplate,
      }
    );
    if (masterPrompt !== (project.narrativePrompt?.trim() ?? "")) {
      await prisma.project.update({
        where: { id: project.id },
        data: { narrativePrompt: masterPrompt },
      });
    }
  } else {
    masterPrompt = project.narrativePrompt?.trim() ?? "";
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Roteiro narrativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O master prompt já vem preenchido com o tópico do cadastro. Copie e use fora do app, ou
          importe um roteiro .md abaixo.
        </p>
      </div>
      <NarrativeScriptEditor
        projectId={project.id}
        initialScript={project.script ?? ""}
        videoTopic={videoTopic}
        masterPrompt={masterPrompt}
        wordTarget={project.channel?.wordTarget ?? null}
      />
    </div>
  );
}
