"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { saveScript, generateNarrativeScript } from "@/actions/script.actions";
import { getAiClientContext } from "@/lib/ai-settings-storage";
import { MasterPromptPanel } from "@/components/script/master-prompt-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/**
 * Editor narrativo para projetos static — master prompt do tópico + gerar roteiro.
 */
export function NarrativeScriptEditor({
  projectId,
  initialScript,
  videoTopic,
  masterPrompt,
  channelName,
  channelConfigSummary,
  wordTarget,
}: {
  projectId: string;
  initialScript: string;
  videoTopic: string;
  masterPrompt: string;
  channelName: string | null;
  channelConfigSummary: string | null;
  wordTarget: number | null;
}) {
  const [script, setScript] = useState(initialScript);
  const [savedScript, setSavedScript] = useState(initialScript);
  const [narrativePrompt, setNarrativePrompt] = useState(masterPrompt);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const router = useRouter();

  const wordCount = useMemo(
    () => (script.trim() ? script.trim().split(/\s+/).length : 0),
    [script]
  );
  const isDirty = script !== savedScript;
  const hasChannel = Boolean(channelName);
  const canGenerate = Boolean(videoTopic.trim()) && hasChannel;

  function handleSave(goNext = false) {
    startTransition(async () => {
      const result = await saveScript({ projectId, script });
      if (result.ok) {
        setSavedScript(script);
        toast.success("Roteiro salvo");
        if (goNext) router.push(`/projects/${projectId}/static/style`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleGenerate() {
    if (!videoTopic.trim()) {
      toast.error("Este projeto não tem tópico. Crie um novo projeto static com tópico.");
      return;
    }
    if (!hasChannel) {
      toast.error("Este projeto precisa estar vinculado a um canal");
      return;
    }

    startGenerate(async () => {
      const result = await generateNarrativeScript({
        projectId,
        videoTopic,
        ai: getAiClientContext(),
      });
      if (result.ok) {
        setScript(result.data.script);
        setSavedScript(result.data.script);
        if (result.data.narrativePrompt) {
          setNarrativePrompt(result.data.narrativePrompt);
        }
        toast.success("Roteiro gerado com o master prompt do canal");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MasterPromptPanel masterPrompt={narrativePrompt} videoTopic={videoTopic} />

      <section className="space-y-4 rounded-xl border bg-card/40 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <Wand2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-sm font-medium">Gerar roteiro</h2>
            <p className="text-xs text-muted-foreground">
              {hasChannel ? (
                <>
                  Canal <span className="text-foreground">{channelName}</span>
                  {wordTarget ? ` · alvo ~${wordTarget} palavras` : ""}. Usa o master prompt
                  acima (tópico do cadastro).
                </>
              ) : (
                "Vincule o projeto a um canal para gerar com o master prompt."
              )}
            </p>
            {channelConfigSummary && (
              <p className="line-clamp-2 font-mono text-[11px] text-muted-foreground/80">
                {channelConfigSummary}
              </p>
            )}
            {videoTopic && (
              <p className="text-xs text-muted-foreground">
                Tópico: <span className="text-foreground">{videoTopic}</span>
              </p>
            )}
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isGenerating || !canGenerate}>
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isGenerating ? "Gerando roteiro…" : "Gerar roteiro narrativo"}
        </Button>

        <Separator />
        <p className="text-xs text-muted-foreground">
          Ou cole / edite o roteiro manualmente no campo abaixo.
        </p>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="O roteiro gerado aparece aqui. Você pode editar livremente antes de salvar."
          className="min-h-[420px] flex-1 resize-none font-mono text-sm leading-relaxed"
          disabled={isGenerating}
        />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{wordCount} palavras</Badge>
            {wordTarget != null && (
              <Badge variant={wordCount >= wordTarget * 0.9 ? "default" : "outline"}>
                alvo {wordTarget}
              </Badge>
            )}
            {isDirty && <span className="text-amber-500">Alterações não salvas</span>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isPending || isGenerating || !isDirty}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar roteiro
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isPending || isGenerating || !script.trim()}
            >
              Salvar e ir ao estilo <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
