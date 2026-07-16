"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveScript, importScriptMarkdown } from "@/actions/script.actions";
import { analyzeScriptMarkdown } from "@/lib/narrative/parse-script-markdown";
import type { ScriptMarkdownAnalysis } from "@/lib/narrative/parse-script-markdown";
import { MasterPromptPanel } from "@/components/script/master-prompt-panel";
import { ScriptMarkdownAnalysisCard } from "@/components/script/script-markdown-analysis-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Editor narrativo para projetos static — master prompt + importação de roteiro .md.
 */
export function NarrativeScriptEditor({
  projectId,
  initialScript,
  videoTopic,
  masterPrompt,
  wordTarget,
}: {
  projectId: string;
  initialScript: string;
  videoTopic: string;
  masterPrompt: string;
  wordTarget: number | null;
}) {
  const [script, setScript] = useState(initialScript);
  const [savedScript, setSavedScript] = useState(initialScript);
  const [isPending, startTransition] = useTransition();
  const [isImporting, startImport] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [importAnalysis, setImportAnalysis] = useState<ScriptMarkdownAnalysis | null>(() =>
    initialScript.trim() ? analyzeScriptMarkdown(initialScript) : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const wordCount = useMemo(
    () => (script.trim() ? script.trim().split(/\s+/).length : 0),
    [script]
  );
  const isDirty = script !== savedScript;
  const busy = isPending || isImporting;

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

  function handleScriptChange(value: string) {
    setScript(value);
    setImportAnalysis(value.trim() ? analyzeScriptMarkdown(value) : null);
  }

  async function loadMarkdownFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
      toast.error("Use um arquivo .md ou .markdown");
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        toast.error("Arquivo vazio");
        return;
      }
      handleScriptChange(text);
      toast.success(`“${file.name}” carregado — revise a análise abaixo`);
    } catch {
      toast.error("Não foi possível ler o arquivo");
    }
  }

  function handlePickMarkdownFile() {
    fileInputRef.current?.click();
  }

  async function handleMarkdownFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await loadMarkdownFile(file);
  }

  function handleImportAndContinue() {
    if (!script.trim()) {
      toast.error("Anexe ou cole um roteiro .md primeiro");
      return;
    }

    startImport(async () => {
      const result = await importScriptMarkdown({ projectId, script });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedScript(script);
      setImportAnalysis(result.data.analysis);
      const { analysis } = result.data;
      toast.success(
        `Roteiro importado · ${analysis.wordCount} palavras${analysis.sceneCount ? ` · ${analysis.sceneCount} cenas` : ""}`
      );
      router.push(`/projects/${projectId}/static/style`);
    });
  }

  const canImport = Boolean(script.trim() && importAnalysis?.valid);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MasterPromptPanel masterPrompt={masterPrompt} videoTopic={videoTopic} />

      <section
        className={cn(
          "space-y-4 rounded-xl border bg-card/40 p-4 transition-colors",
          dragOver && "border-primary bg-primary/5"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void loadMarkdownFile(file);
        }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <FileUp className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-sm font-medium">Anexar roteiro .md</h2>
            <p className="text-xs text-muted-foreground">
              Arraste um arquivo Markdown ou cole o roteiro abaixo. Analisamos frontmatter, cenas
              e palavras antes de seguir para o estilo.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => void handleMarkdownFileChange(e)}
        />

        <button
          type="button"
          disabled={busy}
          onClick={handlePickMarkdownFile}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/10"
              : "border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
            busy && "pointer-events-none opacity-60"
          )}
        >
          <FileUp className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {dragOver ? "Solte o arquivo .md" : "Arraste ou clique para escolher"}
          </span>
          <span className="text-xs text-muted-foreground">.md, .markdown ou .txt</span>
        </button>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleImportAndContinue}
            disabled={busy || !canImport}
          >
            {isImporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {isImporting ? "Importando…" : "Importar e ir ao estilo"}
          </Button>
        </div>

        {importAnalysis ? <ScriptMarkdownAnalysisCard analysis={importAnalysis} /> : null}
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Textarea
          value={script}
          onChange={(e) => handleScriptChange(e.target.value)}
          placeholder="O roteiro importado aparece aqui em Markdown (.md). Você pode editar antes de continuar."
          className="min-h-[420px] flex-1 resize-none font-mono text-sm leading-relaxed"
          disabled={busy}
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
              disabled={busy || !isDirty}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar roteiro
            </Button>
            <Button onClick={() => handleSave(true)} disabled={busy || !script.trim()}>
              Salvar e ir ao estilo <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
