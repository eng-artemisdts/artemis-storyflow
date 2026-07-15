import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StylePicker } from "@/components/style/style-picker";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function StaticStylePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, styleId: true },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estilo visual</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Escolha a estética das imagens do vídeo static. O estilo será aplicado aos
            prompts de geração.
          </p>
        </div>
        <Button asChild variant={project.styleId ? "default" : "outline"}>
          <Link href={`/projects/${project.id}/static/narration`}>
            Ir para narração <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <StylePicker projectId={project.id} currentStyleId={project.styleId} />
    </div>
  );
}
