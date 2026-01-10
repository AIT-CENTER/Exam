const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // Set the taskbar icon
    icon: path.join(__dirname, 'icon.png'), 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // 1. BLOCK SCREENSHOT AND SNIPPING TOOL
  // This works on Windows and macOS
  mainWindow.setContentProtection(true);

  // 2. REMOVE MENU BAR (File, Edit, etc.)
  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);

  // 3. LOAD YOUR WEBSITE
  mainWindow.loadURL('http://exam.alphainstitutetech.com/').catch((err) => {
    console.error("Failed to load URL:", err);
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 4. PREVENT SCREENSHOT EVEN DURING APP STARTUP
app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});