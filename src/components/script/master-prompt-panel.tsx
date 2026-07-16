"use client";

import { useState } from "react";
import { Check, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Exibe o master prompt preenchido (tópico do projeto) com botão de copiar. */
export function MasterPromptPanel({
  masterPrompt,
  videoTopic,
}: {
  masterPrompt: string;
  videoTopic: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!masterPrompt) return;
    try {
      await navigator.clipboard.writeText(masterPrompt);
      setCopied(true);
      toast.success("Master prompt copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o prompt");
    }
  }

  if (!masterPrompt.trim()) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-primary" />
            <h2 className="text-sm font-medium">Master prompt</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Gerado a partir da config do canal + tópico do cadastro
            {videoTopic ? (
              <>
                : <span className="text-foreground">{videoTopic}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {masterPrompt}
      </pre>
    </section>
  );
}
