export interface ReferenceCharacterConfig {
  hasReferenceCharacter: boolean;
  referenceCharacterName: string;
  referenceCharacterDescription: string;
}

export function resolveReferenceCharacterLabel(config: ReferenceCharacterConfig): string {
  if (!config.hasReferenceCharacter || !config.referenceCharacterName.trim()) {
    return "none";
  }
  return config.referenceCharacterName.trim();
}

export function buildReferenceCharacterSection(config: ReferenceCharacterConfig): string {
  if (!config.hasReferenceCharacter || !config.referenceCharacterName.trim()) {
    return `No recurring reference character for this channel. Do not invent a mandatory visual character unless the topic explicitly requires one.`;
  }

  const name = config.referenceCharacterName.trim();
  const description = config.referenceCharacterDescription.trim();

  return [
    "## REFERENCE CHARACTER (STORYBOARD ATTACHMENT)",
    "",
    `This channel uses a recurring reference character: **${name}**.`,
    "",
    "A **storyboard image of this character will be attached** to the production flow when generating visuals (b-rolls, scene keyframes, image prompts). The script and any visual directions must stay consistent with that reference sheet.",
    "",
    `- **Character name:** ${name}`,
    description ? `- **Visual / role notes:** ${description}` : null,
    "- When this character appears in the script, describe actions, emotions, and context that match the attached storyboard — do not contradict the reference image.",
    "- Treat this character as the visual anchor across the video whenever the topic involves them.",
    "- In downstream image generation, the storyboard attachment provides the canonical look; the script supplies scene context only.",
  ]
    .filter(Boolean)
    .join("\n");
}
