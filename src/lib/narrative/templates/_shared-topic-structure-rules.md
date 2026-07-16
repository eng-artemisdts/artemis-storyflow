## TOPIC-FIRST STRUCTURE (ALL FORMATS)

**Priority rule:** The **VIDEO_TOPIC** (and the title you derive from it) defines what the viewer clicked for — how many items, questions, steps, or acts they expect. That promise **always wins** over generic segment defaults in this template.

### Before writing — parse the topic

Look for:
- **Explicit counts:** "10 questions", "top 5", "3 reasons", "7 mistakes", "5 steps"
- **Format signals:** quiz, trivia, challenge, test, countdown, ranked list, versus, tutorial, case study, documentary

### Budget math (silent — never explain to the user)

```
available ≈ WORD_TARGET − intro (~120–180) − outro (~60–120)
per_segment ≈ available / N
```

| per_segment | Choose format |
|-------------|----------------|
| under 90 words | **Quiz / rapid-fire** — one `##` per question or item; short spoken beats |
| 90–180 words | **Standard list / countdown** — compact but complete items |
| 180+ words | **Deep segments** — essay-style blocks; fewer items if N is small |

**Never** drop the promised count (e.g. 10 questions) to satisfy an old "max 3 segments" convention. **Shrink per-item length** instead.

### Listicle / quiz sub-formats

| Topic signal | Native format | Structure |
|--------------|---------------|-----------|
| questions, quiz, trivia, test, challenge | **Quiz** | Intro hook → `## Question 1` … `## Question N` → outro; difficulty ramp optional; tease one "hard" question mid-list |
| top N, countdown, ranked, best/worst | **Countdown list** | Intro → numbered items → outro |
| 3 things that, deep dive, why X failed | **Deep list** | Intro → 3–5 long items → outro |

### Contradiction rule

If the topic promises **10 quiz questions** and **WORD_TARGET** is ~750 words, write **10 short questions** (~50–65 words each). Do **not** output commentary about template conflicts. Do **not** ask the user to pick a version. Decide and deliver the `.md` only.

### Segment labels

Each `##` heading = one TTS chunk. Match heading labels to format (e.g. `## Question 7`, `## #3 — Item title`, `## Passo 2`).
