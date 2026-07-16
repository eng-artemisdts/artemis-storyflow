/**
 * style-presets.ts
 * =============================================================================
 * Presets de estilo visual selecionáveis pelo usuário antes de gerar imagem/vídeo.
 * Cada preset carrega variantes adaptadas ao "dialeto" de prompting de cada
 * família de modelos, baseado nas guias oficiais (Google/Nano Banana, BFL/FLUX,
 * OpenAI/GPT Image, DeepMind/Veo, Google/Gemini Omni) e melhores práticas 2026.
 *
 * ── REGRAS POR MODELO (resumo da pesquisa) ──────────────────────────────────
 *
 * NANO BANANA (Gemini Flash/Pro Image) — modelo "pensante":
 *  - Prosa narrativa e descritiva, NUNCA keyword soup ("dog, park, 4k").
 *  - Frases completas, como briefing para um diretor de arte humano.
 *  - Descrever positivamente o que se quer; evitar negações ("no cars" → "empty street").
 *  - Dar contexto/propósito melhora decisões artísticas do modelo.
 *
 * FLUX.2 (Black Forest Labs):
 *  - Hierarquia importa: Sujeito → Ação → Estilo → Contexto → Detalhes.
 *    O que vem primeiro recebe mais atenção.
 *  - Sweet spot: 30–80 palavras (até ~150 p/ cenas complexas).
 *  - NÃO suporta negative prompts → sempre descrever o resultado positivo.
 *  - Quality tags ("8k, masterpiece") são inúteis — omitir.
 *  - Aceita hex codes ("the jacket is #0FD2C1") e JSON estruturado.
 *
 * GPT IMAGE 2 (OpenAI) — reasoning nativo ("thinking mode"):
 *  - Linguagem natural estruturada tipo SPEC, não tags: keyword spam não faz nada.
 *  - Processamento sequencial: palavras iniciais têm o maior peso visual —
 *    nunca enterrar o sujeito no fim do parágrafo.
 *  - Ordem recomendada: Cena → Sujeito → Detalhes → CONSTRAINTS.
 *  - Todo prompt deve TERMINAR com uma linha de constraints explícita
 *    (o que preservar / o que jamais incluir), senão o modelo "inventa"
 *    watermarks, bordas e elementos plausíveis não pedidos.
 *  - Materiais concretos ("brushed aluminum"), nunca abstratos ("shiny metal").
 *  - Consistência: padrão "character anchor" + até 16 imagens de referência
 *    rotuladas por papel ("Image 1 is the character reference...").
 *  - Texto em imagem: string exata entre aspas + fonte/posição explícitas.
 *
 * SEEDREAM / SDXL-like (fallback genérico):
 *  - Aceita tanto prosa quanto tags; manter prosa + tags de estilo no final.
 *
 * VEO 3.x (vídeo, áudio nativo):
 *  - Fórmula oficial: Cinematografia + Sujeito + Ação + Contexto + Estilo & Ambiance (+ Áudio).
 *  - Diálogo entre aspas duplas: A man says, "..." (+ "no subtitles").
 *  - SFX: e Ambient: como tags separadas. Diálogo curto (~8s de fala).
 *  - Definir o estilo LOGO NO INÍCIO do prompt ("realistic / animated / stop-motion...").
 *
 * KLING 3.x (vídeo, foco em movimento):
 *  - Vocabulário real de cinematografia (dolly, tracking, crane, 35mm).
 *  - 2–3 modificadores de câmera por shot, UM movimento dominante.
 *
 * GEMINI OMNI FLASH (vídeo any-to-any, clipes de 10s com áudio nativo):
 *  - Framework oficial de 6 dimensões: enquadramento/movimento de câmera,
 *    estilo, iluminação, locação, ação e texto — cobrir todas é a maior
 *    alavanca de qualidade.
 *  - ATENÇÃO: por padrão gera MÚLTIPLOS shots com narrativa própria.
 *    Para 1 cena = 1 shot (nosso caso), SEMPRE exigir cena única contínua
 *    → o helper applyVideoStyle injeta isso automaticamente.
 *  - Inputs multimodais: declarar o PAPEL de cada referência
 *    ("Image 1 is the character reference; Image 2 is the location reference").
 *  - Sempre incluir pelo menos um sound cue (o áudio é gerado junto).
 *  - Aceita negative prompts simples e timing em linguagem natural
 *    ("After 3 seconds, ...").
 *  - Vocabulário de câmera é comando técnico: oner, locked off, push in,
 *    dolly zoom, orbit.
 *  - Edição conversacional: "Change X. Keep everything else identical."
 *
 * RUNWAY GEN-4.x:
 *  - Prompts diretos e visuais; estilo no fim; evitar linguagem abstrata.
 * =============================================================================
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ImageModelFamily =
  | "nano-banana" // Gemini Flash/Pro Image (via Gemini API ou fal.ai)
  | "flux" // FLUX.2 pro/flex/dev/klein
  | "gpt-image" // GPT Image 2 (OpenAI API ou fal.ai)
  | "generic"; // Seedream, SDXL, etc.

export type VideoModelFamily =
  | "veo" // Veo 3 / 3.1 (áudio nativo)
  | "kling" // Kling 2.x / 3.x
  | "omni" // Gemini Omni Flash (any-to-any, áudio nativo, 10s)
  | "generic"; // Runway, Wan, Seedance, Hailuo, Luma...

export interface StylePreset {
  id: string;
  /** Nome exibido na UI (pt-BR) */
  label: string;
  /** Descrição curta para tooltip/card na UI */
  description: string;
  /** Emoji/ícone para o seletor */
  icon: string;
  /**
   * Tag de estilo para IMAGEM, por família de modelo.
   * É concatenada ao FINAL do prompt de cena/personagem
   * (exceto Veo/Omni no vídeo, onde o estilo abre o prompt — ver applyVideoStyle).
   * Para 'gpt-image', a tag já termina com a linha de Constraints exigida.
   */
  image: Record<ImageModelFamily, string>;
  /** Tag de estilo para VÍDEO, por família de modelo. */
  video: Record<VideoModelFamily, string>;
  /**
   * Instrução extra usada só na geração do CHARACTER SHEET
   * (garante que a referência do personagem já nasça no estilo certo).
   */
  characterSheetHint: string;
  /**
   * "Anti-drift": reforço POSITIVO para impedir que o modelo escorregue
   * para outro estilo (FLUX não tem negative prompt, então é sempre positivo).
   */
  consistencyLock: string;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const STYLE_PRESETS: StylePreset[] = [
  // 1 ─ PIXAR / 3D ANIMATION ────────────────────────────────────────────────
  {
    id: "pixar-3d",
    label: "Animação 3D (estilo Pixar)",
    description:
      "Personagens 3D expressivos com olhos grandes, texturas suaves e iluminação quente de estúdio de animação.",
    icon: "🎬",
    image: {
      "nano-banana":
        "Rendered as a high-end 3D animated film still in the style of a modern American animation studio: soft rounded character shapes, large expressive eyes, exaggerated friendly proportions, subsurface-scattering skin, detailed fabric and hair simulation, warm cinematic three-point lighting, gentle depth of field, vibrant but harmonious color palette, polished global illumination render.",
      flux: "3D animated feature film still, stylized cartoon character with soft rounded shapes and large expressive eyes, subsurface scattering skin, simulated hair and fabric detail, warm cinematic lighting, vibrant harmonious colors, global illumination, shallow depth of field",
      "gpt-image":
        "Style: high-end 3D animated feature film still from a modern animation studio — soft rounded stylized characters, large expressive eyes, subsurface-scattering skin, simulated hair and fabric, warm cinematic three-point lighting, vibrant harmonious palette, polished global illumination render. Constraints: keep every element of the frame in this single cohesive 3D animated style; render no photorealistic textures, no live-action elements, no text, no watermark, no border.",
      generic:
        "3D animation movie still, pixar-style character design, big expressive eyes, soft rounded shapes, subsurface scattering, cinematic warm lighting, vibrant colors, octane render, global illumination",
    },
    video: {
      veo: "A polished 3D animated film in the style of a modern animation studio, with soft rounded stylized characters, large expressive eyes, warm cinematic lighting, vibrant harmonious colors and smooth exaggerated character animation.",
      kling:
        "3D animated feature film style, stylized cartoon characters with soft rounded shapes and big expressive eyes, smooth exaggerated squash-and-stretch animation, warm cinematic lighting, vibrant color palette",
      omni: "Style: a polished 3D animated feature film from a modern animation studio — soft rounded stylized characters, large expressive eyes, subsurface-scattering skin, warm cinematic lighting, vibrant harmonious colors, smooth exaggerated squash-and-stretch character animation.",
      generic:
        "3D animation movie style, pixar-like stylized characters, expressive faces, smooth character animation, warm cinematic lighting, vibrant colors",
    },
    characterSheetHint:
      "Design the character as an appealing stylized 3D animation character: simplified rounded anatomy, oversized expressive eyes, clear silhouette, friendly proportions.",
    consistencyLock:
      "Every element of the frame is rendered in the same cohesive 3D animated style; no photorealistic textures, no live-action elements.",
  },

  // 2 ─ ANIME ───────────────────────────────────────────────────────────────
  {
    id: "anime",
    label: "Anime",
    description:
      "Estética de anime japonês moderno: cel shading, linhas limpas, cores vibrantes e fundos pintados.",
    icon: "⛩️",
    image: {
      "nano-banana":
        "Illustrated as a frame from a modern high-budget Japanese anime production: clean confident line art, cel shading with two-tone shadows, large expressive anime eyes, detailed painted background in the style of a prestige animation film, vibrant saturated colors with soft atmospheric light, subtle film grain, 2D hand-drawn aesthetic.",
      flux: "modern anime screenshot, clean line art, cel shading with hard two-tone shadows, large expressive anime eyes, detailed painterly background, vibrant saturated colors, soft atmospheric lighting, 2D hand-drawn aesthetic",
      "gpt-image":
        "Style: frame from a modern high-budget Japanese anime — clean confident line art, cel shading with hard two-tone shadows, large expressive anime eyes, detailed painterly background, vibrant saturated colors, soft atmospheric light, 2D hand-drawn aesthetic. Constraints: the entire frame must stay strictly 2D anime with flat cel shading and visible line art throughout; render no photographic, 3D-rendered or western-cartoon elements, no text, no watermark.",
      generic:
        "anime style, high quality anime screenshot, cel shading, clean lineart, detailed painted background, vibrant colors, makoto shinkai lighting, 2D animation still",
    },
    video: {
      veo: "A 2D Japanese anime animation with clean line art, cel shading, large expressive anime eyes, detailed painted backgrounds, vibrant colors and fluid hand-drawn character motion.",
      kling:
        "2D anime animation style, cel shaded characters with clean line art and expressive anime eyes, detailed painterly backgrounds, fluid hand-drawn motion, vibrant saturated color palette",
      omni: "Style: 2D Japanese anime animation — clean line art, cel shading with two-tone shadows, large expressive anime eyes, detailed painted backgrounds, vibrant saturated colors, fluid hand-drawn character motion.",
      generic:
        "anime animation style, 2D cel shaded, clean lineart, expressive characters, painted backgrounds, fluid animation, vibrant colors",
    },
    characterSheetHint:
      "Design the character in modern anime style: clean line art, cel shading, large expressive eyes, distinctive hair silhouette and color, outfit with clear readable shapes.",
    consistencyLock:
      "The entire frame stays strictly 2D anime: flat cel shading and line art throughout; every surface is drawn, never photographic or 3D-rendered.",
  },

  // 3 ─ REALISTA / LIVE ACTION ──────────────────────────────────────────────
  {
    id: "realistic-cinematic",
    label: "Realista Cinematográfico",
    description:
      "Pessoas e cenários fotorrealistas com linguagem de cinema: 35mm, profundidade de campo e color grading.",
    icon: "🎥",
    image: {
      "nano-banana":
        "Captured as a photorealistic cinematic film still shot on 35mm film: true-to-life human skin with visible pores and natural imperfections, realistic fabric and material textures, shallow depth of field, motivated practical lighting, subtle film grain, professional color grading with lifted blacks and gentle teal-and-warm contrast.",
      flux: "photorealistic cinematic film still, shot on 35mm film, natural skin texture with visible pores, realistic materials, shallow depth of field, motivated practical lighting, subtle film grain, professional teal-and-warm color grading",
      "gpt-image":
        "Style: photorealistic cinematic film still shot on 35mm film — true-to-life human skin with visible pores and natural imperfections, realistic fabric weave and material wear, shallow depth of field, motivated practical lighting, subtle film grain, professional teal-and-warm color grading with lifted blacks. Constraints: everything must look like a real photographed film frame with natural human proportions; render no illustration or 3D-render look, no beauty-filter smoothing, no text, no watermark, no border.",
      generic:
        "photorealistic, cinematic film still, 35mm film, natural skin texture, shallow depth of field, dramatic motivated lighting, film grain, professional color grading",
    },
    video: {
      veo: "A photorealistic live-action cinematic film shot on 35mm, with lifelike human performances, natural skin and fabric detail, shallow depth of field, motivated lighting, subtle film grain and professional color grading.",
      kling:
        "photorealistic live-action cinematic footage, 35mm film look, lifelike human motion and facial performance, shallow depth of field, motivated practical lighting, subtle film grain, professional color grade",
      omni: "Style: photorealistic live-action cinematic film shot on 35mm — lifelike human performances with natural micro-expressions, realistic physics of motion, shallow depth of field, motivated practical lighting, subtle film grain, professional teal-and-warm color grade.",
      generic:
        "photorealistic cinematic live-action footage, natural human motion, 35mm film look, shallow depth of field, cinematic lighting and color grading",
    },
    characterSheetHint:
      "Portray the character as a real human being photographed in a neutral studio: authentic skin texture, realistic hair, believable wardrobe with visible fabric weave.",
    consistencyLock:
      "Everything in frame remains strictly photorealistic live-action; all humans look like real photographed people with natural proportions.",
  },

  // 4 ─ 3D REALISTA / GAME CINEMATIC ────────────────────────────────────────
  {
    id: "game-cinematic-3d",
    label: "3D Realista (Game Cinematic)",
    description:
      "Visual de cutscene de jogo AAA: render 3D hiper-detalhado, iluminação dramática e acabamento digital.",
    icon: "🕹️",
    image: {
      "nano-banana":
        "Rendered as a AAA video game cinematic still with hyper-detailed realistic 3D characters: high-polygon models, physically-based materials, ray-traced lighting and reflections, volumetric atmosphere, dramatic rim light, slightly stylized heroic proportions, crisp digital finish typical of a next-gen game engine cutscene.",
      flux: "AAA game cinematic still, hyper-detailed realistic 3D character, physically-based materials, ray-traced lighting and reflections, volumetric atmosphere, dramatic rim lighting, slightly heroic stylized proportions, next-gen game engine render",
      "gpt-image":
        "Style: AAA video game cinematic still rendered in a next-gen game engine — hyper-detailed realistic 3D characters with physically-based materials, ray-traced lighting and reflections, volumetric atmosphere, dramatic rim light, slightly heroic stylized proportions, crisp digital finish. Constraints: the whole frame keeps the same digital game-engine render quality; characters stay 3D-rendered, never flat 2D or purely photographic; no HUD, no interface elements, no text, no watermark.",
      generic:
        "AAA game cinematic, unreal engine 5 render, hyper-detailed 3D character, ray tracing, volumetric lighting, PBR materials, dramatic rim light, next-gen cutscene",
    },
    video: {
      veo: "A AAA video game cinematic rendered in a next-gen game engine, with hyper-detailed realistic 3D characters, ray-traced lighting, volumetric atmosphere and dramatic heroic framing.",
      kling:
        "AAA game engine cinematic style, hyper-detailed 3D characters with physically-based materials, ray-traced reflections, volumetric fog, dramatic rim lighting, smooth motion-captured animation",
      omni: "Style: AAA video game cinematic rendered in a next-gen game engine — hyper-detailed 3D characters with physically-based materials, ray-traced reflections, volumetric fog, dramatic rim lighting, smooth motion-captured animation.",
      generic:
        "video game cinematic style, next-gen 3D render, detailed characters, volumetric lighting, ray tracing, dramatic cinematography",
    },
    characterSheetHint:
      "Design the character as a AAA game protagonist: hyper-detailed 3D model, physically-based clothing materials, strong readable silhouette, subtle heroic proportions.",
    consistencyLock:
      "The whole frame keeps the same digital game-engine render quality; characters remain 3D-rendered, never flat 2D or photographic.",
  },

  // 5 ─ CARTOON 2D OCIDENTAL ────────────────────────────────────────────────
  {
    id: "cartoon-2d",
    label: "Cartoon 2D",
    description:
      "Desenho animado ocidental: formas geométricas divertidas, contornos grossos e cores chapadas.",
    icon: "✏️",
    image: {
      "nano-banana":
        "Drawn as a frame from a modern western 2D cartoon series: bold clean thick outlines, flat vibrant colors with minimal shading, playful geometric character shapes, exaggerated expressions, simple graphic backgrounds with limited color palettes, contemporary TV animation aesthetic.",
      flux: "modern western 2D cartoon frame, bold thick outlines, flat vibrant colors, minimal shading, playful geometric character design, exaggerated expressions, simple graphic background, TV animation aesthetic",
      "gpt-image":
        "Style: frame from a modern western 2D cartoon series — bold clean thick outlines, flat vibrant colors with minimal shading, playful geometric character shapes, exaggerated expressions, simple graphic backgrounds with a limited palette. Constraints: keep every element flat 2D cartoon with the same outline weight and flat color treatment throughout; render no gradients-heavy 3D look, no photographic textures, no text, no watermark.",
      generic:
        "2D cartoon style, thick bold outlines, flat colors, modern western TV animation, geometric shapes, exaggerated expressions, graphic background",
    },
    video: {
      veo: "A modern western 2D cartoon animation with bold thick outlines, flat vibrant colors, playful geometric character designs, snappy exaggerated motion and simple graphic backgrounds.",
      kling:
        "2D western cartoon animation style, thick bold outlines, flat vibrant colors, geometric character shapes, snappy exaggerated squash-and-stretch motion, simple graphic backgrounds",
      omni: "Style: modern western 2D cartoon animation — bold thick outlines, flat vibrant colors, playful geometric character designs, snappy exaggerated squash-and-stretch motion, simple graphic backgrounds.",
      generic:
        "2D cartoon animation, bold outlines, flat colors, exaggerated snappy motion, modern TV animation style",
    },
    characterSheetHint:
      "Design the character with bold cartoon simplification: geometric body shapes, thick clean outlines, flat colors, instantly readable silhouette.",
    consistencyLock:
      "Every frame element stays flat 2D cartoon with the same outline weight and flat color treatment throughout.",
  },

  // 6 ─ STOP MOTION / CLAYMATION ────────────────────────────────────────────
  {
    id: "stop-motion",
    label: "Stop Motion / Claymation",
    description:
      "Bonecos artesanais de massinha/feltro com imperfeições visíveis e charme de animação quadro a quadro.",
    icon: "🧸",
    image: {
      "nano-banana":
        "Photographed as a handcrafted stop-motion animation still: characters sculpted from clay and fabric with visible fingerprints, seams and fuzz, miniature handbuilt sets with real material textures, warm practical miniature lighting, shallow macro depth of field, the tangible charm of physical frame-by-frame animation.",
      flux: "handcrafted stop-motion animation still, clay and fabric puppet characters with visible fingerprints and seams, miniature handbuilt set, real material textures, warm practical lighting, shallow macro depth of field",
      "gpt-image":
        "Style: handcrafted stop-motion animation still — characters sculpted from clay and fabric with visible fingerprints, seams and fuzz, miniature handbuilt sets with real wood, felt and wire textures, warm practical miniature lighting, shallow macro depth of field. Constraints: everything must look physically handcrafted in miniature with tangible material imperfections; render no smooth digital CGI surfaces, no photographic humans, no text, no watermark.",
      generic:
        "claymation stop-motion style, handcrafted clay puppets, visible fingerprints, miniature sets, felt and fabric textures, warm lighting, aardman laika aesthetic",
    },
    video: {
      veo: "A handcrafted stop-motion claymation film with clay-and-fabric puppet characters, visible handmade imperfections, miniature physical sets, warm practical lighting and characteristic slightly stepped frame-by-frame motion at a lower animation framerate.",
      kling:
        "stop-motion claymation animation style, handcrafted clay puppets with visible seams and fingerprints, miniature physical sets, warm practical light, stepped frame-by-frame motion cadence",
      omni: "Style: handcrafted stop-motion claymation — clay-and-fabric puppet characters with visible seams and fingerprints, miniature physical sets, warm practical light, characteristic stepped frame-by-frame motion cadence at a lower animation framerate.",
      generic:
        "stop-motion animation style, claymation puppets, handcrafted miniature sets, stepped low-framerate motion, warm practical lighting",
    },
    characterSheetHint:
      "Design the character as a physical stop-motion puppet: sculpted clay head, wire-armature body, fabric costume with real stitching, visible handmade texture.",
    consistencyLock:
      "Everything remains physically handcrafted in miniature: clay, felt, wood and wire textures throughout, with the same puppet build in every scene.",
  },

  // 7 ─ AQUARELA / LIVRO INFANTIL ───────────────────────────────────────────
  {
    id: "watercolor-storybook",
    label: "Aquarela / Livro Ilustrado",
    description:
      "Ilustração delicada de livro infantil: aguadas de aquarela, papel texturizado e traço à mão.",
    icon: "🖌️",
    image: {
      "nano-banana":
        "Painted as a children's storybook illustration in traditional watercolor: soft translucent washes with visible pigment blooms and paper grain, loose expressive hand-drawn ink linework, gentle pastel palette, whimsical warm atmosphere, generous white space at the edges like a printed picture book page.",
      flux: "children's storybook watercolor illustration, soft translucent washes, visible pigment blooms and paper texture, loose hand-drawn ink linework, gentle pastel palette, whimsical warm atmosphere",
      "gpt-image":
        "Style: children's storybook illustration in traditional watercolor — soft translucent washes with visible pigment blooms and paper grain, loose expressive hand-drawn ink linework, gentle pastel palette, whimsical warm atmosphere. Constraints: keep the hand-painted watercolor treatment with visible paper texture across the entire frame, characters and background alike; render no digital-smooth or photographic surfaces, no text, no watermark.",
      generic:
        "watercolor storybook illustration, soft washes, paper texture, hand-drawn ink lines, pastel colors, whimsical children's book art",
    },
    video: {
      veo: "An animated children's storybook in traditional watercolor style, with soft translucent painted washes, visible paper texture, loose ink linework, gentle pastel colors and dreamy, gently flowing animation.",
      kling:
        "animated watercolor storybook style, soft translucent painted textures, visible paper grain, loose ink outlines, pastel palette, gentle dreamlike motion",
      omni: "Style: animated children's storybook in traditional watercolor — soft translucent painted washes, visible paper grain, loose ink outlines, gentle pastel palette, dreamy gently flowing animation.",
      generic:
        "watercolor animation style, painted storybook look, soft washes and paper texture, pastel colors, gentle dreamy motion",
    },
    characterSheetHint:
      "Design the character as a storybook illustration: soft watercolor rendering, loose ink outline, simple endearing proportions, pastel costume colors.",
    consistencyLock:
      "Every frame keeps the same hand-painted watercolor treatment with paper texture visible in all areas, characters and background alike.",
  },

  // 8 ─ HQ / COMIC BOOK ─────────────────────────────────────────────────────
  {
    id: "comic-book",
    label: "HQ / Comic Book",
    description:
      "Arte de quadrinhos: hachuras a tinta, cores meio-tom, sombras dramáticas e energia gráfica.",
    icon: "💥",
    image: {
      "nano-banana":
        "Illustrated as a premium comic book panel: confident ink linework with crosshatching and spot blacks, bold halftone-dot color shading, dramatic high-contrast comic lighting, dynamic heroic composition, subtle off-white paper tone, modern graphic novel finish.",
      flux: "premium comic book panel art, confident ink linework with crosshatching, spot blacks, halftone dot shading, dramatic high-contrast lighting, dynamic composition, modern graphic novel style",
      "gpt-image":
        "Style: premium comic book panel — confident ink linework with crosshatching and spot blacks, bold halftone-dot color shading, dramatic high-contrast comic lighting, dynamic heroic composition, subtle off-white paper tone, modern graphic novel finish. Constraints: keep the inked comic treatment with visible linework and halftone shading in every part of the frame; render no photographic realism, no speech balloons, no caption boxes, no text, no watermark.",
      generic:
        "comic book art style, ink linework, crosshatching, halftone shading, bold colors, dramatic comic lighting, graphic novel panel",
    },
    video: {
      veo: "A motion comic in premium graphic novel style, with bold ink linework, crosshatched shading, halftone color textures, dramatic high-contrast lighting and stylized comic-panel energy in the animation.",
      kling:
        "animated comic book style, bold ink outlines, crosshatch and halftone shading, high-contrast dramatic lighting, punchy stylized motion with graphic energy",
      omni: "Style: animated motion comic in premium graphic novel style — bold ink linework, crosshatched and halftone shading, dramatic high-contrast lighting, punchy stylized motion with graphic panel energy.",
      generic:
        "comic book animation style, ink outlines, halftone textures, bold dramatic colors, graphic novel aesthetic",
    },
    characterSheetHint:
      "Design the character as a comic book protagonist: strong inked outline, iconic costume with bold shapes and colors, dramatic idealized anatomy.",
    consistencyLock:
      "All elements keep the inked comic treatment: visible linework, halftone shading and flat graphic color in every part of the frame.",
  },

  // 9 ─ FANTASIA ÉPICA / PINTURA DIGITAL ────────────────────────────────────
  {
    id: "epic-fantasy",
    label: "Fantasia Épica",
    description:
      "Concept art de fantasia: pintura digital rica, luz dramática e atmosfera de mundos épicos.",
    icon: "🐉",
    image: {
      "nano-banana":
        "Painted as epic fantasy concept art: rich painterly digital brushwork, dramatic volumetric god-rays, monumental sense of scale, intricate costume and armor detail, moody atmospheric perspective with mist and depth layers, a color script of deep jewel tones and golden highlights, prestige fantasy film production art.",
      flux: "epic fantasy concept art, rich painterly digital brushwork, dramatic volumetric light rays, monumental scale, intricate armor and costume detail, atmospheric mist, deep jewel tones with golden highlights",
      "gpt-image":
        "Style: epic fantasy concept art — rich painterly digital brushwork, dramatic volumetric god-rays, monumental sense of scale, intricate costume and armor detail, atmospheric mist with layered depth, deep jewel tones with golden highlights, prestige fantasy production art. Constraints: keep a coherent painterly high-fantasy visual language across the entire frame; render no modern objects, no photographic finish, no text, no watermark.",
      generic:
        "epic fantasy digital painting, concept art, dramatic volumetric lighting, painterly brushwork, intricate details, atmospheric perspective, jewel tone palette",
    },
    video: {
      veo: "An epic fantasy film with a rich painterly-realistic look: dramatic volumetric light, monumental landscapes, intricate costumes, atmospheric mist and a deep jewel-toned cinematic color palette.",
      kling:
        "epic fantasy cinematic style, painterly-realistic rendering, dramatic volumetric god rays, monumental scale landscapes, intricate costume detail, jewel-toned color grade, sweeping majestic motion",
      omni: "Style: epic fantasy cinema with a painterly-realistic look — dramatic volumetric god-rays, monumental landscapes, intricate era-consistent costumes, atmospheric mist, deep jewel-toned color grade, sweeping majestic motion.",
      generic:
        "epic fantasy cinematic style, dramatic lighting, monumental scale, detailed costumes, atmospheric and majestic",
    },
    characterSheetHint:
      "Design the character as a fantasy hero concept: intricate era-appropriate costume/armor, meaningful props, strong silhouette readable at a distance.",
    consistencyLock:
      "The world keeps a coherent high-fantasy visual language: consistent costume culture, architecture and painterly finish in every scene.",
  },

  // 10 ─ CYBERPUNK / NEON ───────────────────────────────────────────────────
  {
    id: "cyberpunk-neon",
    label: "Cyberpunk Neon",
    description:
      "Futuro distópico: neon rosa e ciano, chuva, reflexos molhados e tecnologia high-tech low-life.",
    icon: "🌆",
    image: {
      "nano-banana":
        "Rendered as a cinematic cyberpunk scene: dense futuristic megacity drenched in rain, saturated neon signage in magenta, cyan and electric teal reflecting off wet asphalt and glass, holographic advertisements, moody low-key lighting with strong colored rim lights, high-tech low-life atmosphere, anamorphic lens flares and cinematic haze.",
      flux: "cinematic cyberpunk scene, rain-soaked futuristic megacity, magenta and cyan neon reflections on wet asphalt, holographic ads, low-key moody lighting with colored rim light, anamorphic flares, cinematic haze",
      "gpt-image":
        "Style: cinematic cyberpunk scene — rain-soaked futuristic megacity, saturated neon signage in magenta, cyan and electric teal reflecting off wet asphalt and glass, holographic advertisements, moody low-key lighting with colored rim lights, anamorphic lens flares and cinematic haze. Constraints: keep the magenta-cyan-teal neon color language and rain-wet atmosphere across the whole frame; render neon signs as abstract glowing shapes with no readable words, no real brand logos, no watermark.",
      generic:
        "cyberpunk style, neon-lit futuristic city, rain and wet reflections, magenta cyan palette, holograms, blade runner atmosphere, cinematic moody lighting",
    },
    video: {
      veo: "A cinematic cyberpunk film set in a rain-soaked neon megacity, with magenta and cyan light reflecting on wet streets, holographic signage, moody low-key lighting, atmospheric haze and anamorphic lens flares.",
      kling:
        "cyberpunk cinematic style, rain-soaked neon megacity, magenta and cyan reflections on wet ground, holographic ads, moody low-key light, atmospheric haze, smooth noir camera moves",
      omni: "Style: cinematic cyberpunk — rain-soaked neon megacity, magenta and cyan light reflecting on wet streets, holographic signage, moody low-key lighting, atmospheric haze, anamorphic lens flares.",
      generic:
        "cyberpunk cinematic style, neon city at night, rain reflections, magenta cyan lighting, futuristic moody atmosphere",
    },
    characterSheetHint:
      "Design the character with cyberpunk fashion: techwear layers, subtle cybernetic details, neon accent colors in the outfit, urban futuristic styling.",
    consistencyLock:
      "The neon color language (magenta, cyan, electric teal) and rain-wet atmosphere persist in every scene of the video.",
  },

  // 11 ─ NOIR P&B ───────────────────────────────────────────────────────────
  {
    id: "film-noir",
    label: "Film Noir P&B",
    description:
      "Preto e branco clássico: sombras duras, contraste chiaroscuro, fumaça e mistério anos 40.",
    icon: "🕵️",
    image: {
      "nano-banana":
        "Photographed as a classic 1940s film noir still in black and white: hard chiaroscuro lighting with deep shadows and venetian-blind light patterns, dramatic low-key contrast, curling cigarette smoke in light beams, rain-slicked streets, vintage wardrobe and set dressing, fine silver-halide film grain.",
      flux: "classic 1940s film noir still, black and white, hard chiaroscuro lighting, venetian blind shadow patterns, deep low-key contrast, smoke in light beams, rain-slicked streets, vintage film grain",
      "gpt-image":
        "Style: classic 1940s film noir still in black and white — hard chiaroscuro lighting with deep shadows and venetian-blind light patterns, dramatic low-key contrast, drifting smoke in light beams, rain-slicked streets, vintage wardrobe and set dressing, fine silver-halide film grain. Constraints: the frame must be strictly monochrome black and white with the same hard low-key lighting grammar; render no color tints, no modern objects, no text, no watermark.",
      generic:
        "film noir style, black and white, chiaroscuro lighting, hard shadows, 1940s aesthetic, smoke and rain, high contrast, vintage film grain",
    },
    video: {
      veo: "A classic black-and-white 1940s film noir, with hard chiaroscuro lighting, deep shadows, venetian-blind light patterns, drifting cigarette smoke, rain-slicked streets and vintage silver-screen film grain.",
      kling:
        "black and white film noir style, hard chiaroscuro lighting, deep dramatic shadows, drifting smoke, rain-slicked streets, slow deliberate noir camera movement, vintage film grain",
      omni: "Style: classic 1940s black-and-white film noir — hard chiaroscuro lighting, deep dramatic shadows, venetian-blind light patterns, drifting smoke, rain-slicked streets, slow deliberate noir camera moves, vintage silver-screen film grain.",
      generic:
        "film noir black and white style, dramatic hard shadows, high contrast, 1940s atmosphere, moody slow cinematography",
    },
    characterSheetHint:
      "Design the character in 1940s period wardrobe: fedora/trench coat or era-appropriate dress, styled hair, rendered fully in dramatic black-and-white light.",
    consistencyLock:
      "The entire film remains strictly black and white with the same hard low-key lighting grammar; every frame is monochrome.",
  },

  // 12 ─ DOCUMENTÁRIO REALISTA ──────────────────────────────────────────────
  {
    id: "documentary",
    label: "Documentário Realista",
    description:
      "Estética de documentário premium: luz natural, câmera contida e realismo histórico crível.",
    icon: "📹",
    image: {
      "nano-banana":
        "Captured as a still from a prestige documentary: naturalistic available-light photography, authentic unstaged feel, true-to-period costumes and props with historical accuracy, muted realistic color palette, honest textures and weathering, restrained composition like a high-end streaming documentary reenactment.",
      flux: "prestige documentary still, naturalistic available light, authentic unstaged atmosphere, historically accurate costumes and props, muted realistic color palette, honest weathered textures",
      "gpt-image":
        "Style: still from a prestige documentary reenactment — naturalistic available-light photography, authentic unstaged feel, historically accurate period costumes and props, muted realistic color palette, honest weathered textures, restrained composition. Constraints: everything must stay grounded and historically plausible with natural light only; render no fantasy elements, no stylized color grades, no anachronistic objects, no text, no watermark.",
      generic:
        "documentary photography style, natural available light, realistic muted colors, authentic historical detail, high-end docuseries reenactment look",
    },
    video: {
      veo: "A prestige documentary reenactment filmed with naturalistic available light, handheld restrained camera work, historically accurate costumes and settings, muted realistic color grading and an authentic observational feel.",
      kling:
        "prestige documentary reenactment style, naturalistic available light, subtle handheld camera, historically accurate detail, muted realistic color grade, observational unstaged atmosphere",
      omni: "Style: prestige documentary reenactment — naturalistic available light, subtle handheld observational camera, historically accurate costumes and settings, muted realistic color grade, authentic unstaged atmosphere grounded in real-world physics and period detail.",
      generic:
        "documentary style footage, natural lighting, handheld observational camera, realistic muted color grade, authentic period detail",
    },
    characterSheetHint:
      "Portray the character with strict historical accuracy: period-correct clothing, realistic weathered materials, natural undramatized appearance.",
    consistencyLock:
      "Everything stays grounded and historically plausible: natural light only, muted palette, no fantasy or stylized elements.",
  },
];

// ─── Helpers de aplicação ────────────────────────────────────────────────────

/** Busca um preset built-in pelo id (null/undefined/desconhecido → null). */
export function getStylePreset(styleId: string | null | undefined): StylePreset | null {
  if (!styleId) return null;
  return STYLE_PRESETS.find((p) => p.id === styleId) ?? null;
}

/**
 * Converte um estilo cadastrado pelo usuário (título + prompt único)
 * no formato StylePreset usado pelo pipeline de geração.
 * O mesmo prompt alimenta todas as famílias de modelo.
 */
export function customStyleToPreset(style: {
  id: string;
  title: string;
  prompt: string;
}): StylePreset {
  const prompt = style.prompt.trim();
  const gptImage = `Style: ${prompt}. Constraints: keep every element of the frame in this single cohesive style; render no text, no watermark, no border.`;
  const description =
    prompt.length > 140 ? `${prompt.slice(0, 137).trimEnd()}…` : prompt;

  return {
    id: style.id,
    label: style.title,
    description,
    icon: "✨",
    image: {
      "nano-banana": prompt,
      flux: prompt,
      "gpt-image": gptImage,
      generic: prompt,
    },
    video: {
      veo: prompt,
      kling: prompt,
      omni: `Style: ${prompt}`,
      generic: prompt,
    },
    characterSheetHint: `Design the character in this visual style: ${prompt}`,
    consistencyLock:
      "Every element of the frame is rendered in the same cohesive custom style; keep the look identical across scenes.",
  };
}

export type CustomStyleInput = {
  id: string;
  title: string;
  prompt: string;
};

/**
 * Instrução de cena única para o Gemini Omni Flash.
 * Por padrão o Omni gera múltiplos shots com narrativa própria — nosso
 * pipeline trabalha com 1 cena = 1 shot, então isso é injetado sempre.
 */
const OMNI_SINGLE_SCENE =
  "Single continuous unbroken scene, one shot only, no cuts, no scene changes.";

/**
 * Aplica o estilo a um prompt de IMAGEM.
 * - FLUX/Nano Banana/generic: sujeito primeiro, estilo depois.
 * - GPT Image 2: o estilo já termina com a linha de Constraints obrigatória,
 *   que deve ser a ÚLTIMA coisa do prompt (padrão OpenAI: cena → sujeito →
 *   detalhes → constraints). O consistencyLock, quando pedido, entra ANTES
 *   da tag de estilo para não deslocar os constraints do final.
 */
export function applyImageStyle(
  basePrompt: string,
  preset: StylePreset,
  family: ImageModelFamily,
  opts?: { withConsistencyLock?: boolean }
): string {
  const style = preset.image[family];
  const lock = opts?.withConsistencyLock ? ` ${preset.consistencyLock}` : "";
  if (family === "gpt-image") {
    // constraints do estilo permanecem no final absoluto do prompt
    return `${basePrompt.trim()}${lock} ${style}`.trim();
  }
  return `${basePrompt.trim()} ${style}${lock}`.trim();
}

/**
 * Aplica o estilo a um prompt de VÍDEO.
 * - Veo: o estilo ABRE o prompt (recomendação oficial: declarar o tipo de
 *   vídeo logo no início).
 * - Omni Flash: estilo abre o prompt + instrução de cena única contínua
 *   (o modelo gera multi-shot por padrão). O base prompt DEVE conter pelo
 *   menos um sound cue — o Omni gera áudio junto e prompt "mudo" produz
 *   áudio imprevisível.
 * - Kling/generic: estilo fecha o prompt.
 */
export function applyVideoStyle(
  basePrompt: string,
  preset: StylePreset,
  family: VideoModelFamily
): string {
  const style = preset.video[family];
  if (family === "veo") {
    return `${style} ${basePrompt.trim()} ${preset.consistencyLock}`.trim();
  }
  if (family === "omni") {
    return `${OMNI_SINGLE_SCENE} ${style} ${basePrompt.trim()} ${preset.consistencyLock} Keep the style identical for the entire clip.`.trim();
  }
  return `${basePrompt.trim()} ${style}. ${preset.consistencyLock}`.trim();
}

/**
 * Instrução de estilo para o CHARACTER SHEET (referência do personagem).
 * Combinar com o visualPrompt do personagem vindo da análise do roteiro.
 * No GPT Image 2, o hint + descrição vêm primeiro (sujeito no início =
 * maior peso visual) e o estilo com constraints fecha o prompt.
 */
export function applyCharacterSheetStyle(
  characterPrompt: string,
  preset: StylePreset,
  family: ImageModelFamily
): string {
  return `${preset.characterSheetHint} ${characterPrompt.trim()} ${preset.image[family]}`.trim();
}

/**
 * Prefixo de referências para modelos multimodais que exigem declaração
 * do PAPEL de cada input (GPT Image 2 e Gemini Omni Flash).
 * Ex.: buildReferenceRolePrefix(['Marcus', 'Livia'], true)
 *  → "Image 1 is the character reference for Marcus... The last image is the
 *     location reference..."
 */
export function buildReferenceRolePrefix(
  characterNames: string[],
  hasLocationReference: boolean
): string {
  const parts = characterNames.map(
    (name, i) =>
      `Image ${i + 1} is the character reference for ${name}: keep this exact face, hairstyle, body and outfit unchanged.`
  );
  if (hasLocationReference) {
    parts.push(
      "The last image is the location reference: keep its architecture, layout and atmosphere."
    );
  }
  return parts.join(" ");
}

/** Mapeia o model id escolhido no projeto para a família de prompting. */
export function resolveImageFamily(modelId: string): ImageModelFamily {
  if (/nano-banana|gemini.*image|imagen/i.test(modelId)) return "nano-banana";
  if (/flux/i.test(modelId)) return "flux";
  if (/gpt-image|dall-?e/i.test(modelId)) return "gpt-image";
  return "generic";
}

export function resolveVideoFamily(modelId: string): VideoModelFamily {
  if (/veo/i.test(modelId)) return "veo";
  if (/kling/i.test(modelId)) return "kling";
  if (/omni/i.test(modelId)) return "omni";
  return "generic";
}
