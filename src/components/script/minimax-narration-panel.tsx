"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Mic2 } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeScriptMarkdown,
  buildMinimaxNarrationText,
} from "@/lib/narrative/parse-script-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MinimaxNarrationPanel({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);

  const narrationText = useMemo(() => buildMinimaxNarrationText(script), [script]);
  const analysis = useMemo(
    () => (script.trim() ? analyzeScriptMarkdown(script) : null),
    [script]
  );

  async function handleCopy() {
    if (!narrationText.trim()) return;
    try {
      await navigator.clipboard.writeText(narrationText);
      setCopied(true);
      toast.success("Texto copiado — cole no MiniMax Speech");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  if (!script.trim()) {
    return (
      <section className="rounded-xl border border-dashed bg-card/30 p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Importe ou salve um roteiro na etapa anterior para copiar a narração no MiniMax.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Mic2 className="size-4 shrink-0 text-primary" />
            <h2 className="text-sm font-medium">MiniMax Speech</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Texto falável extraído do roteiro — cole no{" "}
            <span className="text-foreground">MiniMax Speech 2.8</span> para gerar o áudio.
            Pausas <span className="font-mono">&lt;#0.8#&gt;</span> entre cenas quando aplicável.
          </p>
          {analysis ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{analysis.wordCount} palavras</Badge>
              {analysis.sceneCount > 0 ? (
                <Badge variant="outline">
                  {analysis.sceneCount} cena{analysis.sceneCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void handleCopy()}
          disabled={!narrationText.trim()}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar para MiniMax"}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-3 text-sm leading-relaxed text-foreground">
        {narrationText}
      </pre>
    </section>
  );
}
