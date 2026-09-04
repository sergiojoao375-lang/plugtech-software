const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// ============================================================
//  PLUGTECH CalcStudio Pro — arranque desktop (Electron)
//  100% OFFLINE: carrega o build estático (dist-electron) via
//  file://, sem servidor interno e sem qualquer acesso à rede.
//  Todos os dados ficam em localStorage, na máquina do utilizador.
// ============================================================

let mainWindow = null;

function resolveIndexHtml() {
  const candidates = [
    path.join(process.resourcesPath || "", "dist-electron", "index.html"),
    path.join(__dirname, "..", "dist-electron", "index.html"),
  ];
  return candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || candidates[candidates.length - 1];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "PLUGTECH CalcStudio Pro",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(resolveIndexHtml());
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Links externos abrem no navegador, nunca dentro da app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
