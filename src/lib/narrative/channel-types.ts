/**
 * Tipos de canal faceless — baseado em formatos com alta retenção (2025–2026).
 * Refs: SyncStudio (7 formats), OutlierKit, Overseeros format strategy, Vlogslab script formats.
 */

export type ChannelTypeId =
  | "narrative-story"
  | "documentary"
  | "listicle"
  | "explainer"
  | "case-study"
  | "comparison"
  | "tutorial"
  | "custom";

export interface ChannelTypePreset {
  id: ChannelTypeId;
  label: string;
  hint: string;
  /** Referência de canal conhecido (para UI). */
  reference: string;
  /** Arquivo de template base (fallback sem IA). */
  templateFile: string;
  /** Brief para a IA adaptar o template ao canal. */
  aiBrief: string;
}

export const CHANNEL_TYPE_PRESETS: readonly ChannelTypePreset[] = [
  {
    id: "narrative-story",
    label: "História narrativa",
    hint: "Monólogos longos com arco emocional — o espectador vive a história.",
    reference: "Formato atual · histórias em 2ª pessoa",
    templateFile: "master-prompt-narrativo.md",
    aiBrief:
      "Long-form narrative monologue ONLY for narrative-story type. Emotional arc, scene-based structure, suspense hooks, concrete sensory detail. NOT documentary/listicle voice. Output must be MiniMax TTS speakable.",
  },
  {
    id: "documentary",
    label: "Documentário",
    hint: "Video essay investigativo — fatos, revelações e tensão narrativa.",
    reference: "ColdFusion · LEMMiNO · RealLifeLore",
    templateFile: "master-prompt-documentary.md",
    aiBrief:
      "Documentary / video-essay ONLY. Research-led, tension-first, escalating reveals, factual tone. NOT personal narrative monologue. MiniMax speakable prose.",
  },
  {
    id: "listicle",
    label: "Lista / Top N",
    hint: "Itens numerados com progressão — ideal para retenção e escala.",
    reference: "WatchMojo · listas educacionais",
    templateFile: "master-prompt-listicle.md",
    aiBrief:
      "Listicle / countdown ONLY. Numbered segments, tease best item early, bridges between items, high density. NOT narrative arc. MiniMax speakable.",
  },
  {
    id: "explainer",
    label: "Explicador",
    hint: "Conceito complexo simplificado — curiosidade → mecanismo → insight.",
    reference: "Kurzgesagt · TED-Ed · Infographics Show",
    templateFile: "master-prompt-explainer.md",
    aiBrief:
      "Educational explainer ONLY. What-Why-How-SoWhat, one big idea, analogies, pattern interrupts. NOT narrative monologue. MiniMax speakable.",
  },
  {
    id: "case-study",
    label: "Estudo de caso",
    hint: "Ascensão, queda ou decisão de negócio/marca com lições claras.",
    reference: "MagnatesMedia · Company Man · Modern MBA",
    templateFile: "master-prompt-case-study.md",
    aiBrief:
      "Business case study ONLY. Setup → catalyst → escalation → turn → lesson. Named entities, dates, numbers. NOT second-person life story. MiniMax speakable.",
  },
  {
    id: "comparison",
    label: "Comparativo",
    hint: "A vs B com critérios claros — veredicto só no final.",
    reference: "Teardowns · versus · buying guides",
    templateFile: "master-prompt-comparison.md",
    aiBrief:
      "Comparison / versus ONLY. Criteria upfront, side-by-side evaluation, delayed verdict. Reviewer voice, NOT narrative. MiniMax speakable.",
  },
  {
    id: "tutorial",
    label: "Tutorial",
    hint: "Passo a passo com resultado prometido no início.",
    reference: "How-to · walkthrough · guias práticos",
    templateFile: "master-prompt-tutorial.md",
    aiBrief:
      "Step-by-step tutorial ONLY. Outcome-first hook, imperative steps, recap, common mistakes. Instructor voice, NOT narrative. MiniMax speakable.",
  },
  {
    id: "custom",
    label: "Personalizado",
    hint: "Descreva o formato — a IA monta o master prompt sob medida.",
    reference: "Formato definido por você",
    templateFile: "master-prompt-narrativo.md",
    aiBrief:
      "Custom faceless channel format defined by the user. Adapt structure, voice, and segment rules to match their description while keeping placeholder-based config.",
  },
] as const;

export const DEFAULT_CHANNEL_TYPE: ChannelTypeId = "narrative-story";

export function resolveChannelType(id?: string | null): ChannelTypePreset {
  return (
    CHANNEL_TYPE_PRESETS.find((p) => p.id === id) ??
    CHANNEL_TYPE_PRESETS.find((p) => p.id === DEFAULT_CHANNEL_TYPE)!
  );
}

export function channelTypeLabel(id?: string | null): string {
  return resolveChannelType(id).label;
}

/** Placeholders que o template DEVE preservar (validação pós-IA). */
export const REQUIRED_MASTER_PROMPT_PLACEHOLDERS = [
  "{{NICHE}}",
  "{{OUTPUT_LANGUAGE}}",
  "{{CHANNEL_TYPE}}",
  "{{NARRATION_TYPE}}",
  "{{ADDRESS_FORM}}",
  "{{WORD_TARGET}}",
  "{{BRAND_SIGNOFF}}",
  "{{VIDEO_TOPIC}}",
  "{{POV_RULES}}",
  "{{NARRATION_STYLE_INTRO}}",
  "{{REFERENCE_CHARACTER}}",
  "{{REFERENCE_CHARACTER_SECTION}}",
  "{{MINIMAX_VOICEOVER_RULES}}",
  "{{TOPIC_STRUCTURE_RULES}}",
  "{{OUTPUT_DISCIPLINE_RULES}}",
] as const;

export function validateMasterPromptTemplate(template: string): boolean {
  return REQUIRED_MASTER_PROMPT_PLACEHOLDERS.every((token) => template.includes(token));
}
