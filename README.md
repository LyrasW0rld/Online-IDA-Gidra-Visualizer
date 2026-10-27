# 🚖 Lyras Pseudocode Reader — IDA Pro (`.i64`), Ghidra (`.gar` / `.c`) & CFG Explorer

A 100% client-side, browser-native Reverse Engineering & Pseudocode Explorer in the **National Geographic / Lyra's Crazy Taxi Framework** style.

Runs completely offline in any modern web browser or as a static HTML5 website on GitHub Pages. **No Google Cloud API, external servers, or Python required.**

---

## ✨ Features

1. **100% In-Browser Reverse Engineering Reader**
   - Drop any **IDA Pro `.i64`**, **Ghidra Archive `.gar`** (unpacks nested `.gbf`, `.dat`, and `.prp` in-browser), **Ghidra `.c` source**, or **`.json`** directly into the application.
   - Parses functions, C++ classes, symbols, local variables, embedded IDA comments, and computes interactive Control Flow Graphs (CFG).
2. **Collapsible Workspace & Panels**
   - Upper menu collapsible via panel icon button or keyboard shortcut **`[M]`** to maximize reading height.
   - Left sidebar (Classes & Functions) and right sidebar (CFG Logic Tree) collapsible and resizable.
3. **Symbol Renaming & Binary Patch Export**
   - Rename functions (automatically propagates across all XREF callers) and variables (`[E]` hotkey), change data types (`int`, `float`, `uint`, `char*`, `enum`), and edit IDA comments.
   - Export back to a **patched `.i64` binary + `.idc` IDA sync script**, a pure **`.c` file**, a complete **`.cpp` project**, or a re-importable **`.json`**.
4. **Interactive Numeric & Hex Literal Calculator**
   - Double-click any number or variable in pseudocode to inspect and live-convert between `Float IEEE-754`, `Int32`, `UInt32`, `Hex`, `Binary`, `ASCII`, and `Enum`.
5. **State Persistence**
   - Remembers loaded URL, language (`EN`/`DE`), panel collapse states, widths, selected function, and all custom renames across sessions via cookies and `localStorage`.

---

## 🚀 Running Locally (Windows One-Click Launcher)

Double-click **`start_local_offline.bat`** in the project root.
It will automatically:
1. Verify Node.js is installed.
2. Install dependencies (first launch only).
3. Open your browser at `http://localhost:5173`.

Or manually via terminal:
```bash
npm install
npm run dev
```

---

## 🌐 Deploying to GitHub (GitHub Pages & Node.js Actions)

This repository is pre-configured with **GitHub Actions**:
* **`.github/workflows/deploy.yml`**: Automatically builds the static HTML5 bundle and deploys it to **GitHub Pages** on every push to `main`/`master`.
* **`.github/workflows/node-ci.yml`**: Tests builds across Node.js 18.x, 20.x, and 22.x on both Ubuntu and Windows runners.

### Setup Steps on GitHub:
1. Initialize git and push to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Lyras Pseudocode Reader"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. The workflow will automatically build and publish your static HTML5 website at `https://<your-username>.github.io/<your-repo-name>/`.

---

## 📁 Repository Structure

```
lyras-pseudocode-reader/
├── .github/
│   └── workflows/
│       ├── deploy.yml         # GitHub Pages Static HTML5 Deployment
│       └── node-ci.yml        # Node.js 18, 20, 22 Multi-Platform CI
├── frontend/                  # React + TypeScript + Vite Static Web Application
│   ├── components/            # PseudocodeViewer, ControlFlowGraph, Modals
│   ├── services/              # Binary Parsers (.i64, .gar, .c), Cookie Persistence
│   ├── App.tsx                # Main Interactive Workspace
│   └── vite.config.ts         # Vite Configuration (relative base './' for Pages)
├── backend/                   # Optional local offline Node.js server
├── start_local_offline.bat    # Windows One-Click Local Launcher
├── package.json               # Root Workspace Configuration
└── .gitignore                 # Excludes node_modules, dist, temp files
```

---

## 📄 License

MIT / Apache-2.0
