export interface ScriptMarkdownScene {
  heading: string;
  wordCount: number;
  preview: string;
}

export interface ScriptMarkdownAnalysis {
  title: string | null;
  topic: string | null;
  language: string | null;
  wordTarget: number | null;
  sceneCount: number;
  scenes: ScriptMarkdownScene[];
  wordCount: number;
  warnings: string[];
  valid: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  return match ? match[1]!.trim() : trimmed;
}

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2] ?? "" };
}

function parseScenes(body: string): ScriptMarkdownScene[] {
  const lines = body.split(/\r?\n/);
  const scenes: ScriptMarkdownScene[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (!currentHeading) return;
    const prose = currentLines.join("\n").trim();
    const words = countWords(prose);
    scenes.push({
      heading: currentHeading,
      wordCount: words,
      preview: prose.slice(0, 160) + (prose.length > 160 ? "…" : ""),
    });
  }

  for (const line of lines) {
    const sceneMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sceneMatch) {
      flush();
      currentHeading = sceneMatch[1]!.trim();
      currentLines = [];
      continue;
    }
    if (currentHeading && !line.match(/^#\s+/)) {
      currentLines.push(line);
    }
  }
  flush();

  return scenes;
}

/** Extrai o texto falável de cada cena (##) do roteiro .md. */
export function extractScriptSceneProse(raw: string): string[] {
  const normalized = stripMarkdownFence(raw);
  const { body } = parseFrontmatter(normalized);
  const lines = body.split(/\r?\n/);
  const scenes: string[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (!currentHeading) return;
    const prose = currentLines.join("\n").trim();
    if (prose) scenes.push(prose);
  }

  for (const line of lines) {
    const sceneMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sceneMatch) {
      flush();
      currentHeading = sceneMatch[1]!.trim();
      currentLines = [];
      continue;
    }
    if (currentHeading && !line.match(/^#\s+/)) {
      currentLines.push(line);
    }
  }
  flush();

  if (scenes.length > 0) return scenes;

  const fallback = body
    .split(/\r?\n/)
    .filter((line) => !line.match(/^#{1,6}\s+/))
    .join("\n")
    .trim();
  return fallback ? [fallback] : [];
}

/**
 * Monta texto pronto para colar no MiniMax Speech TTS.
 * Junta cenas com pausa curta entre blocos (<#0.8#>).
 */
export function buildMinimaxNarrationText(raw: string): string {
  const scenes = extractScriptSceneProse(raw);
  if (scenes.length === 0) return "";
  if (scenes.length === 1) return scenes[0]!;
  return scenes.join("\n\n<#0.8#>\n\n");
}

function parseTitle(body: string, frontmatter: Record<string, string>): string | null {
  const fromFm = frontmatter.title?.trim();
  if (fromFm) return fromFm;
  const h1 = body.match(/^#\s+(.+?)\s*$/m);
  return h1?.[1]?.trim() ?? null;
}

/**
 * Analisa um roteiro em Markdown (.md): frontmatter, título, cenas (##) e contagem de palavras.
 */
export function analyzeScriptMarkdown(raw: string): ScriptMarkdownAnalysis {
  const normalized = stripMarkdownFence(raw);
  const { frontmatter, body } = parseFrontmatter(normalized);
  const title = parseTitle(body, frontmatter);
  const scenes = parseScenes(body);

  const proseParts: string[] = [];
  if (scenes.length > 0) {
    for (const scene of scenes) {
      if (scene.wordCount > 0) proseParts.push(scene.preview);
    }
  } else {
    const withoutHeadings = body
      .split(/\r?\n/)
      .filter((line) => !line.match(/^#{1,6}\s+/))
      .join("\n");
    proseParts.push(withoutHeadings);
  }

  const wordCount =
    scenes.length > 0
      ? scenes.reduce((sum, s) => sum + s.wordCount, 0)
      : countWords(proseParts.join("\n"));

  const warnings: string[] = [];
  if (!frontmatter.title && !title) {
    warnings.push("Sem título no frontmatter ou H1.");
  }
  if (scenes.length === 0) {
    warnings.push("Nenhuma cena (##) detectada — roteiro tratado como bloco único.");
  }
  if (wordCount < 50) {
    warnings.push(`Roteiro curto (${wordCount} palavras no corpo).`);
  }

  const wordTargetRaw = frontmatter.word_target ?? frontmatter.wordTarget;
  const wordTarget = wordTargetRaw ? Number.parseInt(wordTargetRaw, 10) : null;
  if (wordTarget != null && !Number.isNaN(wordTarget) && wordCount < wordTarget * 0.5) {
    warnings.push(`Abaixo de ~50% do alvo (${wordTarget} palavras).`);
  }

  const valid = wordCount >= 50;

  return {
    title,
    topic: frontmatter.topic?.trim() || null,
    language: frontmatter.language?.trim() || null,
    wordTarget: wordTarget != null && !Number.isNaN(wordTarget) ? wordTarget : null,
    sceneCount: scenes.length,
    scenes,
    wordCount,
    warnings,
    valid,
  };
}
