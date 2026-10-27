import React, { useState } from 'react';
import { PYTHON_EXPORTER_SCRIPT } from '../constants';
import {
  X,
  Download,
  Copy,
  Check,
  Terminal,
  FileCode,
  Sparkles,
  CheckCircle2,
  FolderGit2,
} from 'lucide-react';

interface PythonWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'de' | 'en';
  onExportPatchedI64?: () => void;
}

const BAT_FILE_CONTENT = `@echo off
title LPR lyras Pseudocode Reader - Local Offline Launcher
color 0E
echo ============================================================================
echo   LPR LYRAS PSEUDOCODE READER // LOCAL OFFLINE LAUNCHER (.i64 / .gar / .c)
echo ============================================================================
if not exist "node_modules" (
    echo [*] Installing npm packages...
    call npm install
)
start "" "http://localhost:5173"
call npm run dev
pause`;

export const PythonWorkflowModal: React.FC<PythonWorkflowModalProps> = ({
  isOpen,
  onClose,
  lang,
  onExportPatchedI64,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownloadBat = () => {
    const blob = new Blob([BAT_FILE_CONTENT], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'start_local_offline.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(PYTHON_EXPORTER_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#11141C] border-2 border-[#FFCC00] rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#FFCC00] text-black px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
            <div>
              <h2 className="text-lg font-extrabold uppercase tracking-wider">
                {lang === 'de'
                  ? '100% Browser-Parser (Kein Python nötig!) + Offline .bat & GitHub Hosting'
                  : '100% Browser-Native Parser (No Python Needed!) + Offline .bat & GitHub Guide'}
              </h2>
              <p className="text-xs font-bold text-black/80">
                {lang === 'de'
                  ? '.i64, .gar und .c Dateien werden direkt im Browser ohne Python eingelesen & wieder als .i64 / .c / .cpp exportiert!'
                  : '.i64, .gar, and .c files are parsed directly in your browser without Python & exported back as .i64 / .c / .cpp!'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded bg-black text-[#FFCC00] hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm text-zinc-200">
          {/* Highlight Banner: No Python Required */}
          <div className="p-4 rounded-lg bg-emerald-950/60 border-2 border-emerald-400 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-emerald-300 text-sm">
                {lang === 'de'
                  ? 'Kein Python erforderlich! Direkt im Browser nutzen:'
                  : 'Zero Python Required! Everything runs directly in your browser:'}
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {lang === 'de'
                  ? 'Du musst kein Python-Skript mehr ausführen: Ziehe deine IDA Pro (.i64), Ghidra (.gar inkl. .gbf/.dat) oder Ghidra (.c) Datei einfach über den gelben Button oben rechts in die Webseite. Unser integrierter Web-Binärparser liest alle Symbole, Klassen und Kommentare direkt im Browser aus und exportiert deine Änderungen auch wieder als gepatchte .i64 Datei!'
                  : 'You do NOT need Python: Simply load your IDA Pro (.i64), Ghidra (.gar with nested .gbf/.dat), or Ghidra (.c) file via the yellow button in the top bar. Our built-in Web Binary Parser extracts all symbols, classes, and comments directly in the browser and exports your changes back as a patched .i64 file!'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Offline .bat Launcher */}
            <div className="bg-[#181C26] border border-zinc-700 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="inline-block bg-[#FFCC00] text-black font-extrabold text-xs px-2 py-0.5 rounded mb-2">
                  {lang === 'de' ? '1. LOKAL & OFFLINE (.BAT)' : '1. LOCAL OFFLINE (.BAT)'}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {lang === 'de'
                    ? 'Im Projekt liegt die Datei start_local_offline.bat. Ein Doppelklick installiert automatisch alle Pakete (npm install) und startet die App lokal & offline.'
                    : 'Included in the repository is start_local_offline.bat. Double-clicking it automatically runs npm install and launches the app offline.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBat}
                className="w-full py-2 px-3 rounded bg-[#FFCC00] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#FFD633] inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                start_local_offline.bat
              </button>
            </div>

            {/* Card 2: Export Patched .i64 */}
            <div className="bg-[#181C26] border border-zinc-700 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="inline-block bg-emerald-400 text-black font-extrabold text-xs px-2 py-0.5 rounded mb-2">
                  {lang === 'de' ? '2. IDA .i64 RE-EXPORT' : '2. IDA .i64 RE-EXPORT'}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {lang === 'de'
                    ? 'Wenn du eine .i64 Datei importiert und Funktionen/Variablen umbenannt hast, kannst du sie direkt als aktualisierte .i64 Datei exportieren.'
                    : 'When you import an .i64 file and rename functions/variables, you can export it directly back as a patched .i64 binary file.'}
                </p>
              </div>
              {onExportPatchedI64 && (
                <button
                  type="button"
                  onClick={() => {
                    onExportPatchedI64();
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider hover:bg-emerald-300 inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {lang === 'de' ? 'Als .i64 exportieren' : 'Export Patched .i64'}
                </button>
              )}
            </div>

            {/* Card 3: GitHub Pages Action Workflow */}
            <div className="bg-[#181C26] border border-zinc-700 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="inline-block bg-sky-400 text-black font-extrabold text-xs px-2 py-0.5 rounded mb-2">
                  3. GITHUB PAGES WORKFLOW
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {lang === 'de'
                    ? 'Die Datei .github/workflows/deploy.yml ist fertig eingerichtet. Aktiviere in GitHub unter Settings -> Pages -> Source einfach "GitHub Actions".'
                    : 'The workflow .github/workflows/deploy.yml is ready. In GitHub Settings -> Pages -> Source, simply select "GitHub Actions".'}
                </p>
              </div>
              <div className="text-[11px] font-mono text-sky-300 bg-black/60 p-2 rounded border border-zinc-800">
                .github/workflows/deploy.yml ✓
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 rounded-lg border border-zinc-700">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
              <FileCode className="w-4 h-4 text-[#FFCC00]" />
              {lang === 'de'
                ? 'Optional: Headless IDAPython Helper (nur falls gewünscht)'
                : 'Optional: Headless IDAPython Helper (only if needed)'}
            </div>
            <button
              type="button"
              onClick={handleCopyScript}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded bg-zinc-800 text-white hover:bg-[#FFCC00] hover:text-black transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Optional Script'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};