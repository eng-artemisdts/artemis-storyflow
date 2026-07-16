/** Remove cercas ```markdown e meta-comentário pós-roteiro comum em LLMs. */
export function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  return match ? match[1]!.trim() : trimmed;
}

const META_AFTER_SCRIPT =
  /\n\n+(?:Roteiro pronto|Um ponto|Atenção:|Note:|I need to be honest|Detalhes de produção|Here's what|Here is what|Let me know|If you prefer|Want me to|Quer que eu|Word count:|Total words:|Palavras:|(?:^|\n)---+\s*\n+(?:Um ponto|Note))/im;

/**
 * Extrai só o corpo .md do roteiro — descarta explicações que a LLM cola após o arquivo.
 */
export function extractScriptMarkdown(raw: string): string {
  let text = stripMarkdownFence(raw.trim());

  const fmStart = text.indexOf("---");
  if (fmStart > 0) {
    text = text.slice(fmStart);
  }

  const meta = text.match(META_AFTER_SCRIPT);
  if (meta?.index != null && meta.index > 0) {
    text = text.slice(0, meta.index).trimEnd();
  }

  return text.trim();
}
