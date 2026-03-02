/**
 * Electron main process – secure exam environment.
 * Security: fullscreen on exam page, DevTools disabled, single instance,
 * content protection (screenshots), close-event detection for exam in progress.
 * Graceful handling: power/network loss is handled by the web app (online/offline
 * and heartbeat); window close triggers optional notify to renderer to log disconnect.
 */
const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");

let mainWindow;
let modal; // Optional modal for exam warning

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false, // login page normal
    alwaysOnTop: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: false,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.setContentProtection(true); // block screenshots

  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);

  const allowedDomain = "https://exam.alphainstitutetech.com/";

  mainWindow.loadURL(allowedDomain).catch((err) => {
    console.error("Failed to load URL:", err);
  });

  // Conditional behavior based on URL
  mainWindow.webContents.on("did-navigate", () => {
    const url = mainWindow.webContents.getURL();

    // -----------------------
    // Exam page (anything except index)
    // -----------------------
    if (!url.endsWith("/")) {
      mainWindow.setFullScreen(true);
      mainWindow.setResizable(false);
      mainWindow.setMinimizable(false);
      mainWindow.setMaximizable(false);
      mainWindow.setAlwaysOnTop(true);

      // Focus enforcement
      mainWindow.on("blur", () => {
        mainWindow.webContents.executeJavaScript(
          "alert('You are not allowed to leave the exam window!')"
        );
        mainWindow.focus();
      });

      // Modal warning
      if (!modal) {
        modal = new BrowserWindow({
          parent: mainWindow,
          modal: true,
          width: 400,
          height: 200,
          frame: false,
          alwaysOnTop: true,
        });
        modal.loadURL(
          "data:text/html,<h2>Exam in progress - Do not leave</h2>"
        );
      }
    }
    // -----------------------
    // Login page (index)
    // -----------------------
    else {
      mainWindow.setFullScreen(false);
      mainWindow.setResizable(true);
      mainWindow.setMinimizable(true);
      mainWindow.setMaximizable(true);
      mainWindow.setAlwaysOnTop(false);

      mainWindow.removeAllListeners("blur");

      if (modal && !modal.isDestroyed()) modal.close();
      modal = null;
    }
  });

  // Prevent navigation outside allowed domain
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(allowedDomain)) {
      event.preventDefault();
    }
  });

  // Block new window
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  // Disable right click
  mainWindow.webContents.on("context-menu", (e) => e.preventDefault());

  // Disable shortcut keys
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (
      (input.control && input.shift && input.key.toLowerCase() === "i") ||
      input.key === "F12" ||
      (input.control && input.key.toLowerCase() === "r") ||
      (input.alt && input.key === "F4")
    ) {
      event.preventDefault();
    }
  });

  // Close-event detection: when user closes window during exam, notify renderer
  // so it can attempt to log disconnect/activity (best-effort before process exits)
  mainWindow.on("close", (event) => {
    const url = mainWindow.webContents.getURL();
    const isExamPage = url && !url.endsWith("/");
    if (isExamPage) {
      mainWindow.webContents.send("exam-window-closing");
      // Allow close; renderer may have logged activity if it received the event in time
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Controlled Exam Exit Function
function endExam() {
  if (modal && !modal.isDestroyed()) modal.close();
  mainWindow.removeAllListeners("blur");
  mainWindow.setFullScreen(false);
  mainWindow.setResizable(true);
  mainWindow.setMinimizable(true);
  mainWindow.setMaximizable(true);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.close();
}

// IPC example to trigger exam finish from renderer
ipcMain.on("finish-exam", () => {
  endExam();
});

// Prevent multiple instances
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

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });
}