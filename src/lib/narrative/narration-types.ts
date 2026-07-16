export type NarrationTypeId = "second-person" | "first-person" | "third-person";

export interface NarrationTypePreset {
  id: NarrationTypeId;
  label: string;
  hint: string;
  /** Rótulo curto para o bloco CHANNEL CONFIG. */
  configLabel: string;
  /** Frase no system prompt (ex.: "second-person direct address"). */
  styleIntro: string;
  /** Conteúdo completo da seção 1.3 — ponto de vista e tempo verbal. */
  povRules: string;
  /** Item do checklist final sobre POV. */
  checklistPov: string;
}

export const NARRATION_TYPE_PRESETS: readonly NarrationTypePreset[] = [
  {
    id: "second-person",
    label: "Segunda pessoa",
    hint: "O espectador é o protagonista — “você vive isso agora”.",
    configLabel: "second-person (viewer as protagonist)",
    styleIntro: 'second-person direct address ("{{ADDRESS_FORM}}")',
    povRules: `- **Second person ("{{ADDRESS_FORM}}"), present tense** — unless the CHANNEL_TYPE format explicitly requires past tense for historical facts (documentary, case-study); then use past for dated events and present for commentary.
- **Format gate:** If CHANNEL_TYPE is **narrative-story**, the viewer IS the protagonist — never "a man" / "someone." Always "{{ADDRESS_FORM}}."
- If CHANNEL_TYPE is **documentary, explainer, listicle, case-study, comparison, or tutorial**, use "{{ADDRESS_FORM}}" only as **direct address to the audience** ("you'll notice," "here's what you need") — NOT as if the viewer lived a fictional personal drama unless the VIDEO_TOPIC explicitly requires it.
- Present tense for immediacy in narrative-story; documentary/case-study may mix past (events) + present (analysis).`,
    checklistPov:
      'Entirely in {{OUTPUT_LANGUAGE}}, "{{ADDRESS_FORM}}," present tense, second person throughout.',
  },
  {
    id: "first-person",
    label: "Primeira pessoa",
    hint: "O narrador conta a própria história — “eu vivi isso”.",
    configLabel: "first-person (narrator as protagonist)",
    styleIntro: "first-person narrator voice",
    povRules: `- **First person** (natural first-person form in {{OUTPUT_LANGUAGE}}).
- **Format gate — narrative-story:** the narrator IS the protagonist telling their own story. Present tense default; time-ladder as lived now ("I am 24.").
- **Format gate — documentary / case-study / explainer:** the narrator is an **investigative host or analyst**, not a fictional character. Use "I" for editorial framing ("I looked into…", "What struck me…") while facts stay precise. Past tense for historical beats is allowed.
- **Format gate — listicle / comparison / tutorial:** "I" = guide or reviewer. No fictional backstory unless the topic demands it.
- Never shift to second person ("{{ADDRESS_FORM}}") except a soft CTA at the very end.`,
    checklistPov:
      "Entirely in {{OUTPUT_LANGUAGE}}, first person, present tense throughout (soft second-person CTA at the end only if it fits).",
  },
  {
    id: "third-person",
    label: "Terceira pessoa",
    hint: "Observa um personagem à distância — estilo documental íntimo.",
    configLabel: "third-person (close observer on one protagonist)",
    styleIntro: "third-person observational narrator",
    povRules: `- **Third person, close observer.**
- **Format gate — narrative-story:** follow ONE named protagonist; present tense default; never address the viewer as "{{ADDRESS_FORM}}."
- **Format gate — documentary / case-study / explainer:** follow the **subject** (company, invention, person, system). Past tense for chronology; present for significance. No mandatory single "hero's journey."
- **Format gate — listicle / comparison / tutorial:** third person is rare — if used, stay encyclopedic ("This method works because…"). Prefer shifting to second-person direct address for tutorials unless CHANNEL config insists on third person.
- Emotion through facts and action, not adjective stacks.`,
    checklistPov:
      "Entirely in {{OUTPUT_LANGUAGE}}, third person, present tense, one consistent protagonist throughout.",
  },
] as const;

export const DEFAULT_NARRATION_TYPE: NarrationTypeId = "second-person";

export function resolveNarrationType(id?: string | null): NarrationTypePreset {
  return (
    NARRATION_TYPE_PRESETS.find((p) => p.id === id) ??
    NARRATION_TYPE_PRESETS.find((p) => p.id === DEFAULT_NARRATION_TYPE)!
  );
}

export function narrationTypeLabel(id?: string | null): string {
  return resolveNarrationType(id).label;
}
