import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DecompiledFunction, CFGNode } from '../types';
import { Compass, X, CornerDownLeft, Crosshair, GitFork, Database } from 'lucide-react';

interface GoToAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  functions: DecompiledFunction[];
  onJumpToResolved: (func: DecompiledFunction, matchedNode: CFGNode | null) => void;
  lang: 'en' | 'de';
  initialQuery?: string;
}

export interface AddressResolution {
  func: DecompiledFunction;
  matchedNode: CFGNode | null;
  matchType: 'EXACT_FUNC' | 'EXACT_BLOCK' | 'INSIDE_FUNC_RANGE' | 'NAME_MATCH';
  offsetFromStart: number;
}

/**
 * Resolves any hex address (e.g. `0x00413530`, `413530`, `sub_413530`, `FUN_00413530`, `LAB_00413530`)
 * or function name to the exact or containing function AND the specific CFG basic block + pseudocode lines!
 */
export function resolveAddressOrSymbol(
  rawInput: string,
  functions: DecompiledFunction[]
): AddressResolution | null {
  const trimmed = rawInput.trim();
  if (!trimmed || functions.length === 0) return null;

  const hexCleaned = trimmed
    .replace(/^(0x|sub_|FUN_|LAB_|DAT_|loc_|fn_|bb_)/i, '')
    .replace(/h$/i, '');

  const isHexCandidate = /^[0-9a-fA-F]{5,16}$/.test(hexCleaned);
  const targetEa = isHexCandidate ? parseInt(hexCleaned, 16) : NaN;

  if (!isNaN(targetEa)) {
    // 1. Check exact function start address or exact basic block address
    for (const fn of functions) {
      const fnEa = parseInt(fn.address.replace(/^0x/i, ''), 16);
      if (fnEa === targetEa) {
        return {
          func: fn,
          matchedNode: fn.cfgNodes[0] || null,
          matchType: 'EXACT_FUNC',
          offsetFromStart: 0,
        };
      }

      for (const node of fn.cfgNodes) {
        const nodeEa = parseInt(node.address.replace(/^0x/i, ''), 16);
        if (nodeEa === targetEa) {
          return {
            func: fn,
            matchedNode: node,
            matchType: 'EXACT_BLOCK',
            offsetFromStart: Math.max(0, targetEa - fnEa),
          };
        }
      }
    }

    // 2. Check if targetEa falls inside a function's byte range
    let bestFunc: DecompiledFunction | null = null;
    let smallestPositiveDelta = Infinity;

    for (const fn of functions) {
      const fnEa = parseInt(fn.address.replace(/^0x/i, ''), 16);
      if (isNaN(fnEa)) continue;
      const delta = targetEa - fnEa;
      if (delta >= 0 && delta < smallestPositiveDelta) {
        smallestPositiveDelta = delta;
        bestFunc = fn;
      }
    }

    if (bestFunc) {
      const fnEa = parseInt(bestFunc.address.replace(/^0x/i, ''), 16);
      let bestNode: CFGNode | null = bestFunc.cfgNodes[0] || null;
      for (const node of bestFunc.cfgNodes) {
        const nodeEa = parseInt(node.address.replace(/^0x/i, ''), 16);
        if (!isNaN(nodeEa) && nodeEa <= targetEa) {
          bestNode = node;
        }
      }

      return {
        func: bestFunc,
        matchedNode: bestNode,
        matchType: 'INSIDE_FUNC_RANGE',
        offsetFromStart: Math.max(0, targetEa - fnEa),
      };
    }
  }

  // 3. Fallback: Match by function name or demangled signature
  const lower = trimmed.toLowerCase();
  const exactName = functions.find((f) => f.name.toLowerCase() === lower);
  if (exactName) {
    return {
      func: exactName,
      matchedNode: exactName.cfgNodes[0] || null,
      matchType: 'NAME_MATCH',
      offsetFromStart: 0,
    };
  }

  const partialName = functions.find(
    (f) =>
      f.name.toLowerCase().includes(lower) ||
      f.address.toLowerCase().includes(lower)
  );
  if (partialName) {
    return {
      func: partialName,
      matchedNode: partialName.cfgNodes[0] || null,
      matchType: 'NAME_MATCH',
      offsetFromStart: 0,
    };
  }

  return null;
}

export const GoToAddressModal: React.FC<GoToAddressModalProps> = ({
  isOpen,
  onClose,
  functions,
  onJumpToResolved,
  lang,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [isOpen, initialQuery]);

  const primaryResolution = useMemo(
    () => resolveAddressOrSymbol(query, functions),
    [query, functions]
  );

  const quickSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^0x/, '');
    if (!q) return functions.slice(0, 6);
    return functions
      .filter(
        (f) =>
          f.address.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.cfgNodes.some((n) => n.address.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [query, functions]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (primaryResolution) {
      onJumpToResolved(primaryResolution.func, primaryResolution.matchedNode);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#11141C] border-2 border-[#D4B483] rounded-lg max-w-xl w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#D4B483] text-[#18181B] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 stroke-[2.5]" />
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider">
                {lang === 'de'
                  ? 'Springe zu Adresse / Funktion (Hotkey: G)'
                  : 'Jump to Address / Function (Hotkey: G)'}
              </h3>
              <p className="text-[11px] font-semibold text-[#18181B]/80">
                {lang === 'de'
                  ? 'Unterstützt IDA (.i64) & Ghidra (.gpr) Adressen (z.B. 0x00413530, FUN_00413530)'
                  : 'Supports IDA (.i64) & Ghidra (.gpr) addresses (e.g. 0x00413530, FUN_00413530)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded bg-black text-[#F5E6CC] hover:text-white hover:bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5">
              {lang === 'de'
                ? 'Hex-Adresse (z.B. 0x00413530, FUN_00413530) oder Funktionsname eingeben:'
                : 'Enter Hex Address (e.g. 0x00413530, FUN_00413530) or Function Name:'}
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="0x00413530 / FUN_00413530"
                className="flex-1 bg-[#090B10] border-2 border-zinc-700 focus:border-[#D4B483] rounded px-3.5 py-2 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!primaryResolution}
                className="px-4 py-2 rounded bg-[#D4B483] text-[#18181B] font-extrabold text-xs uppercase tracking-wider hover:bg-[#E2C9A5] disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>{lang === 'de' ? 'Springen' : 'Jump'}</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Resolution Preview Card */}
          {query.trim().length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-[#161A24] p-3">
              {primaryResolution ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-400 text-black font-bold">
                      {primaryResolution.matchType === 'EXACT_FUNC'
                        ? lang === 'de'
                          ? 'Exakter Funktions-Treffer'
                          : 'Exact Function Match'
                        : primaryResolution.matchType === 'EXACT_BLOCK'
                        ? lang === 'de'
                          ? 'Exakter CFG Basic-Block Treffer'
                          : 'Exact CFG Basic Block Match'
                        : primaryResolution.matchType === 'INSIDE_FUNC_RANGE'
                        ? lang === 'de'
                          ? `Adresse liegt in Funktion (+0x${primaryResolution.offsetFromStart.toString(16).toUpperCase()})`
                          : `Address inside Function (+0x${primaryResolution.offsetFromStart.toString(16).toUpperCase()})`
                        : lang === 'de'
                        ? 'Symbol-Treffer'
                        : 'Symbol Match'}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#38BDF8]">
                      {primaryResolution.func.address}
                    </span>
                  </div>

                  <div className="font-mono text-sm font-bold text-white truncate">
                    {primaryResolution.func.name}
                  </div>

                  {primaryResolution.matchedNode && (
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-300 bg-black/50 px-2.5 py-1.5 rounded border border-zinc-800">
                      <span className="inline-flex items-center gap-1.5 text-sky-300">
                        <GitFork className="w-3.5 h-3.5 text-[#38BDF8]" />
                        CFG Block: {primaryResolution.matchedNode.label} (
                        {primaryResolution.matchedNode.address})
                      </span>
                      <span className="text-emerald-400">
                        {lang === 'de' ? 'Zeile' : 'Lines'}{' '}
                        {primaryResolution.matchedNode.LineStart}–
                        {primaryResolution.matchedNode.LineEnd}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs font-mono text-rose-400">
                  {lang === 'de'
                    ? 'Keine passende Adresse oder Funktion gefunden.'
                    : 'No matching address or function found.'}
                </div>
              )}
            </div>
          )}

          {/* Suggestions List */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
              <Database className="w-3 h-3 text-[#38BDF8]" />
              {lang === 'de' ? 'Vorschläge (Klick zum Springen):' : 'Suggestions (Click to Jump):'}
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800/80 border border-zinc-800 rounded bg-[#0B0D13]">
              {quickSuggestions.map((fn) => (
                <button
                  key={fn.id}
                  type="button"
                  onClick={() => {
                    onJumpToResolved(fn, fn.cfgNodes[0] || null);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#D4B483] hover:text-[#18181B] transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-[#38BDF8] group-hover:text-[#18181B] shrink-0">
                      {fn.address}
                    </span>
                    <span className="font-mono text-xs text-zinc-100 group-hover:text-[#18181B] font-medium truncate">
                      {fn.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 group-hover:text-[#18181B] shrink-0 inline-flex items-center gap-1">
                    <Crosshair className="w-3 h-3" />
                    {fn.cfgNodes.length} Br
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};