# Gremlino — Electron

## Quick start (dev mode, no build needed)

```bash
cd electron
npm install
npm start
```

This starts Electron, which auto-launches the Flask backend from `../backend/app.py`
using the venv at `../venv/bin/python`. Make sure Ollama is running first.

## Build distributable

### Linux (.AppImage + .deb)
```bash
npm run build:linux
```

### Windows (.exe installer)
```bash
npm run build:win
```

### Both
```bash
npm run build:all
```

Output goes to `../dist/`.

## Requirements
- Node.js 18+
- Python venv at `../venv/` with Flask, psutil, requests installed
- Ollama running on localhost:11434

## Notes
- The app bundles the frontend and backend but NOT the Python venv or Ollama.
- On the target machine: Python + the venv packages must be installed, and Ollama must be running.
- For a fully self-contained build (no Python required), a future phase can bundle a PyInstaller-compiled backend binary.
