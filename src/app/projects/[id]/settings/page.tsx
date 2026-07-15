import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectAspectSettings } from "@/components/project/project-aspect-settings";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      videoAspectRatio: true,
    },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações do projeto</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Aqui você ajusta o formato deste vídeo. Provedores e chaves de IA ficam nas{" "}
        <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
          configurações gerais
        </Link>
        .
      </p>

      <section className="mt-8">
        <ProjectAspectSettings
          projectId={project.id}
          currentAspectRatio={project.videoAspectRatio}
        />
      </section>

      <section className="mt-8 rounded-lg border bg-card/40 p-4">
        <p className="text-sm font-medium">IA da aplicação</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Modelos e chaves de API são salvos neste navegador e valem para todos os canais e
          projetos.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/settings">Abrir configurações de IA</Link>
        </Button>
      </section>
    </div>
  );
}
