import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseProjectTranscription } from "@/lib/transcription";
import { TranscriptionStep } from "@/components/script/transcription-step";

export const dynamic = "force-dynamic";

export default async function StaticTranscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      audioUrl: true,
      transcriptionJson: true,
    },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto flex h-full w-full min-w-0 max-w-4xl flex-col overflow-x-hidden px-6 py-8">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Transcrição</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere o texto alinhado ao áudio com timestamps (AudioShake) para legendas e edição.
        </p>
      </div>
      <TranscriptionStep
        projectId={project.id}
        projectName={project.name}
        audioUrl={project.audioUrl}
        initialTranscription={parseProjectTranscription(project.transcriptionJson)}
      />
    </div>
  );
}
