import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StylePicker } from "@/components/style/style-picker";
import { parseStylePromptOverrides } from "@/lib/resolve-style-preset";

export const dynamic = "force-dynamic";

export default async function StylePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, customStyles] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: { id: true, styleId: true, stylePromptOverrides: true },
    }),
    prisma.customStyle.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, prompt: true, previewImageUrl: true },
    }),
  ]);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Estilo visual</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Escolha a estética do projeto. O estilo é aplicado automaticamente a todos os
          prompts de imagem e vídeo, adaptado ao dialeto de prompting do modelo escolhido
          (Nano Banana, FLUX, GPT Image, Veo, Kling...), com reforço de consistência entre
          as cenas. Você pode editar o prompt de cada preset neste projeto.
        </p>
      </div>
      <StylePicker
        projectId={project.id}
        currentStyleId={project.styleId}
        initialCustomStyles={customStyles}
        initialPromptOverrides={parseStylePromptOverrides(project.stylePromptOverrides)}
      />
    </div>
  );
}
