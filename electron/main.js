const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let backendProcess = null;

const BACKEND_PORT = 7000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// ── Find Python ───────────────────────────────────────────────
function findPython() {
  // Try venv first, then system python
  const candidates = [
    path.join(__dirname, '..', 'venv', 'bin', 'python'),
    path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe'), // Windows
    'python3',
    'python',
  ];
  for (const p of candidates) {
    if (p.startsWith('/') || p.includes('\\')) {
      if (fs.existsSync(p)) return p;
    } else {
      return p; // system python, hope for the best
    }
  }
  return 'python3';
}

// ── Start Flask backend ───────────────────────────────────────
function startBackend() {
  const python = findPython();
  const appPy = path.join(__dirname, '..', 'backend', 'app.py');

  console.log(`[gremlino] starting backend: ${python} ${appPy}`);

  backendProcess = spawn(python, [appPy], {
    cwd: path.join(__dirname, '..', 'backend'),
    env: { ...process.env },
  });

  backendProcess.stdout.on('data', d => process.stdout.write(`[flask] ${d}`));
  backendProcess.stderr.on('data', d => process.stderr.write(`[flask] ${d}`));

  backendProcess.on('close', code => {
    console.log(`[gremlino] backend exited with code ${code}`);
  });
}

// ── Wait for backend to be ready ──────────────────────────────
function waitForBackend(retries = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const check = () => {
      http.get(`${BACKEND_URL}/api/system/`, res => {
        if (res.statusCode === 200) resolve();
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      tries++;
      if (tries >= retries) reject(new Error('backend did not start'));
      else setTimeout(check, interval);
    };
    check();
  });
}

// ── Create window ─────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#131118',
    title: 'Gremlino',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Frameless option — comment out if you want native title bar
    // frame: false,
  });

  mainWindow.loadURL(BACKEND_URL);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(async () => {
  startBackend();

  // Show a loading window while backend starts
  mainWindow = new BrowserWindow({
    width: 480,
    height: 280,
    resizable: false,
    backgroundColor: '#131118',
    title: 'Gremlino — starting...',
    webPreferences: { nodeIntegration: false },
  });

  mainWindow.loadURL('data:text/html,<html><body style="background:%23131118;color:%23c8c0d8;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:14px;">starting gremlino...</body></html>');

  try {
    await waitForBackend();
    mainWindow.close();
    createWindow();
  } catch (e) {
    mainWindow.loadURL('data:text/html,<html><body style="background:%23131118;color:%23ef4761;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:14px;">backend failed to start. check that python and ollama are running.</body></html>');
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
