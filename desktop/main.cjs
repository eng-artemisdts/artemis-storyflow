/**
 * Processo principal Electron — sobe o Next.js local e abre a janela.
 *
 * Dev:  STORYFLOW_ELECTRON_URL=http://127.0.0.1:3000 (next dev à parte)
 * Prod: spawna `node server.js` do build standalone (Node embutido).
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const isDev = !app.isPackaged;
let mainWindow = null;
let nextProcess = null;
let appOrigin = null;

function dataDir() {
  return app.getPath("userData");
}

function ensureDataDirs() {
  const root = dataDir();
  for (const sub of ["uploads", "prisma", ".data/exports"]) {
    fs.mkdirSync(path.join(root, sub), { recursive: true });
  }
  return root;
}

/** Persistência de ENCRYPTION_KEY em userData (BYOK). */
function ensureEncryptionKey(userData) {
  const keyPath = path.join(userData, "encryption.key");
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf8").trim();
  }
  const key = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3000;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(url);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout aguardando Next.js em ${url}`));
          return;
        }
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function resolveStandaloneServer() {
  const candidates = [
    path.join(process.resourcesPath, "standalone", "server.js"),
    path.join(process.resourcesPath, "app", "standalone", "server.js"),
    path.join(app.getAppPath(), ".next", "standalone", "server.js"),
    path.join(process.cwd(), ".next", "standalone", "server.js"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/** Node real (não o binário Electron) — bundled no prepare-standalone. */
function resolveNodeBinary(standaloneDir) {
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  if (standaloneDir) {
    const bundled = path.join(standaloneDir, "bin", nodeName);
    if (fs.existsSync(bundled)) return bundled;
  }
  if (process.env.npm_node_execpath && fs.existsSync(process.env.npm_node_execpath)) {
    return process.env.npm_node_execpath;
  }
  return "node";
}

function seedDatabaseIfNeeded(userData) {
  const targetDb = path.join(userData, "prisma", "app.db");
  if (fs.existsSync(targetDb) && fs.statSync(targetDb).size > 0) {
    return targetDb;
  }

  const seedCandidates = [
    path.join(process.resourcesPath, "prisma", "app.db"),
    path.join(process.resourcesPath, "standalone", "prisma", "app.db"),
    path.join(process.resourcesPath, "prisma", "dev.db"),
    path.join(process.cwd(), "prisma", "dev.db"),
    path.join(process.cwd(), ".next", "standalone", "prisma", "app.db"),
  ];
  const seed = seedCandidates.find((p) => fs.existsSync(p) && fs.statSync(p).size > 0);
  if (seed) {
    fs.copyFileSync(seed, targetDb);
  }
  return targetDb;
}

async function startNextServer() {
  const userData = ensureDataDirs();
  const dbFile = seedDatabaseIfNeeded(userData);
  const encryptionKey = ensureEncryptionKey(userData);
  const port = await findFreePort();
  const origin = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    STORYFLOW_DESKTOP: "1",
    STORYFLOW_DATA_DIR: userData,
    DATABASE_URL: `file:${dbFile}`,
    ENCRYPTION_KEY: encryptionKey,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NEXT_PUBLIC_APP_URL: origin,
    NODE_ENV: isDev ? "development" : "production",
  };

  if (isDev && process.env.STORYFLOW_ELECTRON_URL) {
    appOrigin = process.env.STORYFLOW_ELECTRON_URL.replace(/\/$/, "");
    await waitForServer(appOrigin);
    return appOrigin;
  }

  if (isDev) {
    const preferred = process.env.STORYFLOW_ELECTRON_URL || "http://127.0.0.1:3000";
    try {
      await waitForServer(preferred, 3_000);
      appOrigin = preferred.replace(/\/$/, "");
      return appOrigin;
    } catch {
      /* sobe next dev */
    }

    const nextBin = path.join(
      process.cwd(),
      "node_modules",
      "next",
      "dist",
      "bin",
      "next"
    );
    const nodeBin = resolveNodeBinary(null);
    nextProcess = spawn(nodeBin, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    });
  } else {
    const serverJs = resolveStandaloneServer();
    if (!serverJs) {
      throw new Error(
        "Build standalone não encontrado. Rode pnpm desktop:build antes."
      );
    }
    const standaloneDir = path.dirname(serverJs);
    const nodeBin = resolveNodeBinary(standaloneDir);
    nextProcess = spawn(nodeBin, [serverJs], {
      cwd: standaloneDir,
      env,
      stdio: "inherit",
    });
  }

  nextProcess.on("exit", (code, signal) => {
    console.error("[desktop] Next.js encerrou", { code, signal });
  });

  appOrigin = origin;
  await waitForServer(origin);
  return origin;
}

function createWindow(origin) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "StoryFlow",
    backgroundColor: "#0a0a0a",
    scrollBounce: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(origin);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Garante scroll nativo mesmo se algum overlay de dev permanecer.
  mainWindow.webContents.on("dom-ready", () => {
    mainWindow?.webContents
      .insertCSS(
        `html, body { overflow-y: auto !important; } html { height: 100%; }`
      )
      .catch(() => {});
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function shutdownNext() {
  if (!nextProcess || nextProcess.killed) return;
  try {
    nextProcess.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  nextProcess = null;
}

app.whenReady().then(async () => {
  try {
    const origin = await startNextServer();
    createWindow(origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox("StoryFlow — falha ao iniciar", message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && appOrigin) {
      createWindow(appOrigin);
    }
  });
});

app.on("window-all-closed", () => {
  shutdownNext();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  shutdownNext();
});
