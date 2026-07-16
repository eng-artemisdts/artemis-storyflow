import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveAccessibleUploadUrl } from "@/lib/local-uploads";
import { NarrationStep } from "@/components/script/narration-step";

export const dynamic = "force-dynamic";

export default async function StaticNarrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      script: true,
      audioUrl: true,
      audioSource: true,
    },
  });
  if (!project) notFound();

  const resolvedAudioUrl = await resolveAccessibleUploadUrl(project.audioUrl);
  const audioMissingOnDisk =
    Boolean(project.audioUrl?.trim()) && !resolvedAudioUrl;

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Narração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Copie o roteiro para o MiniMax Speech, gere o MP3 e envie aqui — ou faça upload direto.
        </p>
      </div>
      <NarrationStep
        projectId={project.id}
        script={project.script ?? ""}
        initialAudioUrl={resolvedAudioUrl}
        initialAudioMissing={audioMissingOnDisk}
        initialAudioSource={project.audioSource}
        hasScript={Boolean(project.script?.trim())}
      />
    </div>
  );
}
