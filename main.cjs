/**
 * Electron Main Process - High-Security Exam Kiosk
 * Index = normal window. All other pages = secure kiosk mode.
 */
const { app, BrowserWindow, Menu, ipcMain, globalShortcut } = require("electron");
const path = require("path");

let mainWindow;
const isDev = !app.isPackaged;

// Allowed origin: localhost:3000 in dev, or set APP_URL in production
const ALLOWED_ORIGIN = "http://localhost:3000";

// ---------------------------------------------------------------------------
// 1. isIndexPage(url)
// ---------------------------------------------------------------------------
function isIndexPage(url) {
  try {
    const u = new URL(url);
    const pathname = (u.pathname || "/").replace(/\/$/, "") || "/";
    return pathname === "/" || pathname === "/index";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. lockExamMode(win) / unlockExamMode()
// ---------------------------------------------------------------------------

function lockExamMode(win) {
  if (!win || win.isDestroyed()) return;

  globalShortcut.unregisterAll();

  // Kiosk + Fullscreen
  win.setFullScreen(true);
  win.setKiosk(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setMovable(false);
  win.setResizable(false);
  win.setMinimizable(false);
  win.setMaximizable(false);

  // Screenshot protection
  win.setContentProtection(true);

  // Block: ESC, F11, F12, F5, Win+Shift+S (snipping), PrintScreen
  try {
    globalShortcut.register("Escape", () => {});
    globalShortcut.register("F11", () => {});
    globalShortcut.register("F12", () => {});
    globalShortcut.register("F5", () => {});
    globalShortcut.register("CommandOrControl+R", () => {});
    globalShortcut.register("CommandOrControl+Shift+R", () => {});
    globalShortcut.register("CommandOrControl+Shift+I", () => {});
    globalShortcut.register("CommandOrControl+Shift+J", () => {});
    globalShortcut.register("CommandOrControl+U", () => {});
    globalShortcut.register("Alt+Tab", () => {});
    globalShortcut.register("CommandOrControl+Tab", () => {});
    globalShortcut.register("Super+D", () => {});
    globalShortcut.register("Super+L", () => {});
    globalShortcut.register("Super+Shift+S", () => {});
    globalShortcut.register("PrintScreen", () => {});
  } catch (e) {
    console.warn("Shortcut registration:", e.message);
  }
}

function unlockExamMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setKiosk(false);
  mainWindow.setFullScreen(false);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setMovable(true);
  mainWindow.setResizable(true);
  mainWindow.setMinimizable(true);
  mainWindow.setMaximizable(true);
  globalShortcut.unregisterAll();
}

// ---------------------------------------------------------------------------
// 3. before-input-event: block keys in exam mode
// ---------------------------------------------------------------------------
function setupInputBlocking(win) {
  win.webContents.on("before-input-event", (event, input) => {
    const url = win.webContents.getURL();
    if (isIndexPage(url)) return;

    const key = input.key?.toLowerCase?.() || "";
    const ctrl = input.control || input.meta;

    const block =
      key === "f12" ||
      key === "f11" ||
      key === "f5" ||
      (ctrl && key === "r") ||
      (ctrl && input.shift && (key === "i" || key === "j")) ||
      (ctrl && key === "u") ||
      key === "printscreen" ||
      (ctrl && (key === "c" || key === "v" || key === "x" || key === "a"));

    if (block) event.preventDefault();
  });
}

// ---------------------------------------------------------------------------
// createWindow
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    frame: true,
    minimizable: true,
    maximizable: true,
    resizable: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  mainWindow.setContentProtection(true);
  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);

  const loadUrl = `${ALLOWED_ORIGIN.replace(/\/$/, "")}/`;
  mainWindow.loadURL(loadUrl).catch((err) => {
    console.error("URL loading failed:", err);
  });

  // did-navigate
  mainWindow.webContents.on("did-navigate", () => {
    const url = mainWindow.webContents.getURL();
    if (isIndexPage(url)) {
      unlockExamMode();
    } else {
      lockExamMode(mainWindow);
    }
  });

  // did-navigate-in-page (SPA)
  mainWindow.webContents.on("did-navigate-in-page", () => {
    const url = mainWindow.webContents.getURL();
    if (isIndexPage(url)) {
      unlockExamMode();
    } else {
      lockExamMode(mainWindow);
    }
  });

  // leave-full-screen: force back into fullscreen in exam mode
  mainWindow.on("leave-full-screen", () => {
    const url = mainWindow.webContents.getURL();
    if (!isIndexPage(url) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
    }
  });

  // blur: refocus and log
  mainWindow.on("blur", () => {
    const url = mainWindow.webContents.getURL();
    if (!isIndexPage(url) && mainWindow && !mainWindow.isDestroyed()) {
      console.log("Focus lost – possible cheating");
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, "screen-saver");
    }
  });

  setupInputBlocking(mainWindow);

  // Disable right-click
  mainWindow.webContents.on("context-menu", (e) => e.preventDefault());

  // Navigation security: block outside allowed domain
  const allowedBase = ALLOWED_ORIGIN.replace(/\/$/, "");
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(allowedBase)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("finish-exam", () => {
  unlockExamMode();
  app.quit();
});
