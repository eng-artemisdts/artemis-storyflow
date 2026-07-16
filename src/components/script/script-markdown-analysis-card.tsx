"use client";

import type { ScriptMarkdownAnalysis } from "@/lib/narrative/parse-script-markdown";
import { Badge } from "@/components/ui/badge";

export function ScriptMarkdownAnalysisCard({
  analysis,
}: {
  analysis: ScriptMarkdownAnalysis;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-background/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {analysis.title ? (
          <Badge variant="secondary">{analysis.title}</Badge>
        ) : null}
        <Badge variant="outline">{analysis.wordCount} palavras</Badge>
        {analysis.sceneCount > 0 ? (
          <Badge variant="outline">
            {analysis.sceneCount} cena{analysis.sceneCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {analysis.wordTarget != null ? (
          <Badge variant={analysis.wordCount >= analysis.wordTarget * 0.9 ? "default" : "outline"}>
            alvo {analysis.wordTarget}
          </Badge>
        ) : null}
      </div>

      {analysis.scenes.length > 0 ? (
        <ul className="max-h-32 space-y-1.5 overflow-auto text-xs text-muted-foreground">
          {analysis.scenes.map((scene) => (
            <li key={scene.heading} className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">{scene.heading}</span>
              <span className="tabular-nums">({scene.wordCount} pal.)</span>
            </li>
          ))}
        </ul>
      ) : null}

      {analysis.warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
          {analysis.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
