import Link from "next/link";
import { ArrowLeft, KeyRound, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProviderSettingsForm } from "@/components/settings/provider-settings-form";
import { CredentialsForm } from "@/components/settings/credentials-form";

export default function AppSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <Button variant="ghost" size="sm" className="mb-6 -ml-2 w-fit" asChild>
        <Link href="/">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </Button>

      <header className="mb-10">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings2 className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Provedores e chaves de IA ficam neste navegador (localStorage). Usados em todos os
          canais e projetos.
        </p>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-lg font-medium">Provedores e modelos</h2>
        </div>
        <ProviderSettingsForm />
      </section>

      <Separator className="my-10" />

      <section>
        <div className="mb-1 flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="text-lg font-medium">Chaves de API</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          BYOK local. As chaves não vão para o banco — só para este navegador. Em produção no
          servidor, o .env ainda funciona como fallback.
        </p>
        <CredentialsForm />
      </section>
    </main>
  );
}
