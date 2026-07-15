import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Clapperboard className="size-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        O projeto ou página que você procura não existe ou foi removido.
      </p>
      <Button asChild>
        <Link href="/">Voltar para projetos</Link>
      </Button>
    </main>
  );
}
