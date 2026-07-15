import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ScriptEditor } from "@/components/script/script-editor";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, script: true },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Roteiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole ou escreva o roteiro do vídeo. Na próxima etapa a IA extrai personagens, cenários
          e cenas.
        </p>
      </div>
      <ScriptEditor projectId={project.id} initialScript={project.script ?? ""} />
    </div>
  );
}
