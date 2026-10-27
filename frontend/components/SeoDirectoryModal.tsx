import React, { useState } from 'react';
import { X, Globe, Search, ExternalLink, Code2, Cpu, FileArchive, Sparkles } from 'lucide-react';

interface SeoDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'de';
  onLoadPresetDatabase: (mode: 'i64' | 'gar') => void;
}

export interface SeoSubpageArticle {
  slug: string;
  titleEn: string;
  titleDe: string;
  keywords: string[];
  summaryEn: string;
  summaryDe: string;
  actionMode: 'i64' | 'gar';
}

export const SEO_SUBPAGES: SeoSubpageArticle[] = [
  {
    slug: 'ida-pro-i64-decompiler',
    titleEn: 'IDA Pro .i64 Decompiler & Hex-Rays C/C++ Pseudocode Viewer Online',
    titleDe: 'IDA Pro .i64 Decompiler & Hex-Rays C/C++ Pseudocode Viewer Online',
    keywords: [
      'IDA Pro .i64 Reader',
      'Hex-Rays Decompiler Online',
      'IDA64 B-Tree Parser',
      'Rename Functions & Variables',
      'IDA Comments Viewer',
    ],
    summaryEn:
      'Open and inspect 64-bit IDA Pro (.i64) databases directly in the browser. View Hex-Rays C/C++ pseudocode, inspect embedded IDA netnode comments, rename functions across all XREF callers, and export complete C++ source code.',
    summaryDe:
      'Öffne und analysiere 64-Bit IDA Pro (.i64) Datenbanken direkt im Browser. Betrachte Hex-Rays C/C++ Pseudocode, zeige hinterlegte IDA-Kommentare an, benenne Funktionen global um und exportiere vollständigen C++ Code.',
    actionMode: 'i64',
  },
  {
    slug: 'ghidra-gar-archive-viewer',
    titleEn: 'Ghidra Archive (.gar) Unpacker — Nested .gbf, .dat & SLEIGH C Decompiler',
    titleDe: 'Ghidra Archiv (.gar) Entpacker — Verschachtelte .gbf, .dat & SLEIGH C Decompiler',
    keywords: [
      'Ghidra .gar Viewer',
      'Unpack .gbf B-Tree Database',
      'Ghidra SLEIGH Pseudocode',
      'C++ Class Symbol Tree',
      '?gar= URL Loader',
    ],
    summaryEn:
      'Automatically unpacks Ghidra Project Archives (.gar) containing nested .rep/idata/*.gbf database buffers, .dat streams, and .prp XML descriptors. Organizes decompiled symbols into C++ Classes and Global Functions.',
    summaryDe:
      'Entpackt automatisch Ghidra Projekt-Archive (.gar) inklusive aller verschachtelten .gbf Datenbanken, .dat Streams und .prp Metadaten. Unterteilt alle Symbole übersichtlich in C++ Classes und globale Functions.',
    actionMode: 'gar',
  },
  {
    slug: 'crazy-taxi-reverse-engineering',
    titleEn: 'Crazy Taxi PC (SEGA Hitmaker / Katana SDK) C++ Decompilation & Physics CFG',
    titleDe: 'Crazy Taxi PC (SEGA Hitmaker / Katana SDK) C++ Decompilation & Physik CFG',
    keywords: [
      'Crazy Taxi.exe.i64',
      'CTaxiPhysicsBody Crazy Dash',
      'Limiter Cut Decompiled',
      'Sega Ninja SDK Direct3D8',
      'CRI ADX Audio Stream',
    ],
    summaryEn:
      'Explore the decompiled vehicle physics (Crazy Dash, Crazy Drift, Limiter Cut), passenger fare rings, green destination arrow math, and CRI ADX soundtrack streaming from Crazy Taxi PC.',
    summaryDe:
      'Erkunde die decompilierte Fahrzeugphysik (Crazy Dash, Crazy Drift, Limiter Cut), Passagier-Logik, den grünen Richtungspfeil und das CRI ADX Audio-Streaming von Crazy Taxi PC.',
    actionMode: 'i64',
  },
  {
    slug: 'cpp-pseudocode-cfg-explorer',
    titleEn: 'Interactive Control Flow Graph (CFG) & C++ Reverse Engineering Workspace',
    titleDe: 'Interaktiver Control Flow Graph (CFG) & C++ Reverse Engineering Workspace',
    keywords: [
      'Binary Tree Control Flow Graph',
      'True False Branch Visualizer',
      'Jump to Address Hotkey G',
      'Export Compilable C++ Project',
      'Binary Ninja .bndb Exporter',
    ],
    summaryEn:
      'Synchronized 3-panel reverse engineering workspace supporting Standard, IDA Pro, and Ghidra layouts. Press [G] to jump to any hex RVA address and export your renamed project as C++ or JSON.',
    summaryDe:
      'Synchronisierter 3-Spalten Reverse-Engineering Workspace mit Standard-, IDA Pro- und Ghidra-Anordnung. Drücke [G] für Adress-Sprünge und exportiere dein umbenanntes Projekt als C++ oder JSON.',
    actionMode: 'gar',
  },
];

export const SeoDirectoryModal: React.FC<SeoDirectoryModalProps> = ({
  isOpen,
  onClose,
  lang,
  onLoadPresetDatabase,
}) => {
  const [activeSlug, setActiveSlug] = useState<string>(SEO_SUBPAGES[0].slug);

  if (!isOpen) return null;

  const activeArticle =
    SEO_SUBPAGES.find((p) => p.slug === activeSlug) || SEO_SUBPAGES[0];

  const handleSelectSubpage = (slug: string) => {
    setActiveSlug(slug);
    try {
      window.location.hash = `seo=${slug}`;
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#11141C] border-2 border-[#FFCC00] rounded-xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#FFCC00] text-black px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
            <div>
              <h2 className="text-base md:text-lg font-extrabold uppercase tracking-wider">
                {lang === 'de'
                  ? 'SEO Themen-Unterseiten & Reverse Engineering Hub'
                  : 'SEO Topic Subpages & Reverse Engineering Hub'}
              </h2>
              <p className="text-xs font-bold text-black/80">
                {lang === 'de'
                  ? 'Indexierbare Keyword-Unterseiten für Google, Bing & KI-Suchmaschinen (#seo=...)'
                  : 'Indexable high-keyword subpages for Google, Bing & AI Search Engines (#seo=...)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded bg-black text-[#F5E6CC] hover:text-white hover:bg-zinc-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Subpage Navigation List */}
          <div className="md:col-span-5 border-r border-zinc-800 bg-[#0D0F16] p-3 space-y-2 overflow-y-auto">
            <div className="text-[11px] font-mono uppercase text-zinc-400 px-2">
              {lang === 'de' ? 'Indexierte SEO-Unterseiten:' : 'Indexed SEO Subpages:'}
            </div>
            {SEO_SUBPAGES.map((page) => {
              const isSelected = page.slug === activeSlug;
              return (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => handleSelectSubpage(page.slug)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                      : 'bg-[#141822] text-zinc-200 border-zinc-800 hover:border-[#FFCC00]/60'
                  }`}
                >
                  <div className="text-xs font-mono opacity-80 mb-1">
                    #seo={page.slug}
                  </div>
                  <div className="text-xs font-bold leading-snug">
                    {lang === 'de' ? page.titleDe : page.titleEn}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Subpage Content & High-Ranking Keywords */}
          <div className="md:col-span-7 p-6 overflow-y-auto space-y-5 bg-[#11141C]">
            <div className="space-y-2">
              <span className="inline-block bg-[#FFCC00] text-black font-mono font-bold text-xs px-2.5 py-0.5 rounded">
                URL: {window.location.origin + window.location.pathname}#seo={activeArticle.slug}
              </span>
              <h3 className="text-lg font-extrabold text-white leading-snug">
                {lang === 'de' ? activeArticle.titleDe : activeArticle.titleEn}
              </h3>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              {lang === 'de' ? activeArticle.summaryDe : activeArticle.summaryEn}
            </p>

            <div>
              <div className="text-xs font-mono uppercase text-[#F5E6CC] font-bold mb-2">
                {lang === 'de' ? 'Fokus SEO-Keywords:' : 'Target SEO Keywords:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeArticle.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs font-mono px-2.5 py-1 rounded bg-zinc-900 text-emerald-300 border border-emerald-500/30"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onLoadPresetDatabase(activeArticle.actionMode);
                  onClose();
                }}
                className="px-4 py-2 rounded bg-[#FFCC00] text-black font-extrabold text-xs uppercase tracking-wider hover:bg-[#FFD633] transition-colors inline-flex items-center gap-2"
              >
                <Code2 className="w-4 h-4" />
                {activeArticle.actionMode === 'gar'
                  ? lang === 'de'
                    ? 'Jetzt Ghidra .gar Archiv im Reader öffnen'
                    : 'Open Ghidra .gar Archive in Reader Now'
                  : lang === 'de'
                  ? 'Jetzt IDA Pro .i64 Datenbank im Reader öffnen'
                  : 'Open IDA Pro .i64 Database in Reader Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};