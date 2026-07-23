/**
 * Exporta o banco atual para prisma/seed-data.json.
 * Rode: pnpm db:export-seed
 *
 * Jobs de geração (GenerationJob) são omitidos — são efêmeros.
 * Arquivos em public/uploads/ não entram no JSON; copie-os à parte se
 * quiser áudio/imagens no outro PC.
 */
import fs from "node:fs";
import path from "node:path";
import { createSeedPrisma } from "./seed-client";

async function main() {
  const prisma = createSeedPrisma();
  try {
    const [channels, customStyles, projects, characters, scenarios, scenes, whiteboards] =
      await Promise.all([
        prisma.channel.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.customStyle.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.character.findMany({ orderBy: { id: "asc" } }),
        prisma.scenario.findMany({ orderBy: { id: "asc" } }),
        prisma.scene.findMany({ orderBy: [{ projectId: "asc" }, { order: "asc" }] }),
        prisma.whiteboard.findMany({ orderBy: { id: "asc" } }),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      channels,
      customStyles,
      projects,
      characters,
      scenarios,
      scenes,
      whiteboards,
    };

    const out = path.join(process.cwd(), "prisma", "seed-data.json");
    fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Seed exportado → ${out}`);
    console.log(
      [
        `  channels: ${channels.length}`,
        `  customStyles: ${customStyles.length}`,
        `  projects: ${projects.length}`,
        `  characters: ${characters.length}`,
        `  scenarios: ${scenarios.length}`,
        `  scenes: ${scenes.length}`,
        `  whiteboards: ${whiteboards.length}`,
      ].join("\n")
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
