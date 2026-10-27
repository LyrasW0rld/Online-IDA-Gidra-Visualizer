# 🦊 LPR lyras Pseudocode Reader — IDA Pro (`.i64`), Ghidra (`.gar` / `.c`) & CFG Explorer

A static, 100% browser-powered Reverse Engineering & Decompiler Workspace in the **National Geographic / Lyra's Crazy Taxi Framework** style.

## ✨ Key Features

1. **100% In-Browser `.i64`, `.gar`, `.bndb` & `.c` Reader (No Python Required!)**
   - Drop any **IDA Pro `.i64`**, **Ghidra Archive `.gar`** (automatically unpacks nested `.gbf`, `.dat`, and `.prp` files in the browser), **Ghidra `.c` source**, or **`.json`** directly into the web app.
   - Extracts functions, C++ classes, local variables, embedded comments, and builds interactive Control Flow Graphs (CFGs) directly in JavaScript/TypeScript.
2. **Export Back to IDA Pro (`.i64` Binary Patch + `.idc` Sync Script), `.c`, `.cpp`, or `.json`**
   - Rename functions (automatically updates all XREF callers across the entire database), rename variables (`[E]` hotkey), change variable types (`int`, `float`, `uint`, `char*`, `enum`), and edit comments.
   - Export your work as a **patched `.i64` binary + `.idc` IDA sync script**, a pure **`.c` file** (when a `.c` file is loaded), a complete **`.cpp` project**, or a re-importable **`.json`**.
3. **Interactive Value & Type Calculator Mini-Menu**
   - **Double-click any numeric or hex literal** (e.g. `0x42EC0000`, `118.5f`, `0x10u`) or variable in the pseudocode to open the live **Type & Value Converter** (`Float IEEE-754`, `Int32`, `UInt32`, `Hex`, `Binary`, `ASCII String`, `Enum`) and convert values in-place!
4. **Cookie & LocalStorage Persistence**
   - Automatically saves and restores your entered `?i64=` / `?gar=` / `?c=` URL, language (`EN`/`DE`), panel widths, selected function, and all renamed functions/variables/types.

---

## 🖥️ Offline Local Usage (Windows `.bat`)

Double-click **`start_local_offline.bat`** in the project root.
It will automatically:
1. Check for Node.js
2. Run `npm install` (first time only)
3. Start the local server at `http://localhost:5173` and open your browser.

---

## 🚀 Hosting on GitHub Pages (GitHub Actions Workflow)

1. Push all files (including `.github/workflows/deploy.yml`) to a GitHub repository on the `main` branch.
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Every push to `main` automatically runs `.github/workflows/deploy.yml` and publishes your static site!
