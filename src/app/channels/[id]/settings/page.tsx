import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ChannelForm } from "@/components/channel/channel-form";
import type { VideoAspectRatio } from "@/lib/video-aspect";

export const dynamic = "force-dynamic";

export default async function ChannelSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href={`/channels/${channel.id}`}>
          <ArrowLeft className="size-4" /> Voltar ao canal
        </Link>
      </Button>
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Clapperboard className="size-6" />
          <h1 className="text-2xl font-semibold tracking-tight">Editar canal</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Identidade editorial e formato dos vídeos. Provedores de IA ficam em{" "}
          <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
            Configurações
          </Link>
          .
        </p>
      </div>

      <ChannelForm
        mode="edit"
        channelId={channel.id}
        initial={{
          name: channel.name,
          niche: channel.niche,
          description: channel.description,
          videoAspectRatio: channel.videoAspectRatio as VideoAspectRatio,
          targetDurationMin: channel.targetDurationMin,
          outputLanguage: channel.outputLanguage,
          addressForm: channel.addressForm,
          forbiddenForms: channel.forbiddenForms,
          suspensePhrase: channel.suspensePhrase,
          concreteUnits: channel.concreteUnits,
          brandSignoff: channel.brandSignoff,
        }}
      />
    </main>
  );
}
