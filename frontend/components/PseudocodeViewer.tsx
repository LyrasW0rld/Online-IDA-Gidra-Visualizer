import React, { useMemo, useState, useEffect } from 'react';
import { DecompiledFunction } from '../types';
import { isGenericComment } from '../services/commentUtils';
import {
  ValueTypeConverterPopover,
  ValueConverterTarget,
} from './ValueTypeConverterPopover';
import {
  Cpu,
  ArrowUpRight,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  EyeOff,
  Compass,
  Edit3,
  MessageSquarePlus,
  MessageSquare,
  Save,
  X,
  Calculator,
} from 'lucide-react';

interface PseudocodeViewerProps {
  func: DecompiledFunction;
  allFunctions: DecompiledFunction[];
  highlightedLines: { start: number; end: number } | null;
  selectedIdentifier: string | null;
  onSelectIdentifier: (ident: string | null) => void;
  onSelectLine: (lineNumber: number) => void;
  onJumpToFunction: (funcOrAddress: string) => void;
  onOpenGoToModal?: () => void;
  onRenameFunction: (funcAddress: string, newName: string) => void;
  onRenameVariable: (funcAddress: string, oldVarName: string, newVarName: string) => void;
  onChangeVariableType: (funcAddress: string, varName: string, newType: string) => void;
  onConvertLiteralValue: (
    funcAddress: string,
    lineNumber: number,
    oldLiteral: string,
    newLiteral: string
  ) => void;
  onUpdateFunctionComment: (funcAddress: string, newComment: string) => void;
  onUpdateLineComment: (funcAddress: string, lineNumber: number, comment: string) => void;
  lang: 'de' | 'en';
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onCollapse?: () => void;
}

const C_KEYWORDS = new Set([
  'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'goto', 'sizeof'
]);

const C_TYPES = new Set([
  'void', 'int', 'char', 'short', 'long', 'float', 'double', 'unsigned', 'signed',
  'BOOL', 'HANDLE', 'HINSTANCE', 'LPSTR', 'DWORD', 'LPBYTE', 'HKEY', 'struct',
  '__cdecl', '__stdcall', '__thiscall', '__fastcall', '__usercall', '__userpurge', 'BYREF',
  'undefined', 'undefined1', 'undefined2', 'undefined4', 'undefined8',
  'uint', 'ushort', 'ulong', 'ulonglong', 'longlong', 'byte', 'sbyte', 'bool', 'code',
  'uint8_t', 'int16_t', 'uint32_t', 'int64_t',
  'CTaxiPhysicsBody', 'CPassengerActor', 'CTrafficVehicle', 'NJS_VECTOR',
  'IDirect3DDevice8', 'CRI_ADX_STREAM', 'SCrazyBoxDefinition', 'tagMSG', 'eGameModeState'
]);

export const PseudocodeViewer: React.FC<PseudocodeViewerProps> = ({
  func,
  allFunctions,
  highlightedLines,
  selectedIdentifier,
  onSelectIdentifier,
  onSelectLine,
  onJumpToFunction,
  onOpenGoToModal,
  onRenameFunction,
  onRenameVariable,
  onChangeVariableType,
  onConvertLiteralValue,
  onUpdateFunctionComment,
  onUpdateLineComment,
  lang,
  isMaximized = false,
  onToggleMaximize,
  onCollapse,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const [isRenamingFunc, setIsRenamingFunc] = useState(false);
  const [funcNameInput, setFuncNameInput] = useState(func.name);

  const [editingVarName, setEditingVarName] = useState<string | null>(null);
  const [varNameInput, setVarNameInput] = useState('');

  const [isEditingHeaderComment, setIsEditingHeaderComment] = useState(false);
  const [headerCommentInput, setHeaderCommentInput] = useState(func.comments || '');

  const [editingLineNum, setEditingLineNum] = useState<number | null>(null);
  const [lineCommentInput, setLineCommentInput] = useState('');

  // State for the Double-Click Value & Type Calculator Mini-Menu
  const [converterTarget, setConverterTarget] = useState<ValueConverterTarget | null>(null);

  const functionLookup = useMemo(() => {
    const map = new Map<string, DecompiledFunction>();
    for (const f of allFunctions) {
      map.set(f.name, f);
      map.set(f.address.toLowerCase(), f);
    }
    return map;
  }, [allFunctions]);

  const localVarMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of func.localVariables) {
      map.set(v.name, v.type);
    }
    return map;
  }, [func]);

  // HOTKEY 'E': When a variable is selected, pressing 'E' opens the Variable Rename editor!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInputFocused) return;

      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedIdentifier && localVarMap.has(selectedIdentifier)) {
          e.preventDefault();
          setEditingVarName(selectedIdentifier);
          setVarNameInput(selectedIdentifier);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdentifier, localVarMap]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(func.pseudocode.join('\n'));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(func.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  const handleSaveFunctionRename = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = funcNameInput.trim().replace(/[^A-Za-z0-9_::]/g, '_');
    if (cleaned) {
      onRenameFunction(func.address, cleaned);
    }
    setIsRenamingFunc(false);
  };

  const handleSaveVariableRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVarName) {
      const cleaned = varNameInput.trim().replace(/[^A-Za-z0-9_]/g, '_');
      if (cleaned) {
        onRenameVariable(func.address, editingVarName, cleaned);
        onSelectIdentifier(cleaned);
      }
      setEditingVarName(null);
    }
  };

  const handleSaveHeaderComment = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFunctionComment(func.address, headerCommentInput.trim());
    setIsEditingHeaderComment(false);
  };

  const handleSaveLineComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLineNum !== null) {
      onUpdateLineComment(func.address, editingLineNum, lineCommentInput.trim());
      setEditingLineNum(null);
    }
  };

  const renderSyntaxLine = (line: string, lineNum: number) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || (trimmed.startsWith('/*') && trimmed.endsWith('*/'))) {
      return (
        <span className="text-emerald-400 font-medium italic whitespace-pre-wrap break-words block">
          {line}
        </span>
      );
    }

    const commentIndex = line.indexOf('//');
    const codePart = commentIndex !== -1 ? line.slice(0, commentIndex) : line;
    const commentPart = commentIndex !== -1 ? line.slice(commentIndex) : '';

    const tokenRegex = /(".*?"|\b0x[0-9A-Fa-f]+[uUlL]*\b|-?\b\d+(?:\.\d+)?[fFuUlL]*\b|\b[A-Za-z_][A-Za-z0-9_:]*\b|[->&|!=+*/<>:;(),{}[\]]|\s+)/g;
    const tokens = codePart.match(tokenRegex) || [codePart];

    return (
      <>
        {tokens.map((token, idx) => {
          if (token.startsWith('"') && token.endsWith('"')) {
            return (
              <span
                key={idx}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setConverterTarget({ rawToken: token, lineNumber: lineNum });
                }}
                title={
                  lang === 'de'
                    ? 'Doppelklick = Wert-Konverter öffnen'
                    : 'Double-click = Open Value Converter'
                }
                className="text-emerald-400 font-medium cursor-pointer hover:underline"
              >
                {token}
              </span>
            );
          }

          if (/^(FUN|sub|LAB)_00[45][0-9A-Fa-f]{5}$/i.test(token)) {
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToFunction(token);
                }}
                title={
                  lang === 'de'
                    ? `Springe zu Adresse / Funktion ${token}`
                    : `Jump to address / function ${token}`
                }
                className="text-purple-300 font-semibold underline decoration-purple-400/60 hover:bg-[#D4B483] hover:text-[#18181B] px-0.5 rounded transition-colors"
              >
                {token}
              </button>
            );
          }

          // Numeric / Hex Literal: Double-click opens the Type & Value Calculator Mini-Menu!
          if (/^(0x[0-9A-Fa-f]+[uUlL]*|-?\d+(\.\d+)?[fFuUlL]*)$/.test(token)) {
            return (
              <span
                key={idx}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setConverterTarget({
                    rawToken: token,
                    lineNumber: lineNum,
                  });
                }}
                title={
                  lang === 'de'
                    ? 'Doppelklick = Typ- & Wert-Rechner öffnen (Float, Int, Hex, Enum, String)'
                    : 'Double-click = Open Type & Value Calculator (Float, Int, Hex, Enum, String)'
                }
                className="text-purple-300 font-semibold cursor-pointer px-0.5 rounded hover:bg-purple-500/25 hover:text-emerald-400 border-b border-dotted border-purple-400/50 transition-colors"
              >
                {token}
              </span>
            );
          }

          if (C_KEYWORDS.has(token)) {
            return (
              <span key={idx} className="text-[#F5E6CC] font-bold">
                {token}
              </span>
            );
          }

          if (C_TYPES.has(token)) {
            return (
              <span key={idx} className="text-sky-400 font-semibold">
                {token}
              </span>
            );
          }

          if (functionLookup.has(token) && token !== func.name) {
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToFunction(token);
                }}
                title={
                  lang === 'de'
                    ? `Springe zu Funktion ${token}`
                    : `Jump to function ${token}`
                }
                className="text-[#38BDF8] underline decoration-[#38BDF8]/60 hover:bg-[#38BDF8] hover:text-black px-0.5 rounded transition-colors font-semibold inline-flex items-center gap-0.5"
              >
                {token}
              </button>
            );
          }

          if (token === func.name) {
            return (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setFuncNameInput(func.name);
                  setIsRenamingFunc(true);
                }}
                className="cursor-pointer text-[#18181B] bg-[#D4B483] hover:bg-[#E2C9A5] px-1.5 py-0.5 rounded font-bold"
              >
                {token}
              </span>
            );
          }

          // Local Variable: Click = Select (Press E to rename), Double-Click = Open Type & Value Mini-Menu!
          if (localVarMap.has(token)) {
            const isSelected = selectedIdentifier === token;
            const currentType = localVarMap.get(token) || 'int';
            return (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIdentifier(isSelected ? null : token);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setConverterTarget({
                    rawToken: token,
                    lineNumber: lineNum,
                    variableName: token,
                    currentVarType: currentType,
                  });
                }}
                title={
                  lang === 'de'
                    ? `Klick = Auswählen | Taste [E] = Name ändern | Doppelklick = Typ (${currentType}) & Wert-Rechner`
                    : `Click = Select | Press [E] = Rename | Double-click = Change Type (${currentType}) & Value Calculator`
                }
                className={`cursor-pointer rounded px-0.5 transition-colors ${
                  isSelected
                    ? 'bg-[#D4B483] text-[#18181B] font-bold ring-2 ring-[#D4B483]'
                    : 'text-cyan-200 hover:bg-cyan-500/20 font-medium'
                }`}
              >
                {token}
              </span>
            );
          }

          if (
            token.startsWith('g_') ||
            token.startsWith('DAT_') ||
            /_[0-9A-Fa-f]{6,8}$/.test(token)
          ) {
            const isSelected = selectedIdentifier === token;
            return (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIdentifier(isSelected ? null : token);
                }}
                className={`cursor-pointer rounded px-0.5 ${
                  isSelected
                    ? 'bg-[#D4B483] text-[#18181B] font-bold'
                    : 'text-orange-300 hover:bg-orange-500/20 font-medium'
                }`}
              >
                {token}
              </span>
            );
          }

          if (/^[A-Z][A-Z0-9_]{3,}$/.test(token)) {
            return (
              <span key={idx} className="text-rose-300 font-medium">
                {token}
              </span>
            );
          }

          return <span key={idx} className="text-slate-200">{token}</span>;
        })}
        {commentPart && (
          <span className="text-emerald-400 italic whitespace-pre-wrap break-words">
            {commentPart}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0F14] border-r border-zinc-800/90 select-text">
      {/* Function Header Banner */}
      <div className="border-b border-zinc-800 bg-[#12151E] p-3.5 shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-1.5 h-6 bg-[#D4B483]" />

            <button
              type="button"
              onClick={handleCopyAddress}
              title={
                lang === 'de'
                  ? `Aktuelle Position ${func.address} kopieren`
                  : `Copy current location ${func.address}`
              }
              className="inline-flex items-center gap-1.5 bg-[#D4B483] hover:bg-[#E2C9A5] text-[#18181B] font-mono font-extrabold text-xs px-2.5 py-1 rounded tracking-wider transition-colors shadow-sm"
            >
              <span>{func.address}</span>
              {copiedAddr ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="text-[10px] uppercase font-bold bg-black/15 px-1 rounded">
                {copiedAddr
                  ? lang === 'de'
                    ? 'Kopiert!'
                    : 'Copied!'
                  : func.hasRealAddress === false
                  ? 'C Line'
                  : 'Copy Addr'}
              </span>
            </button>

            <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
              {func.segment} • {func.sizeBytes} Bytes
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-sky-300 border border-sky-500/30">
              {func.callingConvention}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() =>
                setConverterTarget({
                  rawToken: '0x42EC0000',
                  lineNumber: 1,
                  variableName: func.localVariables[0]?.name,
                  currentVarType: func.localVariables[0]?.type,
                })
              }
              className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded bg-purple-950/90 text-purple-200 border border-purple-500/50 hover:bg-[#D4B483] hover:text-[#18181B] transition-colors"
              title={
                lang === 'de'
                  ? 'Typ- & Wert-Rechner öffnen (oder Doppelklick auf beliebigen Wert im Code)'
                  : 'Open Type & Value Calculator (or double-click any value in code)'
              }
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Typ/Wert Rechner' : 'Type/Value Calc'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFuncNameInput(func.name);
                setIsRenamingFunc(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded bg-zinc-900 text-[#F5E6CC] border border-zinc-700 hover:bg-[#D4B483] hover:text-[#18181B] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Funktion umbenennen' : 'Rename Func'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHeaderCommentInput(func.comments || '');
                setIsEditingHeaderComment(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-400 hover:text-black transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Kommentar' : 'Comment'}</span>
            </button>

            {onOpenGoToModal && (
              <button
                type="button"
                onClick={onOpenGoToModal}
                className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded bg-zinc-900 text-[#F5E6CC] border border-zinc-700 hover:bg-[#D4B483] hover:text-[#18181B] transition-colors"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>[G]</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded bg-[#D4B483] text-[#18181B] hover:bg-[#E2C9A5] transition-colors shadow-sm"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode
                ? lang === 'de'
                  ? 'Kopiert!'
                  : 'Copied!'
                : lang === 'de'
                ? 'Code kopieren'
                : 'Copy Code'}
            </button>

            {onToggleMaximize && (
              <button
                type="button"
                onClick={onToggleMaximize}
                className="p-1.5 rounded bg-zinc-800 text-zinc-200 hover:bg-[#D4B483] hover:text-[#18181B] transition-colors"
              >
                {isMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="p-1.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-[#D4B483] hover:text-[#18181B] transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Function Rename Form */}
        {isRenamingFunc ? (
          <form
            onSubmit={handleSaveFunctionRename}
            className="flex items-center gap-2 bg-black/80 p-2 rounded border-2 border-[#D4B483]"
          >
            <span className="text-xs font-mono text-[#F5E6CC] font-bold shrink-0">
              {lang === 'de' ? 'Neuer Funktionsname:' : 'New Function Name:'}
            </span>
            <input
              type="text"
              value={funcNameInput}
              onChange={(e) => setFuncNameInput(e.target.value)}
              autoFocus
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs font-mono text-white focus:border-[#D4B483] focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded bg-[#D4B483] text-[#18181B] font-bold text-xs inline-flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              {lang === 'de' ? 'Übernehmen (Global)' : 'Save Globally'}
            </button>
            <button
              type="button"
              onClick={() => setIsRenamingFunc(false)}
              className="p-1 rounded bg-zinc-800 text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <h2 className="font-mono text-sm md:text-base font-bold text-white break-all bg-black/50 p-2.5 rounded border border-zinc-800">
            {func.signature}
          </h2>
        )}

        {/* PROMINENT MULTI-LINE WRAPPED IDA / GHIDRA / USER FUNCTION COMMENT BANNER */}
        {isEditingHeaderComment ? (
          <form
            onSubmit={handleSaveHeaderComment}
            className="bg-emerald-950/40 border-2 border-emerald-400 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-300">
              <span>
                {lang === 'de'
                  ? `IDA / Funktions-Kommentar für ${func.name} (${func.address}) bearbeiten:`
                  : `Edit IDA / Function Comment for ${func.name} (${func.address}):`}
              </span>
            </div>
            <textarea
              rows={3}
              value={headerCommentInput}
              onChange={(e) => setHeaderCommentInput(e.target.value)}
              autoFocus
              className="w-full bg-black/80 border border-emerald-500/50 rounded p-2 text-xs font-mono text-emerald-200 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingHeaderComment(false)}
                className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 text-xs font-mono"
              >
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-emerald-400 text-black font-bold text-xs font-mono inline-flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {lang === 'de' ? 'Kommentar speichern' : 'Save Comment'}
              </button>
            </div>
          </form>
        ) : (
          <div
            onClick={() => {
              setHeaderCommentInput(func.comments || '');
              setIsEditingHeaderComment(true);
            }}
            className={`cursor-pointer group rounded-lg px-3 py-2 transition-colors flex items-start justify-between gap-3 ${
              isGenericComment(func.comments)
                ? 'bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-700/60'
                : 'bg-emerald-950/35 hover:bg-emerald-950/55 border border-emerald-500/40'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <MessageSquare
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isGenericComment(func.comments) ? 'text-zinc-400' : 'text-emerald-400'
                }`}
              />
              <div
                className={`text-xs font-mono leading-relaxed whitespace-pre-wrap break-words flex-1 ${
                  isGenericComment(func.comments) ? 'text-zinc-300' : 'text-emerald-200'
                }`}
              >
                <span
                  className={`font-bold uppercase mr-1.5 ${
                    isGenericComment(func.comments) ? 'text-zinc-400' : 'text-emerald-400'
                  }`}
                >
                  {isGenericComment(func.comments)
                    ? lang === 'de'
                      ? 'Basis-Kommentar (Auto):'
                      : 'Base Comment (Auto):'
                    : lang === 'de'
                    ? 'Kommentar:'
                    : 'Comment:'}
                </span>
                {func.comments ? (
                  func.comments
                ) : (
                  <span className="italic text-zinc-500">
                    {lang === 'de'
                      ? 'Kein Header-Kommentar vorhanden — Klicke hier, um einen Kommentar hinzuzufügen...'
                      : 'No header comment yet — Click here to add a reverse-engineering comment...'}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold shrink-0 ${
                isGenericComment(func.comments)
                  ? 'bg-zinc-800 text-zinc-300 group-hover:bg-[#D4B483] group-hover:text-[#18181B]'
                  : 'bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-400 group-hover:text-black'
              }`}
            >
              {lang === 'de' ? 'Bearbeiten' : 'Edit'}
            </span>
          </div>
        )}
      </div>

      {/* Renamed Local Variables & Stack Frame Bar */}
      {func.localVariables.length > 0 && (
        <div className="border-b border-zinc-800/80 bg-[#0F1219] px-4 py-2.5 shrink-0 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              {lang === 'de'
                ? `Variablen (${func.localVariables.length}) — Klick = Auswählen | [E] = Name ändern | Doppelklick auf Zahl/Variable = Typ & Wert berechnen`
                : `Variables (${func.localVariables.length}) — Click = Select | [E] = Rename | Double-click number/var = Type & Value Calculator`}
            </span>
            {selectedIdentifier && (
              <div className="flex items-center gap-1.5">
                {localVarMap.has(selectedIdentifier) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVarName(selectedIdentifier);
                        setVarNameInput(selectedIdentifier);
                      }}
                      className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-400 text-black hover:bg-emerald-300 inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      {lang === 'de'
                        ? `Name [${selectedIdentifier}] (E)`
                        : `Rename [${selectedIdentifier}] (E)`}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConverterTarget({
                          rawToken: selectedIdentifier,
                          lineNumber: 1,
                          variableName: selectedIdentifier,
                          currentVarType: localVarMap.get(selectedIdentifier),
                        })
                      }
                      className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-sky-400 text-black hover:bg-sky-300 inline-flex items-center gap-1"
                    >
                      <Calculator className="w-3 h-3" />
                      {lang === 'de' ? 'Typ ändern' : 'Change Type'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onSelectIdentifier(null)}
                  className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#D4B483] text-[#18181B]"
                >
                  {lang === 'de' ? 'Auswahl aufheben' : 'Clear'}
                </button>
              </div>
            )}
          </div>

          {editingVarName && (
            <form
              onSubmit={handleSaveVariableRename}
              className="flex items-center gap-2 bg-black/90 p-2 rounded border-2 border-[#D4B483]"
            >
              <span className="text-xs font-mono text-[#F5E6CC] font-bold">
                {lang === 'de'
                  ? `Variable "${editingVarName}" umbenennen in (Taste E):`
                  : `Rename variable "${editingVarName}" to (Hotkey E):`}
              </span>
              <input
                type="text"
                value={varNameInput}
                onChange={(e) => setVarNameInput(e.target.value)}
                autoFocus
                className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs font-mono text-white focus:border-[#D4B483] focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-[#D4B483] text-[#18181B] font-bold text-xs font-mono inline-flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                {lang === 'de' ? 'Übernehmen' : 'Apply'}
              </button>
              <button
                type="button"
                onClick={() => setEditingVarName(null)}
                className="p-1 rounded bg-zinc-800 text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
            {func.localVariables.map((v) => {
              const active = selectedIdentifier === v.name;
              return (
                <div
                  key={v.name}
                  className={`text-xs font-mono rounded border transition-all inline-flex items-center overflow-hidden ${
                    active
                      ? 'bg-[#D4B483] text-[#18181B] font-bold border-[#D4B483]'
                      : 'bg-zinc-900/90 text-zinc-200 border-zinc-800 hover:border-[#D4B483]/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectIdentifier(active ? null : v.name)}
                    onDoubleClick={() =>
                      setConverterTarget({
                        rawToken: v.name,
                        lineNumber: 1,
                        variableName: v.name,
                        currentVarType: v.type,
                      })
                    }
                    className="px-2 py-1 flex items-center gap-1.5"
                    title={
                      lang === 'de'
                        ? 'Klick = Auswählen | Doppelklick = Typ ändern (float, int, enum, char*)'
                        : 'Click = Select | Double-click = Change Type (float, int, enum, char*)'
                    }
                  >
                    <span className={active ? 'text-[#18181B]/80 underline' : 'text-sky-400 underline'}>
                      {v.type}
                    </span>
                    <span className={active ? 'text-[#18181B] font-extrabold' : 'text-cyan-200 font-semibold'}>
                      {v.name}
                    </span>
                    <span
                      className={`text-[10px] px-1 rounded ${
                        active ? 'bg-black/20 text-[#18181B]' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {v.location}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVarName(v.name);
                      setVarNameInput(v.name);
                    }}
                    title={
                      lang === 'de'
                        ? `Variable ${v.name} umbenennen (Taste E)`
                        : `Rename variable ${v.name} (Hotkey E)`
                    }
                    className={`px-1.5 py-1 border-l ${
                      active
                        ? 'border-black/20 hover:bg-black/15 text-[#18181B]'
                        : 'border-zinc-800 hover:bg-[#D4B483] hover:text-[#18181B] text-zinc-400'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main C/C++ Pseudocode Area */}
      <div className="flex-1 overflow-y-auto font-mono text-[13px] leading-6 py-3">
        {func.pseudocode.map((line, idx) => {
          const lineNum = idx + 1;
          const isHighlightedByCfg =
            highlightedLines &&
            lineNum >= highlightedLines.start &&
            lineNum <= highlightedLines.end;
          const inlineComment = func.inlineComments?.[lineNum];

          return (
            <React.Fragment key={idx}>
              <div
                onClick={() => onSelectLine(lineNum)}
                className={`group flex items-start px-4 cursor-pointer transition-colors ${
                  isHighlightedByCfg
                    ? 'bg-[#D4B483]/15 border-l-4 border-[#D4B483]'
                    : 'hover:bg-zinc-800/40 border-l-4 border-transparent'
                }`}
              >
                <span className="w-10 shrink-0 select-none text-right pr-3 text-xs text-zinc-500 group-hover:text-zinc-300 font-mono pt-0.5">
                  {lineNum}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLineNum(lineNum);
                    setLineCommentInput(inlineComment || '');
                  }}
                  className={`mr-2 mt-1 p-0.5 rounded shrink-0 transition-opacity ${
                    inlineComment
                      ? 'opacity-100 text-emerald-400 bg-emerald-950/80'
                      : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-emerald-400'
                  }`}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1 min-w-0">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
                    {renderSyntaxLine(line, lineNum)}
                  </pre>

                  {inlineComment && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLineNum(lineNum);
                        setLineCommentInput(inlineComment);
                      }}
                      className="my-1 px-2.5 py-1 rounded bg-emerald-950/80 border-l-2 border-emerald-400 text-emerald-300 font-mono text-xs whitespace-pre-wrap break-words leading-relaxed"
                    >
                      // 💬 {inlineComment}
                    </div>
                  )}
                </div>
              </div>

              {editingLineNum === lineNum && (
                <form
                  onSubmit={handleSaveLineComment}
                  className="mx-12 my-1.5 flex items-center gap-2 bg-[#121722] p-2 rounded border border-emerald-400"
                >
                  <span className="text-xs font-mono text-emerald-300 font-bold">
                    {lang === 'de' ? `Zeile ${lineNum} Kommentar:` : `Line ${lineNum} Comment:`}
                  </span>
                  <input
                    type="text"
                    value={lineCommentInput}
                    onChange={(e) => setLineCommentInput(e.target.value)}
                    autoFocus
                    className="flex-1 bg-black border border-zinc-700 rounded px-2.5 py-1 text-xs font-mono text-emerald-200 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-emerald-400 text-black font-bold text-xs font-mono"
                  >
                    {lang === 'de' ? 'Speichern' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLineNum(null)}
                    className="p-1 rounded bg-zinc-800 text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Bottom XREFs Bar */}
      {(func.xrefsTo.length > 0 || func.xrefsFrom.length > 0) && (
        <div className="border-t border-zinc-800 bg-[#12151E] px-4 py-2.5 shrink-0 flex flex-wrap items-center gap-4 text-xs">
          {func.xrefsTo.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold uppercase tracking-wider text-zinc-400 text-[11px]">
                {lang === 'de' ? 'Aufgerufen von (XREFs To):' : 'Called by (XREFs To):'}
              </span>
              {func.xrefsTo.map((xref, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onJumpToFunction(xref.funcName)}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-[#D4B483] text-[#18181B] font-bold hover:bg-[#E2C9A5] transition-colors"
                >
                  {xref.funcName} ({xref.address})
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {func.xrefsFrom.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold uppercase tracking-wider text-zinc-400 text-[11px]">
                {lang === 'de' ? 'Ruft auf (Calls):' : 'Calls (XREFs From):'}
              </span>
              {func.xrefsFrom.map((xref, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onJumpToFunction(xref.funcName)}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-100 border border-zinc-700 hover:border-[#D4B483] hover:text-[#38BDF8] transition-colors"
                >
                  {xref.funcName}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Double-Click Value & Variable Type Calculator Mini-Menu */}
      <ValueTypeConverterPopover
        target={converterTarget}
        onClose={() => setConverterTarget(null)}
        onApplyLiteralConversion={(lineNum, oldLit, newLit) => {
          onConvertLiteralValue(func.address, lineNum, oldLit, newLit);
        }}
        onApplyVariableTypeChange={(varName, newType) => {
          onChangeVariableType(func.address, varName, newType);
        }}
        lang={lang}
      />
    </div>
  );
};