const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

// ============================================================
//  PLUGTECH CalcStudio Pro — arranque desktop (Electron)
//  Em vez de carregar ficheiros via file:// (que parte as rotas
//  do TanStack Start e mostra ecrã em branco), arrancamos o
//  servidor de produção do TanStack em background e carregamos
//  http://localhost:3000.
// ============================================================

const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

let serverProcess = null;
let mainWindow = null;

// Caminho do servidor de produção gerado pelo build (Nitro/TanStack Start).
// Em produção empacotada fica dentro de resources/.output; em dev usa a raiz do projeto.
function resolveServerEntry() {
  const candidates = [
    path.join(process.resourcesPath || "", ".output", "server", "index.mjs"),
    path.join(__dirname, "..", ".output", "server", "index.mjs"),
  ];
  return candidates.find((p) => {
    try {
      return require("fs").existsSync(p);
    } catch {
      return false;
    }
  }) || candidates[candidates.length - 1];
}

function startServer() {
  const entry = resolveServerEntry();
  // Reutiliza o runtime de Node embutido no Electron (ELECTRON_RUN_AS_NODE),
  // por isso o PC de destino NÃO precisa de ter o Node.js instalado.
  serverProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  serverProcess.on("error", (err) => {
    console.error("Falha ao iniciar o servidor interno:", err);
  });
}

// Aguarda que o servidor responda (com timeout de segurança de ~10s).
function waitForServer(retries = 50) {
  return new Promise((resolve) => {
    const tryOnce = (left) => {
      const req = http.get(SERVER_URL, () => resolve(true));
      req.on("error", () => {
        if (left <= 0) return resolve(false);
        setTimeout(() => tryOnce(left - 1), 200);
      });
    };
    tryOnce(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "PLUGTECH CalcStudio Pro",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadURL(SERVER_URL);
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(async () => {
  startServer();
  // Espera o servidor arrancar; caso já esteja a responder, segue de imediato.
  // Garante pelo menos ~3s de margem antes de carregar o URL.
  await Promise.all([
    waitForServer(),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
    } catch {
      /* noop */
    }
    serverProcess = null;
  }
}

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopServer);
process.on("exit", stopServer);
