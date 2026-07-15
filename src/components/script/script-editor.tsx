"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { saveScript } from "@/actions/script.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/** Editor de roteiro para projetos motion — apenas colar/editar manualmente. */
export function ScriptEditor({
  projectId,
  initialScript,
}: {
  projectId: string;
  initialScript: string;
}) {
  const router = useRouter();
  const [script, setScript] = useState(initialScript);
  const [savedScript, setSavedScript] = useState(initialScript);
  const [isPending, startTransition] = useTransition();

  const wordCount = useMemo(
    () => (script.trim() ? script.trim().split(/\s+/).length : 0),
    [script]
  );
  const isDirty = script !== savedScript;

  function handleSave(goNext: boolean) {
    startTransition(async () => {
      const result = await saveScript({ projectId, script });
      if (result.ok) {
        setSavedScript(script);
        toast.success("Roteiro salvo");
        if (goNext) router.push(`/projects/${projectId}/assets`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder={
          "CENA 1 — EXT. PRAIA — ENTARDECER\n\nMARINA (30 anos, cabelos ruivos) caminha pela areia…\n\nMARINA\n— Sempre soube que este lugar guardava um segredo."
        }
        className="min-h-[420px] flex-1 resize-none font-mono text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{wordCount} palavras</Badge>
          {isDirty && <span className="text-amber-500">Alterações não salvas</span>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isPending || !isDirty}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isPending || !script.trim()}>
            Salvar e analisar <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
