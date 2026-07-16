## MINIMAX TTS — VOICEOVER RULES (ALL FORMATS)

The script will be fed **verbatim** to **MiniMax Speech 2.8** (or compatible TTS). Write for the **ear**, not the eye.

### Spoken-prose rules (mandatory in every scene)

- **Full speakable sentences only.** No bullet lists, no tables, no `[VISUAL]` / `[B-ROLL]` / timestamp markers inside scene prose.
- **Sentence length:** average **8–18 words**; hard max **~22 words** per sentence. One idea per sentence.
- **Rhythm:** alternate short punchy lines with slightly longer context lines. Short lines at reveals; longer lines at setup.
- **Numbers & names:** spell how they should be heard — currencies, dates, acronyms (expand on first use), percentages, large numbers (use words when natural in {{OUTPUT_LANGUAGE}}).
- **No visual-only language:** ban "as you can see," "on screen," "below," "this chart shows," "watch what happens" unless the meaning survives audio-only.
- **No nested clauses** that confuse prosody. Split into two sentences instead.
- **Punctuation = pacing:** commas for brief pauses; periods for full stops. Use em dashes sparingly.
- **Dialogue:** keep quoted lines under 12 words; attribute simply ("he said," "she replied").
- **Contractions & register:** natural spoken {{OUTPUT_LANGUAGE}}; neutral, consistent register.

### MiniMax pause markers (use sparingly)

- Insert `<#0.6#>` to `<#1.2#>` **only** at major beat changes inside a scene (max **2 per scene**).
- Optional at the **end of each `##` section** before the next heading: `<#0.8#>` — helps chunk long renders.
- Do **not** pepper pause tags mid-phrase.

### Sound tags (optional, rare)

- For **narrative-story** only: at most **1–2 tags** in the entire script, e.g. `(breath)` or `(sighs)`, only where silence carries meaning.
- **Never** use sound tags in documentary, listicle, explainer, case-study, comparison, or tutorial scripts.

### Scene = TTS chunk

- Each `##` section is one **continuous narration block** for a separate TTS pass / audio segment.
- Do not reference "the last scene" or "above" — use brief in-scene callbacks instead.

### Before output

- Mentally **read every paragraph aloud**. Rewrite anything that stumbles.
- Prose word count excludes frontmatter and all headings.
