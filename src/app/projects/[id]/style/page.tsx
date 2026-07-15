import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StylePicker } from "@/components/style/style-picker";

export const dynamic = "force-dynamic";

export default async function StylePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, styleId: true },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Estilo visual</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Escolha a estética do projeto. O estilo é aplicado automaticamente a todos os
          prompts de imagem e vídeo, adaptado ao dialeto de prompting do modelo escolhido
          (Nano Banana, FLUX, GPT Image, Veo, Kling...), com reforço de consistência entre
          as cenas.
        </p>
      </div>
      <StylePicker projectId={project.id} currentStyleId={project.styleId} />
    </div>
  );
}
