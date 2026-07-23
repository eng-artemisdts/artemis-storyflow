import { createReadStream, existsSync, readdirSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import JSZip from "jszip";
import { getDataDir } from "@/lib/app-paths";
import { buildEditorStateFromAssets } from "@/lib/editor/build-editor-state";
import { parseEditorSettings } from "@/lib/editor/editor-settings";
import { computeImageMotion } from "@/lib/editor/image-motion";
import { ensureBrollsTimesInSeconds } from "@/lib/brolls/ensure-times";
import {
  localUploadAbsolutePath,
  localUploadExists,
} from "@/lib/local-uploads";
import { prisma } from "@/lib/prisma";
import type { EditorImageMotion } from "@/lib/schemas/editor";
import {
  parseProjectTranscription,
  slugifyForFilename,
  transcriptionDurationSec,
} from "@/lib/transcription";

const require = createRequire(import.meta.url);

const CAPCUT_NATIVE_INSTRUCTIONS = `# Draft CapCut — como abrir

Este ZIP contém um **rascunho nativo** do CapCut (JSON + mídia), pronto para
aparecer na lista de projetos do app.

## Extração (obrigatório)

1. Feche o CapCut por completo (não deixe em segundo plano).
2. Extraia a pasta do projeto **mantendo o nome da pasta** exatamente em:

   - **macOS:** \`~/Movies/CapCut/User Data/Projects/com.lveditor.draft/\`
   - **Windows:** \`%LocalAppData%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\\`

   Exemplo final no Mac:
   \`~/Movies/CapCut/User Data/Projects/com.lveditor.draft/storyflow-meu-projeto/\`

   Os caminhos das mídias dentro do JSON apontam para esse local. Se extrair
   em outro lugar, o CapCut não encontra os arquivos e o projeto não abre.

3. Abra o CapCut de novo (ou saia/entre de um rascunho) para atualizar a lista.
4. Abra o projeto gerado, ajuste se quiser e exporte o MP4 no CapCut.

## Conteúdo

- \`draft_info.json\` / \`template-2.tmp\` — timeline nativa (CapCut 9)
- \`Timelines/\` — estrutura de timelines do CapCut 9+
- \`draft_meta_info.json\` — metadados do rascunho
- \`assets/\` — cópia das mídias usadas pelo draft
- \`draft_cover.jpg\` — capa
- \`INSTRUCOES.md\` — este arquivo

> Use CapCut International (não JianYing CN). Versões JianYing 6+ criptografam
> drafts e podem rejeitar projetos gerados externamente.
`;

export type CapcutExportResult = {
  zipPath: string;
  fileName: string;
  draftName: string;
  token: string;
};

type CapcutTokenMeta = {
  projectId: string;
  zipPath: string;
  fileName: string;
  draftName: string;
  createdAt: string;
  expiresAt: string;
};

function extensionFromPath(filePath: string, fallback: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && ext.length <= 8) return ext;
  return fallback;
}

async function resolveLocalMediaPath(publicUrl: string): Promise<string> {
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    throw new Error(
      `Mídia remota não suportada no export CapCut: ${publicUrl}. Use arquivos em /uploads/.`
    );
  }
  if (!publicUrl.startsWith("/uploads/")) {
    throw new Error(`Caminho de mídia inválido: ${publicUrl}`);
  }
  if (!(await localUploadExists(publicUrl))) {
    throw new Error(`Arquivo de mídia não encontrado: ${publicUrl}`);
  }
  return localUploadAbsolutePath(publicUrl);
}

/**
 * Duração real do arquivo via ffprobe (mesma fonte que o capcut-cli usa).
 * Retorna null se ffprobe falhar — o caller cai no fallback (transcrição).
 */
async function probeMediaDurationSec(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let out = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const sec = Number.parseFloat(out.trim());
      resolve(Number.isFinite(sec) && sec > 0 ? sec : null);
    });
  });
}

/** Segundos para o spec CapCut sem ultrapassar a duração fonte (µs). */
function capcutAudioDurationSec(desiredSec: number, sourceSec: number | null): number {
  const desired = Math.max(0.05, desiredSec);
  if (sourceSec == null || !(sourceSec > 0)) {
    return Number(desired.toFixed(3));
  }
  // Floor em µs evita Math.round(toFixed(3)*1e6) > durationUs do arquivo.
  const maxUs = Math.floor(sourceSec * 1_000_000);
  const desiredUs = Math.min(Math.round(desired * 1_000_000), maxUs);
  return desiredUs / 1_000_000;
}

function clampVolume(value: number, fallback = 0.35): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/**
 * Garante volumes e clip:null nos segmentos de áudio após o compile.
 * CapCut corta áudios sobrepostos na mesma track — usamos tracks separadas
 * e reafirmamos o volume aqui (sync-timelines / rewrites não devem apagar).
 */
async function ensureDraftAudioVolumes(
  draftOut: string,
  opts: { narrationVolume: number; musicVolume: number | null }
): Promise<void> {
  const targets = ["draft_info.json", "draft_content.json", "template-2.tmp"];
  const dirs = [draftOut];
  const timelinesRoot = path.join(draftOut, "Timelines");
  if (existsSync(timelinesRoot)) {
    for (const entry of readdirSync(timelinesRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(path.join(timelinesRoot, entry.name));
    }
  }

  for (const dir of dirs) {
    for (const name of targets) {
      const abs = path.join(dir, name);
      if (!existsSync(abs)) continue;
      try {
        const draft = JSON.parse(await readFile(abs, "utf8")) as {
          tracks?: Array<{
            type?: string;
            name?: string;
            segments?: Array<Record<string, unknown>>;
          }>;
          materials?: {
            audios?: Array<{ id?: string; name?: string; path?: string }>;
          };
        };

        const audios = draft.materials?.audios ?? [];
        const materialById = new Map(
          audios.filter((a) => a.id).map((a) => [a.id!, a] as const)
        );

        for (const track of draft.tracks ?? []) {
          if (track.type !== "audio" || !Array.isArray(track.segments)) continue;
          const trackName = (track.name ?? "").toLowerCase();

          for (const seg of track.segments) {
            // Docs CapCut: clip em segmento de áudio pode crashar o app.
            seg.clip = null;

            const mat = materialById.get(String(seg.material_id ?? ""));
            const matHint = `${mat?.name ?? ""} ${mat?.path ?? ""}`.toLowerCase();
            const isMusic =
              trackName.includes("music") ||
              matHint.includes("music") ||
              matHint.includes("/music");

            if (isMusic && opts.musicVolume != null) {
              seg.volume = opts.musicVolume;
            } else if (
              trackName.includes("narration") ||
              matHint.includes("narration")
            ) {
              seg.volume = opts.narrationVolume;
            }
          }
        }

        await writeFile(abs, JSON.stringify(draft), "utf8");
      } catch (err) {
        console.warn(`[capcut-export] ensure audio volumes skipped for ${abs}:`, err);
      }
    }
  }
}

/**
 * Localiza o diretório do pacote capcut-cli.
 * Busca no filesystem primeiro: dentro do Next (Turbopack) o
 * `require.resolve` de código bundlado não é confiável.
 */
function resolveCapcutPackageDir(): string | null {
  const candidates: string[] = [
    path.join(process.cwd(), "node_modules", "capcut-cli"),
  ];

  // Fallback pnpm: procura no store local (symlink pode não existir no standalone).
  const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");
  if (existsSync(pnpmDir)) {
    try {
      const match = readdirSync(pnpmDir).find((name) =>
        name.startsWith("capcut-cli@")
      );
      if (match) {
        candidates.push(
          path.join(pnpmDir, match, "node_modules", "capcut-cli")
        );
      }
    } catch {
      /* ignore */
    }
  }

  try {
    candidates.push(path.dirname(require.resolve("capcut-cli/package.json")));
  } catch {
    /* ignore */
  }

  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, "package.json")) &&
      existsSync(path.join(candidate, "dist", "index.js"))
    ) {
      return candidate;
    }
  }
  return null;
}

function resolveDefaultCapcutDraftsRoot(): string {
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local");
    return path.join(local, "CapCut", "User Data", "Projects", "com.lveditor.draft");
  }
  // macOS (e fallback Linux): caminho padrão do CapCut International.
  return path.join(
    process.env.HOME || tmpdir(),
    "Movies",
    "CapCut",
    "User Data",
    "Projects",
    "com.lveditor.draft"
  );
}

/** Reescreve strings que apontam para o staging temp → pasta final do CapCut. */
function rewritePathStrings(value: unknown, fromPrefix: string, toPrefix: string): unknown {
  if (typeof value === "string") {
    if (value === fromPrefix || value.startsWith(fromPrefix + path.sep) || value.startsWith(fromPrefix + "/")) {
      return toPrefix + value.slice(fromPrefix.length);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewritePathStrings(item, fromPrefix, toPrefix));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewritePathStrings(v, fromPrefix, toPrefix);
    }
    return out;
  }
  return value;
}

async function rewriteDraftAbsolutePaths(
  draftOut: string,
  finalDraftDir: string
): Promise<void> {
  const fromPrefix = path.resolve(draftOut);
  const toPrefix = path.resolve(finalDraftDir);
  if (fromPrefix === toPrefix) return;

  const targets = [
    "draft_info.json",
    "draft_content.json",
    "template-2.tmp",
    "draft_meta_info.json",
  ];
  for (const name of targets) {
    const abs = path.join(draftOut, name);
    if (!existsSync(abs)) continue;
    try {
      const raw = await readFile(abs, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const rewritten = rewritePathStrings(parsed, fromPrefix, toPrefix);
      await writeFile(abs, JSON.stringify(rewritten), "utf8");
    } catch (err) {
      console.warn(`[capcut-export] path rewrite skipped for ${name}:`, err);
    }
  }
}

async function alignDraftToCapCut9(draftOut: string, prepared: PreparedProject): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const nowUs = Date.now() * 1000;

  // Capa: primeira cena já copiada pelo compile.
  const assetsVideo = path.join(draftOut, "assets", "video");
  let coverSrc: string | null = null;
  if (existsSync(assetsVideo)) {
    const files = (await readdir(assetsVideo)).filter((f) =>
      /\.(jpe?g|png|webp)$/i.test(f)
    );
    files.sort();
    if (files[0]) coverSrc = path.join(assetsVideo, files[0]);
  }
  if (coverSrc) {
    await copyFile(coverSrc, path.join(draftOut, "draft_cover.jpg")).catch(() => undefined);
  }

  // Platform / version: CapCut 9 no Mac do usuário.
  for (const name of ["draft_info.json", "draft_content.json", "template-2.tmp"]) {
    const abs = path.join(draftOut, name);
    if (!existsSync(abs)) continue;
    try {
      const draft = JSON.parse(await readFile(abs, "utf8")) as Record<string, unknown>;
      draft.platform = {
        os: process.platform === "win32" ? "windows" : "mac",
        os_version: process.platform === "darwin" ? "13.2" : "",
        app_id: 359289,
        app_version: "9.0.0",
        app_source: "cc",
        device_id: "",
        hard_disk_id: "",
        mac_address: "",
      };
      draft.last_modified_platform = draft.platform;
      draft.new_version = "177.0.0";
      draft.version = 360000;
      if (!draft.create_time) draft.create_time = 0;
      if (!draft.update_time) draft.update_time = 0;
      await writeFile(abs, JSON.stringify(draft), "utf8");
    } catch {
      /* ignore */
    }
  }

  // Sidecars mínimos presentes no CapCut 9.
  const draftId =
    (
      JSON.parse(
        await readFile(path.join(draftOut, "draft_info.json"), "utf8")
      ) as { id?: string }
    ).id || randomBytes(8).toString("hex");

  await writeFile(
    path.join(draftOut, "attachment_pc_common.json"),
    JSON.stringify({
      ai_packaging_infos: [],
      ai_packaging_report_info: {
        caption_id_list: [],
        commercial_material: "",
        material_source: "",
        method: "",
        page_from: "",
        style: "",
        task_id: "",
        text_style: "",
        tos_id: "",
        video_category: "",
      },
      broll: {
        ai_packaging_infos: [],
        ai_packaging_report_info: {
          caption_id_list: [],
          commercial_material: "",
          material_source: "",
          method: "",
          page_from: "",
          style: "",
          task_id: "",
          text_style: "",
          tos_id: "",
          video_category: "",
        },
      },
    }),
    "utf8"
  );
  await writeFile(
    path.join(draftOut, "draft_agency_config.json"),
    JSON.stringify({
      is_auto_agency_enabled: false,
      is_auto_agency_popup: false,
      is_single_agency_mode: false,
      marterials: null,
      use_converter: false,
      video_resolution: 720,
    }),
    "utf8"
  );
  await writeFile(path.join(draftOut, "draft_biz_config.json"), "", "utf8");
  await writeFile(
    path.join(draftOut, "performance_opt_info.json"),
    JSON.stringify({
      manual_cancle_precombine_segs: null,
      need_auto_precombine_segs: null,
    }),
    "utf8"
  );
  await writeFile(
    path.join(draftOut, "key_value.json"),
    JSON.stringify({
      k_ai_rough_cut_history: {
        did_show_replace_tip: false,
        duration_index: 0,
        entry_mode: 0,
        landing_mode: 1,
        promote: "",
        script_filename: "",
        script_vid: "",
        style_index: 0,
      },
    }),
    "utf8"
  );
  await writeFile(
    path.join(draftOut, "timeline_layout.json"),
    JSON.stringify({
      dockItems: [
        {
          dockIndex: 0,
          ratio: 1,
          timelineIds: [draftId],
          timelineNames: ["Linha do tempo 01"],
        },
      ],
      layoutOrientation: 1,
    }),
    "utf8"
  );
  await writeFile(
    path.join(draftOut, "draft_settings"),
    [
      "[General]",
      `draft_create_time=${nowSec}`,
      `draft_last_edit_time=${nowSec}`,
      "real_edit_keys=0",
      "real_edit_seconds=0",
      "",
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(draftOut, "draft_virtual_store.json"),
    JSON.stringify({ draft_digital_human_template_ids: [], digital_human_ids: [], digital_human_model_dressing_ids: [] }),
    "utf8"
  );

  for (const dir of [
    "Resources/audioAlg",
    "Resources/videoAlg",
    "adjust_mask",
    "common_attachment",
    "matting",
    "qr_upload",
    "smart_crop",
    "subdraft",
  ]) {
    await mkdir(path.join(draftOut, dir), { recursive: true });
  }

  // Estrutura Timelines do CapCut 9: project.json + pasta do id.
  const timelinesRoot = path.join(draftOut, "Timelines");
  const timelineDir = path.join(timelinesRoot, draftId);
  await mkdir(path.join(timelineDir, "common_attachment"), { recursive: true });
  await writeFile(
    path.join(timelinesRoot, "project.json"),
    JSON.stringify({
      config: {
        color_space: -1,
        mixed_track_mode_on: false,
        render_index_track_mode_on: false,
        use_float_render: false,
      },
      create_time: nowUs,
      id: draftId,
      main_timeline_id: draftId,
      timelines: [
        {
          create_time: nowUs,
          id: draftId,
          is_marked_delete: false,
          name: "Linha do tempo 01",
          update_time: nowUs,
        },
      ],
      update_time: nowUs,
      version: 0,
    }),
    "utf8"
  );
  for (const name of ["draft_info.json", "template-2.tmp", "attachment_pc_common.json"]) {
    const src = path.join(draftOut, name);
    if (existsSync(src)) {
      await copyFile(src, path.join(timelineDir, name)).catch(() => undefined);
    }
  }
  if (existsSync(path.join(draftOut, "draft_cover.jpg"))) {
    await copyFile(
      path.join(draftOut, "draft_cover.jpg"),
      path.join(timelineDir, "draft_cover.jpg")
    ).catch(() => undefined);
  }
  await writeFile(
    path.join(timelineDir, "common_attachment", "attachment_pc_timeline.json"),
    JSON.stringify({}),
    "utf8"
  );

  // Atualiza meta com capa e materiais.
  const metaPath = path.join(draftOut, "draft_meta_info.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8")) as Record<
        string,
        unknown
      >;
      meta.draft_cover = "draft_cover.jpg";
      meta.draft_id = draftId;
      meta.draft_name = path.basename(draftOut);
      meta.draft_new_version = "177.0.0";
      meta.tm_duration = Math.round(prepared.durationSec * 1_000_000);
      meta.tm_draft_modified = nowUs;
      // Lista de materiais no meta (CapCut 9 usa isso na UI).
      const info = JSON.parse(
        await readFile(path.join(draftOut, "draft_info.json"), "utf8")
      ) as {
        materials?: {
          videos?: Array<Record<string, unknown>>;
          audios?: Array<Record<string, unknown>>;
        };
      };
      const materialValues: Array<Record<string, unknown>> = [];
      for (const v of info.materials?.videos ?? []) {
        materialValues.push({
          create_time: nowSec,
          duration: v.duration ?? 5_000_000,
          extra_info: v.material_name ?? "",
          file_Path: v.path ?? "",
          height: v.height ?? 0,
          id: v.id,
          import_time: nowSec,
          import_time_ms: nowUs,
          item_source: 1,
          md5: "",
          metetype: "photo",
          type: 0,
          width: v.width ?? 0,
        });
      }
      for (const a of info.materials?.audios ?? []) {
        materialValues.push({
          create_time: nowSec,
          duration: a.duration ?? prepared.durationSec * 1_000_000,
          extra_info: a.name ?? a.material_name ?? "audio",
          file_Path: a.path ?? "",
          height: 0,
          id: a.id,
          import_time: nowSec,
          import_time_ms: nowUs,
          item_source: 1,
          md5: "",
          metetype: "music",
          type: 0,
          width: 0,
        });
      }
      meta.draft_materials = [{ type: 0, value: materialValues }];
      await writeFile(metaPath, JSON.stringify(meta), "utf8");
    } catch {
      /* ignore */
    }
  }
}

async function finalizeNativeDraft(
  draftOut: string,
  prepared: PreparedProject
): Promise<void> {
  const draftsRoot = resolveDefaultCapcutDraftsRoot();
  const finalDraftDir = path.join(draftsRoot, path.basename(draftOut));

  await rewriteDraftAbsolutePaths(draftOut, finalDraftDir);
  await alignDraftToCapCut9(draftOut, prepared);
  // CapCut 9 ainda espera template-2.tmp como espelho da timeline.
  const infoPath = path.join(draftOut, "draft_info.json");
  const contentPath = path.join(draftOut, "draft_content.json");
  const templatePath = path.join(draftOut, "template-2.tmp");
  if (existsSync(infoPath)) {
    // Mantém draft_content e template-2 alinhados ao draft_info (canônico pós-rewrite).
    await copyFile(infoPath, contentPath).catch(() => undefined);
    await copyFile(infoPath, templatePath).catch(() => undefined);
  }
  // Reescreve de novo após alinhar (Timelines copies e meta).
  await rewriteDraftAbsolutePaths(draftOut, finalDraftDir);

  // Espelha timeline files de novo após o rewrite final.
  if (existsSync(infoPath)) {
    try {
      const draft = JSON.parse(await readFile(infoPath, "utf8")) as { id?: string };
      const timelineDir = path.join(draftOut, "Timelines", draft.id || "");
      if (draft.id && existsSync(timelineDir)) {
        for (const name of [
          "draft_info.json",
          "template-2.tmp",
          "draft_content.json",
          "draft_cover.jpg",
          "attachment_pc_common.json",
        ]) {
          const src = path.join(draftOut, name);
          if (existsSync(src)) {
            await copyFile(src, path.join(timelineDir, name)).catch(() => undefined);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Garante meta.fold_path / root_path finais.
  const metaPath = path.join(draftOut, "draft_meta_info.json");
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8")) as Record<
        string,
        unknown
      >;
      meta.draft_fold_path = finalDraftDir;
      meta.draft_root_path = draftsRoot;
      await writeFile(metaPath, JSON.stringify(meta), "utf8");
    } catch {
      /* ignore */
    }
  }
}

function resolveCapcutBin(): string {
  const pkgDir = resolveCapcutPackageDir();
  if (pkgDir) {
    return path.join(pkgDir, "dist", "index.js");
  }
  const binCandidates = [
    path.join(process.cwd(), "node_modules", ".bin", "capcut"),
    path.join(process.cwd(), "node_modules", ".bin", "capcut-cli"),
  ];
  for (const candidate of binCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "capcut-cli não encontrado. Rode pnpm install (dependência capcut-cli)."
  );
}

function resolveCapcutTemplatesDir(): string {
  const pkgDir = resolveCapcutPackageDir();
  if (!pkgDir) {
    throw new Error(
      "capcut-cli não encontrado. Rode pnpm install (dependência capcut-cli)."
    );
  }
  const templates = path.join(pkgDir, "templates");
  if (!existsSync(path.join(templates, "_init"))) {
    throw new Error(
      `Templates do capcut-cli não encontrados em ${templates}. Reinstale com pnpm install.`
    );
  }
  return templates;
}

function runCapcut(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  const bin = resolveCapcutBin();
  const isJs = bin.endsWith(".js");
  return new Promise((resolve, reject) => {
    const child = spawn(isJs ? process.execPath : bin, isJs ? [bin, ...args] : args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `capcut ${args[0]} falhou (code ${code}): ${stderr.trim() || stdout.trim() || "sem saída"}`
        )
      );
    });
  });
}

function capcutExportsDir(): string {
  return path.join(getDataDir(), ".data", "exports", "capcut");
}

async function ensureExportsDir(): Promise<string> {
  const dir = capcutExportsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Remove ZIPs/tokens expirados (>2h) ou órfãos. */
export async function cleanupExpiredCapcutExports(): Promise<void> {
  const dir = await ensureExportsDir();
  const now = Date.now();
  const entries = await readdir(dir).catch(() => [] as string[]);
  for (const name of entries) {
    if (!name.endsWith(".json") && !name.endsWith(".zip")) continue;
    const abs = path.join(dir, name);
    try {
      if (name.endsWith(".json")) {
        const meta = JSON.parse(await readFile(abs, "utf8")) as CapcutTokenMeta;
        if (Date.parse(meta.expiresAt) < now) {
          await rm(meta.zipPath, { force: true }).catch(() => {});
          await rm(abs, { force: true }).catch(() => {});
        }
        continue;
      }
      const st = await stat(abs);
      if (now - st.mtimeMs > 2 * 60 * 60 * 1000) {
        await rm(abs, { force: true }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }
}

export async function resolveCapcutExportToken(
  token: string
): Promise<CapcutTokenMeta | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const metaPath = path.join(capcutExportsDir(), `${token}.json`);
  if (!existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as CapcutTokenMeta;
    if (Date.parse(meta.expiresAt) < Date.now()) {
      await rm(meta.zipPath, { force: true }).catch(() => {});
      await rm(metaPath, { force: true }).catch(() => {});
      return null;
    }
    if (!existsSync(meta.zipPath)) return null;
    return meta;
  } catch {
    return null;
  }
}

async function zipDirectoryWithSystemZip(
  sourceDir: string,
  zipPath: string,
  entries: string[]
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(
      "zip",
      [
        "-r",
        "-q",
        zipPath,
        ...entries,
        "-x",
        "*/.capcut-cli-history/*",
        "*.bak",
        "*/spec.json",
      ],
      { cwd: sourceDir, stdio: "ignore" }
    );
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function zipDirectoryWithJsZip(
  sourceDir: string,
  zipPath: string,
  rootEntries: string[]
): Promise<void> {
  const zip = new JSZip();

  async function addDir(absDir: string, zipPrefix: string) {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".capcut-cli-history" || entry.name.endsWith(".bak")) {
        continue;
      }
      const abs = path.join(absDir, entry.name);
      const zipEntry = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await addDir(abs, zipEntry);
      } else if (entry.isFile()) {
        zip.file(zipEntry, await readFile(abs));
      }
    }
  }

  for (const entry of rootEntries) {
    const abs = path.join(sourceDir, entry);
    const st = await stat(abs);
    if (st.isDirectory()) await addDir(abs, entry);
    else if (st.isFile()) zip.file(entry, await readFile(abs));
  }

  const tmp = `${zipPath}.partial`;
  await pipeline(
    zip.generateNodeStream({
      type: "nodebuffer",
      streamFiles: true,
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }) as NodeJS.ReadableStream,
    createWriteStream(tmp)
  );
  await rename(tmp, zipPath);
}

async function createZipFromStaging(
  stagingParent: string,
  entries: string[],
  zipPath: string
): Promise<void> {
  const ok = await zipDirectoryWithSystemZip(stagingParent, zipPath, entries);
  if (ok && existsSync(zipPath)) return;
  await zipDirectoryWithJsZip(stagingParent, zipPath, entries);
}

type PreparedProject = {
  draftName: string;
  slug: string;
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  durationSec: number;
  /** Duração real do MP3 de narração (ffprobe); null se indisponível. */
  narrationSourceDurationSec: number | null;
  /** Duração real da música de fundo, se houver. */
  musicSourceDurationSec: number | null;
  imageClips: Array<{
    src: string;
    startSec: number;
    durationSec: number;
    label?: string;
  }>;
  audioUrl: string;
  musicUrl: string | null;
  musicVolume: number;
  transition: string;
  transitionMs: number;
  imageMotion: EditorImageMotion;
  imageMotionIntensity: number;
};

async function loadPreparedProject(projectId: string): Promise<PreparedProject> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      videoKind: true,
      audioUrl: true,
      videoAspectRatio: true,
      transcriptionJson: true,
      editorJson: true,
    },
  });
  if (!project) throw new Error("Projeto não encontrado");
  if (project.videoKind !== "static") {
    throw new Error("Export CapCut disponível apenas para vídeos static");
  }
  if (!project.audioUrl) throw new Error("Narração ausente");

  const brolls = await ensureBrollsTimesInSeconds(project.id);
  const transcription = parseProjectTranscription(project.transcriptionJson);
  const settings = parseEditorSettings(project.editorJson);

  const narrationAbs = await resolveLocalMediaPath(project.audioUrl);
  const narrationSourceDurationSec = await probeMediaDurationSec(narrationAbs);

  let musicSourceDurationSec: number | null = null;
  if (settings.musicUrl) {
    try {
      const musicAbs = await resolveLocalMediaPath(settings.musicUrl);
      musicSourceDurationSec = await probeMediaDurationSec(musicAbs);
    } catch {
      musicSourceDurationSec = null;
    }
  }

  const editorState = buildEditorStateFromAssets({
    brolls,
    audioUrl: project.audioUrl,
    // Narração manda: não estender timeline além do MP3 (capcut-cli rejeita).
    audioDurationSec: narrationSourceDurationSec,
    transcriptionDurationSec: transcriptionDurationSec(transcription),
    aspectRatio: project.videoAspectRatio,
  });

  const imageClips = (editorState.tracks.find((t) => t.id === "brolls")?.clips ?? [])
    .filter((c) => c.type === "image" && c.src)
    .map((c) => ({
      src: c.src,
      startSec: c.startSec,
      durationSec: c.durationSec,
      label: c.label,
    }));

  if (!imageClips.length) {
    throw new Error("Nenhuma imagem de cena para exportar");
  }

  const draftName =
    project.name.trim() || `Storyflow ${project.id.slice(0, 8)}`;

  return {
    draftName,
    slug: slugifyForFilename(draftName),
    width: editorState.width,
    height: editorState.height,
    fps: editorState.fps,
    aspectRatio: editorState.aspectRatio,
    durationSec: editorState.durationSec,
    narrationSourceDurationSec,
    musicSourceDurationSec,
    imageClips,
    audioUrl: project.audioUrl,
    musicUrl: settings.musicUrl ?? null,
    musicVolume: clampVolume(settings.musicVolume ?? 0.35),
    transition: settings.transition ?? "crossfade",
    transitionMs: settings.transitionMs ?? 350,
    imageMotion: settings.imageMotion ?? "ken-burns",
    imageMotionIntensity: settings.imageMotionIntensity ?? 1,
  };
}

/**
 * Keyframes CapCut usam time_offset relativo ao início do segmento (não ao
 * timeline). Converte o motion do editor (%, scale) para position/scale CapCut.
 */
function appendImageMotionKeyframes(
  operations: Array<Record<string, unknown>>,
  target: string,
  durationSec: number,
  motion: EditorImageMotion,
  clipIndex: number,
  intensity: number
): void {
  if (motion === "none") return;

  const from = computeImageMotion(0, motion, clipIndex, intensity);
  const to = computeImageMotion(1, motion, clipIndex, intensity);
  const duration = Math.max(0.05, durationSec);

  // CSS translate% → CapCut position normalizado (-1..1); Y positivo = baixo (igual CSS).
  const channels: Array<{
    property: "scale_x" | "scale_y" | "position_x" | "position_y";
    from: number;
    to: number;
  }> = [
    { property: "scale_x", from: from.scale, to: to.scale },
    { property: "scale_y", from: from.scale, to: to.scale },
    {
      property: "position_x",
      from: from.translateX / 100,
      to: to.translateX / 100,
    },
    {
      property: "position_y",
      from: from.translateY / 100,
      to: to.translateY / 100,
    },
  ];

  for (const channel of channels) {
    const isScale = channel.property === "scale_x" || channel.property === "scale_y";
    const isIdentity = isScale
      ? Math.abs(channel.from - 1) < 1e-4 && Math.abs(channel.to - 1) < 1e-4
      : Math.abs(channel.from) < 1e-4 && Math.abs(channel.to) < 1e-4;
    if (isIdentity) continue;

    operations.push(
      {
        op: "keyframe",
        target,
        property: channel.property,
        time: 0,
        value: Number(channel.from.toFixed(6)),
      },
      {
        op: "keyframe",
        target,
        property: channel.property,
        time: duration,
        value: Number(channel.to.toFixed(6)),
        easing: "ease-in-out",
      }
    );
  }
}

function mapTransitionSlug(transition: string): string | null {
  switch (transition) {
    case "crossfade":
      return "dissolve";
    case "fade-black":
      return "black-fade";
    case "fade-white":
      return "white-flash";
    case "slide-left":
    case "slide-right":
    case "slide-up":
      return "slide";
    case "zoom":
      return "twinkle-zoom";
    case "wipe":
      return "wipe-left";
    case "cut":
    default:
      return null;
  }
}

async function buildNativeDraftFolder(
  prepared: PreparedProject,
  stagingRoot: string
): Promise<string> {
  const mediaDir = path.join(stagingRoot, "media");
  await mkdir(mediaDir, { recursive: true });

  const videoItems: Array<Record<string, unknown>> = [];
  for (let i = 0; i < prepared.imageClips.length; i++) {
    const clip = prepared.imageClips[i]!;
    const srcAbs = await resolveLocalMediaPath(clip.src);
    const ext = extensionFromPath(srcAbs, ".jpg");
    const fileName = `${String(i + 1).padStart(3, "0")}${ext}`;
    await copyFile(srcAbs, path.join(mediaDir, fileName));
    const ref = `scene_${i + 1}`;
    videoItems.push({
      ref,
      path: `media/${fileName}`,
      start: Number(clip.startSec.toFixed(3)),
      duration: Number(Math.max(0.05, clip.durationSec).toFixed(3)),
      type: "photo",
    });
  }

  const narrationAbs = await resolveLocalMediaPath(prepared.audioUrl);
  const narrationFile = `narration${extensionFromPath(narrationAbs, ".mp3")}`;
  await copyFile(narrationAbs, path.join(mediaDir, narrationFile));

  const narrationItem = {
    ref: "narration",
    path: `media/${narrationFile}`,
    start: 0,
    duration: capcutAudioDurationSec(
      prepared.durationSec,
      prepared.narrationSourceDurationSec
    ),
    volume: 1,
  };

  // Tracks de áudio separadas: na mesma faixa o CapCut corta segmentos sobrepostos
  // e a música de fundo some sob a narração.
  const tracks: Array<Record<string, unknown>> = [
    { type: "video", name: "scenes", items: videoItems },
    { type: "audio", name: "narration", items: [narrationItem] },
  ];

  let musicVolume: number | null = null;
  if (prepared.musicUrl) {
    const musicAbs = await resolveLocalMediaPath(prepared.musicUrl);
    const musicFile = `music${extensionFromPath(musicAbs, ".mp3")}`;
    await copyFile(musicAbs, path.join(mediaDir, musicFile));
    musicVolume = clampVolume(prepared.musicVolume);
    tracks.push({
      type: "audio",
      name: "music",
      items: [
        {
          ref: "music",
          path: `media/${musicFile}`,
          start: 0,
          duration: capcutAudioDurationSec(
            prepared.durationSec,
            prepared.musicSourceDurationSec
          ),
          volume: musicVolume,
        },
      ],
    });
  }

  const operations: Array<Record<string, unknown>> = [];
  const transitionSlug = mapTransitionSlug(prepared.transition);
  if (transitionSlug && prepared.transitionMs > 0) {
    const durationSec = Math.max(0.1, prepared.transitionMs / 1000);
    for (let i = 0; i < videoItems.length - 1; i++) {
      operations.push({
        op: "transition",
        target: `scene_${i + 1}`,
        slug: transitionSlug,
        duration: durationSec,
      });
    }
  }

  // Motion das imagens (Ken Burns, zoom, drift, random) — tempos relativos ao clipe.
  for (let i = 0; i < videoItems.length; i++) {
    const item = videoItems[i]!;
    appendImageMotionKeyframes(
      operations,
      `scene_${i + 1}`,
      Number(item.duration),
      prepared.imageMotion,
      i,
      prepared.imageMotionIntensity
    );
  }

  const specBase = {
    name: prepared.draftName,
    width: prepared.width,
    height: prepared.height,
    fps: prepared.fps,
    ratio: prepared.aspectRatio,
    tracks,
  };

  const draftsParent = path.join(stagingRoot, "drafts");
  await mkdir(draftsParent, { recursive: true });
  const draftFolderName = (
    `storyflow-${prepared.slug}`.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") ||
    `storyflow-${Date.now()}`
  ).slice(0, 80);
  const draftOut = path.join(draftsParent, draftFolderName);

  void resolveCapcutTemplatesDir();

  const tryCompile = async (operations: Array<Record<string, unknown>>) => {
    const specPath = path.join(stagingRoot, "spec.json");
    await writeFile(
      specPath,
      JSON.stringify({ ...specBase, operations }, null, 2),
      "utf8"
    );
    // Remove draft anterior se existir (retry).
    await rm(draftOut, { recursive: true, force: true }).catch(() => {});
    await runCapcut(["compile", specPath, "--out", draftOut], stagingRoot);
  };

  try {
    await tryCompile(operations);
  } catch (err) {
    // Transições/keyframes inválidos: recompila somente com mídia e áudio.
    console.warn(
      "[capcut-export] compile with effects failed, retrying minimal:",
      err instanceof Error ? err.message : err
    );
    await tryCompile([]);
  }

  await runCapcut(["lint", draftOut], stagingRoot).catch(() => undefined);
  await runCapcut(["sync-timelines", "--apply", draftOut], stagingRoot).catch(
    () => undefined
  );
  await runCapcut(["register", "--apply", draftOut], draftsParent).catch(
    () => undefined
  );

  // CapCut 9 grava paths absolutos. Sem reescrever, o ZIP aponta para /tmp e não abre.
  await finalizeNativeDraft(draftOut, prepared);
  await ensureDraftAudioVolumes(draftOut, {
    narrationVolume: 1,
    musicVolume,
  });

  await writeFile(
    path.join(draftOut, "INSTRUCOES.md"),
    CAPCUT_NATIVE_INSTRUCTIONS,
    "utf8"
  );

  return draftOut;
}

/**
 * Gera exclusivamente um ZIP com draft nativo do CapCut.
 * Persiste o arquivo em disco e devolve token para download streaming.
 */
export async function buildCapcutExport(
  projectId: string
): Promise<CapcutExportResult> {
  await cleanupExpiredCapcutExports();
  const prepared = await loadPreparedProject(projectId);
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "storyflow-capcut-"));
  const exportsDir = await ensureExportsDir();
  const token = randomBytes(16).toString("hex");
  const zipPath = path.join(exportsDir, `${token}.zip`);

  try {
    const folderToZip = await buildNativeDraftFolder(prepared, stagingRoot);
    const folderName = path.basename(folderToZip);
    const parent = path.dirname(folderToZip);
    const fileName = `${prepared.slug}-capcut-draft.zip`;

    await createZipFromStaging(parent, [folderName], zipPath);

    const meta: CapcutTokenMeta = {
      projectId,
      zipPath,
      fileName,
      draftName: prepared.draftName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
    await writeFile(
      path.join(exportsDir, `${token}.json`),
      JSON.stringify(meta, null, 2),
      "utf8"
    );

    return {
      zipPath,
      fileName,
      draftName: prepared.draftName,
      token,
    };
  } catch (err) {
    await rm(zipPath, { force: true }).catch(() => {});
    throw err;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
  }
}

/** Compat: gera e devolve buffer (uso legado / testes pequenos). */
export async function buildCapcutDraftZip(
  projectId: string,
  _origin?: string
): Promise<{ buffer: Buffer; fileName: string; draftName: string }> {
  const result = await buildCapcutExport(projectId);
  const buffer = await readFile(result.zipPath);
  return {
    buffer,
    fileName: result.fileName,
    draftName: result.draftName,
  };
}

export function openCapcutZipStream(zipPath: string) {
  return createReadStream(zipPath);
}

export function capcutZipEtag(zipPath: string, fileName: string): string {
  return `"${createHash("sha1").update(`${zipPath}:${fileName}`).digest("hex")}"`;
}
