/**
 * Popula o banco a partir de prisma/seed-data.json (snapshot deste ambiente).
 *
 * Uso no outro PC:
 *   pnpm prisma migrate dev
 *   pnpm db:seed
 *
 * Aviso: apaga canais, projetos, estilos etc. existentes e reinsere o snapshot.
 * GenerationJob não é seedado. Mídia em public/uploads/ precisa ser copiada
 * separadamente se quiser áudio/imagens funcionando.
 */
import fs from "node:fs";
import path from "node:path";
import { createSeedPrisma } from "./seed-client";

type SeedPayload = {
  exportedAt?: string;
  channels: Array<Record<string, unknown>>;
  customStyles: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  characters: Array<Record<string, unknown>>;
  scenarios: Array<Record<string, unknown>>;
  scenes: Array<Record<string, unknown>>;
  whiteboards: Array<Record<string, unknown>>;
};

function asDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function withDates<T extends Record<string, unknown>>(
  row: T,
  keys: string[] = ["createdAt", "updatedAt"]
): T {
  const next = { ...row };
  for (const key of keys) {
    if (key in next) {
      const d = asDate(next[key]);
      if (d) (next as Record<string, unknown>)[key] = d;
    }
  }
  return next;
}

async function main() {
  const dataPath = path.join(process.cwd(), "prisma", "seed-data.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `Arquivo não encontrado: ${dataPath}\nGere com: pnpm db:export-seed`
    );
  }

  const payload = JSON.parse(fs.readFileSync(dataPath, "utf8")) as SeedPayload;
  const prisma = createSeedPrisma();

  try {
    console.log(
      `Importando seed${payload.exportedAt ? ` (exportado em ${payload.exportedAt})` : ""}…`
    );

    // Ordem: filhos → pais (respeita FKs com onDelete Cascade também).
    await prisma.generationJob.deleteMany();
    await prisma.whiteboard.deleteMany();
    await prisma.scene.deleteMany();
    await prisma.character.deleteMany();
    await prisma.scenario.deleteMany();
    await prisma.project.deleteMany();
    await prisma.customStyle.deleteMany();
    await prisma.channel.deleteMany();

    if (payload.channels.length) {
      await prisma.channel.createMany({
        data: payload.channels.map((c) => withDates(c)) as never,
      });
    }
    if (payload.customStyles.length) {
      await prisma.customStyle.createMany({
        data: payload.customStyles.map((s) => withDates(s)) as never,
      });
    }
    if (payload.projects.length) {
      await prisma.project.createMany({
        data: payload.projects.map((p) => withDates(p)) as never,
      });
    }
    if (payload.characters.length) {
      await prisma.character.createMany({
        data: payload.characters as never,
      });
    }
    if (payload.scenarios.length) {
      await prisma.scenario.createMany({
        data: payload.scenarios as never,
      });
    }
    if (payload.scenes.length) {
      await prisma.scene.createMany({
        data: payload.scenes as never,
      });
    }
    if (payload.whiteboards.length) {
      await prisma.whiteboard.createMany({
        data: payload.whiteboards as never,
      });
    }

    console.log("Seed concluído:");
    console.log(
      [
        `  channels: ${payload.channels.length}`,
        `  customStyles: ${payload.customStyles.length}`,
        `  projects: ${payload.projects.length}`,
        `  characters: ${payload.characters.length}`,
        `  scenarios: ${payload.scenarios.length}`,
        `  scenes: ${payload.scenes.length}`,
        `  whiteboards: ${payload.whiteboards.length}`,
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
