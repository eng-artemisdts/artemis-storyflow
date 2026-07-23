/**
 * Prepara o build standalone do Next para o Electron:
 * - next build com STORYFLOW_DESKTOP=1
 * - copia public + static para dentro do standalone
 * - embute binário Node + dependências do export CapCut
 * - gera DB SQLite migrado (seed)
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

function run(cmd, args, env = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  // dereference: pnpm usa symlinks; o standalone precisa dos arquivos reais.
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

function copyPkg(name) {
  const src = path.join(root, "node_modules", name);
  if (!fs.existsSync(src)) {
    console.warn(`[desktop:prepare] skip missing package: ${name}`);
    return;
  }
  const dest = path.join(standalone, "node_modules", name);
  copyDir(src, dest);
}

console.log("[desktop:prepare] building Next standalone…");
run("pnpm", ["exec", "next", "build"], { STORYFLOW_DESKTOP: "1" });

if (!fs.existsSync(standalone)) {
  console.error("standalone não gerado — verifique next.config output");
  process.exit(1);
}

console.log("[desktop:prepare] copying static + public…");
copyDir(staticSrc, path.join(standalone, ".next", "static"));
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, path.join(standalone, "public"));
}

fs.mkdirSync(path.join(standalone, "public", "uploads"), { recursive: true });

console.log("[desktop:prepare] copying prisma + scripts…");
copyDir(path.join(root, "prisma"), path.join(standalone, "prisma"));
copyDir(path.join(root, "scripts"), path.join(standalone, "scripts"));

// Dependências necessárias para o export CapCut fora do trace do Next.
const extraPkgs = [
  "capcut-cli",
  "jszip",
];
for (const pkg of extraPkgs) {
  copyPkg(pkg);
}

// Binário Node do host — evita ABI do Electron.
const nodeName = process.platform === "win32" ? "node.exe" : "node";
const binDir = path.join(standalone, "bin");
fs.mkdirSync(binDir, { recursive: true });
const nodeSrc = process.execPath;
const nodeDest = path.join(binDir, nodeName);
console.log("[desktop:prepare] bundling Node →", nodeDest);
fs.copyFileSync(nodeSrc, nodeDest);
if (process.platform !== "win32") {
  fs.chmodSync(nodeDest, 0o755);
}

// DB seed migrado (vazio de dados, schema ok).
const seedDb = path.join(standalone, "prisma", "app.db");
const seedUrl = `file:${seedDb}`;
console.log("[desktop:prepare] creating seed database…");
if (fs.existsSync(seedDb)) fs.unlinkSync(seedDb);
run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  DATABASE_URL: seedUrl,
});

console.log("[desktop:prepare] ok →", standalone);
