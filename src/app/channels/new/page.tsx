import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelForm } from "@/components/channel/channel-form";

export default function NewChannelPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10 sm:py-14">
      <Button variant="ghost" size="sm" className="mb-6 w-fit -ml-2" asChild>
        <Link href="/">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </Button>

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Radio className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Novo canal</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Três passos: identidade, formato dos vídeos e revisão. O tamanho do roteiro sai da
          duração média.
        </p>
      </div>

      <ChannelForm mode="create" />
    </main>
  );
}
