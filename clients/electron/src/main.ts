import { app, BrowserWindow, dialog } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHost, probeHost, resolveHostEndpoint, type HostEndpoint, type HostProcess } from "./host-controller.ts";
import { preventUntrustedNavigation } from "./renderer-security.ts";

let mainWindow: BrowserWindow | undefined;
let loadingUrl: string | undefined;

const profile = app.getPath("userData");
if (!app.requestSingleInstanceLock({ profile })) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  void app.whenReady().then(startDesktop).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown startup error.";
    await dialog.showMessageBox({ type: "error", title: "A008 Desktop startup failed", message });
    app.quit();
  });
}

async function startDesktop(): Promise<void> {
  const endpoint = resolveHostEndpoint(process.env);
  const ensured = await ensureHost({
    endpoint,
    probe: probeHost,
    startHost: startBundledHost,
  });
  loadingUrl = `${ensured.origin}/`;
  createWindow(ensured.origin);
}

function createWindow(hostOrigin: string): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 760,
    minHeight: 560,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, target) => {
    preventUntrustedNavigation(hostOrigin, target, event);
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  void window.loadURL(`${hostOrigin}/`);
}

function startBundledHost(endpoint: HostEndpoint): HostProcess {

  const engineRoot = app.isPackaged
    ? join(process.resourcesPath, "a008-engine-win32-x64")
    : resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const nodePath = app.isPackaged ? join(engineRoot, "runtime", "node.exe") : findNodeExecutable();
  const entryPath = join(engineRoot, "dist", "src", "gui-host", "server.js");
  const guiPath = join(engineRoot, "gui", "dist");
  if (![nodePath, entryPath, join(guiPath, "index.html")].every(existsSync))
    throw new Error("The packaged A008 GUI host runtime is incomplete. Rebuild the Windows x64 package.");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    A008_GUI_HOST_BIND: endpoint.host,
    A008_GUI_HOST_PORT: String(endpoint.port),
    A008_GUI_STATIC_DIR: guiPath,
  };
  if (!env.A008_GUI_WORKSPACE) env.A008_GUI_WORKSPACE = app.getPath("documents");
  const child = spawn(nodePath, [entryPath], {
    cwd: engineRoot,
    env,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  return child;
}

function findNodeExecutable(): string {
  const candidates = [process.env.A008_NODE_EXECUTABLE, ...((process.env.PATH ?? "").split(delimiter).map((part) => join(part, "node.exe")))];
  const node = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!node) throw new Error("Node.js 24 is required to start the GUI host in development.");
  return node;
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && loadingUrl) {
    void probeHost(resolveHostEndpoint(process.env)).then((result) => {
      if (result.kind === "compatible") createWindow(result.origin);
      else void dialog.showMessageBox({ type: "error", title: "A008 host unavailable", message: result.reason });
    });
  }
});

// Deliberately do not stop the independently owned host when the final window closes.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
