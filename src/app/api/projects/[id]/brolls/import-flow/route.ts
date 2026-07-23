import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBrollIdFromFilename } from "@/lib/brolls/google-flow";
import { parseProjectBrolls } from "@/lib/schemas/brolls";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Limite por requisição — o cliente envia em lotes; evita o upload único de 5+ min. */
const MAX_FILES_PER_REQUEST = 12;
const WRITE_CONCURRENCY = 4;

function extForImage(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".webp")) return ".webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return ".jpg";
  if (name.endsWith(".gif")) return ".gif";
  if (file.type.includes("webp")) return ".webp";
  if (file.type.includes("jpeg") || file.type.includes("jpg")) return ".jpg";
  if (file.type.includes("gif")) return ".gif";
  return ".png";
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, videoKind: true, brollsJson: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Projeto não encontrado" }, { status: 404 });
    }
    if (project.videoKind !== "static") {
      return NextResponse.json(
        { ok: false, error: "Importação disponível apenas para vídeos static" },
        { status: 400 }
      );
    }

    const data = parseProjectBrolls(project.brollsJson);
    if (!data?.brolls.length) {
      return NextResponse.json(
        { ok: false, error: "Gere as cenas antes de importar imagens" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const entries = formData.getAll("files");
    const files = entries.filter((f): f is File => f instanceof File && f.size > 0);

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nenhuma imagem recebida" },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          ok: false,
          error: `Máximo de ${MAX_FILES_PER_REQUEST} arquivos por requisição. Envie em lotes.`,
        },
        { status: 413 }
      );
    }

    const knownIds = new Set(data.brolls.map((b) => b.id));
    const skipped: Array<{ name: string; reason: string }> = [];
    const brollIdFields = formData.getAll("brollIds");
    const explicitIds = brollIdFields.map((v) => Number(v));

    type Pending = { file: File; brollId: number };
    const pending: Pending[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      if (file.size > MAX_FILE_BYTES) {
        skipped.push({ name: file.name, reason: "Arquivo muito grande (máx. 25 MB)" });
        continue;
      }

      let brollId: number | null = null;
      const explicit = explicitIds[i];
      if (Number.isFinite(explicit) && explicit > 0) {
        brollId = explicit;
      } else {
        brollId = parseBrollIdFromFilename(file.name);
      }

      if (brollId == null) {
        skipped.push({
          name: file.name,
          reason: "Nome não contém ID da cena (ex.: 3.png)",
        });
        continue;
      }
      if (!knownIds.has(brollId)) {
        skipped.push({
          name: file.name,
          reason: `Cena #${brollId} não existe neste projeto`,
        });
        continue;
      }
      pending.push({ file, brollId });
    }

    const urlById = new Map<number, string>();
    const writeResults = await mapPool(pending, WRITE_CONCURRENCY, async ({ file, brollId }) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const imageUrl = await storage.saveBuffer(
        buffer,
        `broll-${projectId}-${brollId}`,
        extForImage(file)
      );
      return { id: brollId, imageUrl };
    });

    for (const row of writeResults) {
      urlById.set(row.id, row.imageUrl);
    }

    const imported = [...urlById.entries()]
      .map(([id, imageUrl]) => ({ id, imageUrl }))
      .sort((a, b) => a.id - b.id);

    if (imported.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Nenhuma imagem pôde ser associada. Verifique os nomes dos arquivos.",
        data: { imported: [], skipped },
      });
    }

    // Relê antes de gravar para não sobrescrever lotes anteriores.
    const fresh = await prisma.project.findUnique({
      where: { id: project.id },
      select: { brollsJson: true },
    });
    const latest = parseProjectBrolls(fresh?.brollsJson) ?? data;
    const nextBrolls = latest.brolls.map((b) =>
      urlById.has(b.id) ? { ...b, imageUrl: urlById.get(b.id)! } : b
    );

    await prisma.project.update({
      where: { id: project.id },
      data: { brollsJson: JSON.stringify({ ...latest, brolls: nextBrolls }) },
    });

    revalidatePath(`/projects/${project.id}`, "layout");
    revalidatePath(`/projects/${project.id}/static/scenes`);

    return NextResponse.json({
      ok: true,
      data: {
        imported,
        skipped,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
