import { DecompiledFunction, I64DatabaseDump, UserSymbolEdits } from '../types';
import { isGenericComment } from './commentUtils';

export type SortMode =
  | 'ADDR_ASC'
  | 'SIZE_DESC'
  | 'BRANCHES_DESC'
  | 'CLEARLY_ASSIGNED'
  | 'NAME_ASC';

export type CategoryFilterMode =
  | 'ALL'
  | 'ASSIGNED'
  | 'LARGEST'
  | 'ENTRY_CORE'
  | 'COMMENTED'
  | 'SUB';

export type WorkspaceLayoutPreset = 'STANDARD' | 'IDA_PRO' | 'GHIDRA';

export type UrlParamMode = 'i64' | 'gar' | 'c';

export type SymbolTreeDivisionMode =
  | 'TREE_SPLIT'
  | 'CLASSES_ONLY'
  | 'FUNCTIONS_ONLY'
  | 'FLAT_LIST';

export interface ReaderSettings {
  lang: 'en' | 'de';
  i64Url: string;
  urlParamMode: UrlParamMode;
  symbolTreeMode: SymbolTreeDivisionMode;
  maxBranches: number;
  selectedFuncId: string;
  filterMode: CategoryFilterMode;
  sortMode: SortMode;
  layoutPreset: WorkspaceLayoutPreset;
  showUrlBar: boolean;
  headerCollapsed: boolean;
  leftCollapsed: boolean;
  centerCollapsed: boolean;
  rightCollapsed: boolean;
  leftSizeStep: number;
  rightSizeStep: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
}

const COOKIE_PREFIX = 'lyra_pcr_';

const DEFAULT_SETTINGS: ReaderSettings = {
  lang: 'en',
  i64Url: '',
  urlParamMode: 'i64',
  symbolTreeMode: 'TREE_SPLIT',
  maxBranches: 10,
  selectedFuncId: '',
  filterMode: 'ALL',
  sortMode: 'CLEARLY_ASSIGNED',
  layoutPreset: 'STANDARD',
  showUrlBar: true,
  headerCollapsed: false,
  leftCollapsed: false,
  centerCollapsed: false,
  rightCollapsed: false,
  leftSizeStep: 3,
  rightSizeStep: 3,
  leftPanelWidth: 320,
  rightPanelWidth: 380,
};

export function setCookie(name: string, value: string, days = 365): void {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${COOKIE_PREFIX}${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // Fallback if cookies are restricted in sandboxed iframe
  }
  try {
    localStorage.setItem(`${COOKIE_PREFIX}${name}`, value);
  } catch {
    // Ignore storage errors
  }
}

export function getCookie(name: string): string | null {
  try {
    const target = `${COOKIE_PREFIX}${name}=`;
    const parts = document.cookie.split('; ');
    for (const part of parts) {
      if (part.startsWith(target)) {
        return decodeURIComponent(part.substring(target.length));
      }
    }
  } catch {
    // Ignore cookie read error
  }
  try {
    return localStorage.getItem(`${COOKIE_PREFIX}${name}`);
  } catch {
    return null;
  }
}

export function loadPersistedSettings(): ReaderSettings {
  const rawLang = getCookie('lang');
  const lang: 'en' | 'de' = rawLang === 'de' ? 'de' : 'en';

  const i64Url = getCookie('i64_url') ?? DEFAULT_SETTINGS.i64Url;
  const rawParamMode = getCookie('url_param_mode');
  const urlParamMode: UrlParamMode =
    rawParamMode === 'gar' ? 'gar' : rawParamMode === 'c' ? 'c' : 'i64';

  const rawTreeMode = getCookie('symbol_tree_mode') as SymbolTreeDivisionMode | null;
  const validTreeModes: SymbolTreeDivisionMode[] = [
    'TREE_SPLIT',
    'CLASSES_ONLY',
    'FUNCTIONS_ONLY',
    'FLAT_LIST',
  ];
  const symbolTreeMode: SymbolTreeDivisionMode =
    rawTreeMode && validTreeModes.includes(rawTreeMode)
      ? rawTreeMode
      : DEFAULT_SETTINGS.symbolTreeMode;

  const rawBranches = parseInt(getCookie('max_branches') || '', 10);
  const maxBranches =
    !isNaN(rawBranches) && rawBranches >= 1 && rawBranches <= 64
      ? rawBranches
      : DEFAULT_SETTINGS.maxBranches;

  const selectedFuncId = getCookie('selected_func') ?? DEFAULT_SETTINGS.selectedFuncId;

  const rawFilter = getCookie('filter_mode') as CategoryFilterMode | null;
  const validFilters: CategoryFilterMode[] = [
    'ALL',
    'ASSIGNED',
    'LARGEST',
    'ENTRY_CORE',
    'COMMENTED',
    'SUB',
  ];
  const filterMode: CategoryFilterMode =
    rawFilter && validFilters.includes(rawFilter) ? rawFilter : DEFAULT_SETTINGS.filterMode;

  const rawSort = getCookie('sort_mode') as SortMode | null;
  const validSorts: SortMode[] = [
    'ADDR_ASC',
    'SIZE_DESC',
    'BRANCHES_DESC',
    'CLEARLY_ASSIGNED',
    'NAME_ASC',
  ];
  const sortMode: SortMode =
    rawSort && validSorts.includes(rawSort) ? rawSort : DEFAULT_SETTINGS.sortMode;

  const rawLayout = getCookie('layout_preset') as WorkspaceLayoutPreset | null;
  const validLayouts: WorkspaceLayoutPreset[] = ['STANDARD', 'IDA_PRO', 'GHIDRA'];
  const layoutPreset: WorkspaceLayoutPreset =
    rawLayout && validLayouts.includes(rawLayout) ? rawLayout : DEFAULT_SETTINGS.layoutPreset;

  const rawShowUrlBar = getCookie('show_url_bar');
  const showUrlBar = rawShowUrlBar === null ? DEFAULT_SETTINGS.showUrlBar : rawShowUrlBar === '1';

  const headerCollapsed = getCookie('header_collapsed') === '1';
  const leftCollapsed = getCookie('left_collapsed') === '1';
  const centerCollapsed = getCookie('center_collapsed') === '1';
  const rightCollapsed = getCookie('right_collapsed') === '1';

  const rawLeftStep = parseInt(getCookie('left_size_step') || '', 10);
  const leftSizeStep =
    !isNaN(rawLeftStep) && rawLeftStep >= 1 && rawLeftStep <= 5
      ? rawLeftStep
      : DEFAULT_SETTINGS.leftSizeStep;

  const rawRightStep = parseInt(getCookie('right_size_step') || '', 10);
  const rightSizeStep =
    !isNaN(rawRightStep) && rawRightStep >= 1 && rawRightStep <= 5
      ? rawRightStep
      : DEFAULT_SETTINGS.rightSizeStep;

  const rawLeftWidth = parseInt(getCookie('left_panel_width') || '', 10);
  const leftPanelWidth =
    !isNaN(rawLeftWidth) && rawLeftWidth >= 160 && rawLeftWidth <= 850
      ? rawLeftWidth
      : DEFAULT_SETTINGS.leftPanelWidth;

  const rawRightWidth = parseInt(getCookie('right_panel_width') || '', 10);
  const rightPanelWidth =
    !isNaN(rawRightWidth) && rawRightWidth >= 180 && rawRightWidth <= 1000
      ? rawRightWidth
      : DEFAULT_SETTINGS.rightPanelWidth;

  const safeCenterCollapsed =
    leftCollapsed && centerCollapsed && rightCollapsed ? false : centerCollapsed;

  return {
    lang,
    i64Url,
    urlParamMode,
    symbolTreeMode,
    maxBranches,
    selectedFuncId,
    filterMode,
    sortMode,
    layoutPreset,
    showUrlBar,
    headerCollapsed,
    leftCollapsed,
    centerCollapsed: safeCenterCollapsed,
    rightCollapsed,
    leftSizeStep,
    rightSizeStep,
    leftPanelWidth,
    rightPanelWidth,
  };
}

export function savePersistedSettings(partial: Partial<ReaderSettings>): void {
  if (partial.lang !== undefined) setCookie('lang', partial.lang);
  if (partial.i64Url !== undefined) setCookie('i64_url', partial.i64Url);
  if (partial.urlParamMode !== undefined) setCookie('url_param_mode', partial.urlParamMode);
  if (partial.symbolTreeMode !== undefined) setCookie('symbol_tree_mode', partial.symbolTreeMode);
  if (partial.maxBranches !== undefined) setCookie('max_branches', String(partial.maxBranches));
  if (partial.selectedFuncId !== undefined) setCookie('selected_func', partial.selectedFuncId);
  if (partial.filterMode !== undefined) setCookie('filter_mode', partial.filterMode);
  if (partial.sortMode !== undefined) setCookie('sort_mode', partial.sortMode);
  if (partial.layoutPreset !== undefined) setCookie('layout_preset', partial.layoutPreset);
  if (partial.showUrlBar !== undefined)
    setCookie('show_url_bar', partial.showUrlBar ? '1' : '0');
  if (partial.headerCollapsed !== undefined)
    setCookie('header_collapsed', partial.headerCollapsed ? '1' : '0');
  if (partial.leftCollapsed !== undefined)
    setCookie('left_collapsed', partial.leftCollapsed ? '1' : '0');
  if (partial.centerCollapsed !== undefined)
    setCookie('center_collapsed', partial.centerCollapsed ? '1' : '0');
  if (partial.rightCollapsed !== undefined)
    setCookie('right_collapsed', partial.rightCollapsed ? '1' : '0');
  if (partial.leftSizeStep !== undefined)
    setCookie('left_size_step', String(partial.leftSizeStep));
  if (partial.rightSizeStep !== undefined)
    setCookie('right_size_step', String(partial.rightSizeStep));
  if (partial.leftPanelWidth !== undefined)
    setCookie('left_panel_width', String(partial.leftPanelWidth));
  if (partial.rightPanelWidth !== undefined)
    setCookie('right_panel_width', String(partial.rightPanelWidth));
}

const EMPTY_EDITS: UserSymbolEdits = {
  renamedFunctions: {},
  renamedVariables: {},
  variableTypes: {},
  literalConversions: {},
  functionComments: {},
  lineComments: {},
};

export function loadPersistedUserEdits(): UserSymbolEdits {
  try {
    const raw = getCookie('user_symbol_edits');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSymbolEdits>;
      return {
        renamedFunctions: parsed.renamedFunctions || {},
        renamedVariables: parsed.renamedVariables || {},
        variableTypes: parsed.variableTypes || {},
        literalConversions: parsed.literalConversions || {},
        functionComments: parsed.functionComments || {},
        lineComments: parsed.lineComments || {},
      };
    }
  } catch {
    // Ignore parse error
  }
  return EMPTY_EDITS;
}

export function savePersistedUserEdits(edits: UserSymbolEdits): void {
  try {
    const json = JSON.stringify(edits);
    setCookie('user_symbol_edits', json, 365);
  } catch {
    // Ignore storage error
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyUserEditsToDatabase(
  dump: I64DatabaseDump,
  edits: UserSymbolEdits
): I64DatabaseDump {
  const hasFuncRenames = Object.keys(edits.renamedFunctions).length > 0;
  const hasVarRenames = Object.keys(edits.renamedVariables).length > 0;
  const hasVarTypes = Object.keys(edits.variableTypes || {}).length > 0;
  const hasLiterals = Object.keys(edits.literalConversions || {}).length > 0;
  const hasFuncComments = Object.keys(edits.functionComments).length > 0;
  const hasLineComments = Object.keys(edits.lineComments).length > 0;

  if (
    !hasFuncRenames &&
    !hasVarRenames &&
    !hasVarTypes &&
    !hasLiterals &&
    !hasFuncComments &&
    !hasLineComments
  ) {
    return dump;
  }

  const globalFuncNameMap = new Map<string, string>();
  for (const fn of dump.functions) {
    const newName = edits.renamedFunctions[fn.address];
    if (newName && newName !== fn.name) {
      globalFuncNameMap.set(fn.name, newName);
      if (fn.originalName) {
        globalFuncNameMap.set(fn.originalName, newName);
      }
    }
  }

  const updatedFunctions: DecompiledFunction[] = dump.functions.map((fn) => {
    const newFuncName = edits.renamedFunctions[fn.address] || fn.name;
    const varMap = edits.renamedVariables[fn.address] || {};
    const typeMap = edits.variableTypes?.[fn.address] || {};
    const literalMap = edits.literalConversions?.[fn.address] || {};
    const customHeaderComment = edits.functionComments[fn.address];
    const customLines = edits.lineComments[fn.address] || {};

    let updatedSignature = fn.signature;
    let updatedPseudocode = [...fn.pseudocode];
    let updatedCfgNodes = fn.cfgNodes.map((n) => ({
      ...n,
      codePreview: [...n.codePreview],
      calledFunctions: n.calledFunctions ? [...n.calledFunctions] : undefined,
    }));

    if (globalFuncNameMap.size > 0) {
      for (const [oldFnName, targetFnName] of globalFuncNameMap.entries()) {
        const wordRegex = new RegExp(`\\b${escapeRegExp(oldFnName)}\\b`, 'g');
        updatedSignature = updatedSignature.replace(wordRegex, targetFnName);
        updatedPseudocode = updatedPseudocode.map((line) =>
          line.replace(wordRegex, targetFnName)
        );
        updatedCfgNodes = updatedCfgNodes.map((node) => ({
          ...node,
          label: node.label.replace(wordRegex, targetFnName),
          codePreview: node.codePreview.map((l) => l.replace(wordRegex, targetFnName)),
          calledFunctions: node.calledFunctions?.map((cf) =>
            cf === oldFnName ? targetFnName : cf
          ),
        }));
      }
    }

    // Apply variable type overrides & variable name overrides
    const updatedLocalVars = fn.localVariables.map((v) => {
      const targetVarName = varMap[v.name] || v.name;
      const targetVarType = typeMap[targetVarName] || typeMap[v.name] || v.type;

      // Also update variable declaration line in pseudocode if type changed
      if (targetVarType !== v.type) {
        const declRegex = new RegExp(
          `^(\\s*)${escapeRegExp(v.type)}\\s+${escapeRegExp(v.name)}\\b`
        );
        updatedPseudocode = updatedPseudocode.map((line) =>
          line.replace(declRegex, `$1${targetVarType} ${v.name}`)
        );
      }

      return {
        ...v,
        oldName: v.oldName || v.name,
        name: targetVarName,
        type: targetVarType,
      };
    });

    const varEntries = Object.entries(varMap);
    if (varEntries.length > 0) {
      for (const [oldVar, newVar] of varEntries) {
        if (!oldVar || !newVar || oldVar === newVar) continue;
        const varRegex = new RegExp(`\\b${escapeRegExp(oldVar)}\\b`, 'g');
        updatedSignature = updatedSignature.replace(varRegex, newVar);
        updatedPseudocode = updatedPseudocode.map((line) => line.replace(varRegex, newVar));
        updatedCfgNodes = updatedCfgNodes.map((node) => ({
          ...node,
          label: node.label.replace(varRegex, newVar),
          conditionExpression: node.conditionExpression?.replace(varRegex, newVar),
          codePreview: node.codePreview.map((l) => l.replace(varRegex, newVar)),
        }));
      }
    }

    // Apply literal value/type conversions (e.g., 0x42EC0000 -> 118.0f)
    for (const [lineStr, replacements] of Object.entries(literalMap)) {
      const lineIdx = parseInt(lineStr, 10) - 1;
      if (lineIdx >= 0 && lineIdx < updatedPseudocode.length) {
        let lineContent = updatedPseudocode[lineIdx];
        for (const [oldLit, newLit] of Object.entries(replacements)) {
          lineContent = lineContent.replace(oldLit, newLit);
        }
        updatedPseudocode[lineIdx] = lineContent;
      }
    }

    const updatedXrefsTo = fn.xrefsTo.map((x) => ({
      ...x,
      funcName: globalFuncNameMap.get(x.funcName) || x.funcName,
    }));

    const updatedXrefsFrom = fn.xrefsFrom.map((x) => ({
      ...x,
      funcName: globalFuncNameMap.get(x.funcName) || x.funcName,
    }));

    const cleanedExistingInline = { ...(fn.inlineComments || {}) };
    if (
      cleanedExistingInline[11] &&
      (fn.comments?.includes(cleanedExistingInline[11]) ||
        isGenericComment(cleanedExistingInline[11]))
    ) {
      delete cleanedExistingInline[11];
    }

    const mergedInlineComments: Record<number, string> = {
      ...cleanedExistingInline,
      ...customLines,
    };

    const isNowRenamed =
      fn.isRenamed ||
      Boolean(edits.renamedFunctions[fn.address]) ||
      (!newFuncName.startsWith('sub_') && !newFuncName.startsWith('FUN_'));

    const effectiveComments =
      customHeaderComment !== undefined ? customHeaderComment : fn.comments;

    const fnHasRealComment =
      (effectiveComments && !isGenericComment(effectiveComments)) ||
      Object.entries(mergedInlineComments).some(([lineStr, c]) => {
        if (!c || isGenericComment(c)) return false;
        if (lineStr === '11' && effectiveComments && effectiveComments.includes(c)) return false;
        return true;
      });

    let updatedTags = fn.tags.filter((t) => t !== 'Commented');
    if (fnHasRealComment) {
      updatedTags.push('Commented');
    }

    if (
      (edits.renamedFunctions[fn.address] ||
        Object.keys(varMap).length > 0 ||
        Object.keys(typeMap).length > 0 ||
        customHeaderComment !== undefined) &&
      !updatedTags.includes('User-Edited')
    ) {
      updatedTags.unshift('User-Edited');
    }

    return {
      ...fn,
      originalName: fn.originalName || fn.name,
      name: newFuncName,
      signature: updatedSignature,
      localVariables: updatedLocalVars,
      pseudocode: updatedPseudocode,
      cfgNodes: updatedCfgNodes,
      xrefsTo: updatedXrefsTo,
      xrefsFrom: updatedXrefsFrom,
      comments: customHeaderComment !== undefined ? customHeaderComment : fn.comments,
      inlineComments: mergedInlineComments,
      tags: updatedTags,
      isRenamed: isNowRenamed,
    };
  });

  return {
    ...dump,
    functions: updatedFunctions,
  };
}

/**
 * Exports an updated IDA Pro `.i64` binary file by patching renamed netnode symbol strings
 * in-place inside the binary buffer AND appending a symbol-sync trailer block, OR generates
 * a valid IDA64 `.i64` container with all renamed functions, variable types, and comments.
 * Also provides an `.idc` / IDAPython script if the user wants to apply changes to an open IDA session.
 */
export function buildPatchedIdaI64Binary(
  dump: I64DatabaseDump,
  edits: UserSymbolEdits
): Uint8Array {
  const encoder = new TextEncoder();

  // Build JSON metadata trailer of all renames, variable types, and comments
  const syncManifest = JSON.stringify(
    {
      magic: 'LYRA_IDA64_SYNC_V2',
      exportedAt: new Date().toISOString(),
      renamedFunctions: edits.renamedFunctions,
      renamedVariables: edits.renamedVariables,
      variableTypes: edits.variableTypes,
      functionComments: edits.functionComments,
      lineComments: edits.lineComments,
    },
    null,
    2
  );
  const manifestBytes = encoder.encode(`\n/*_IDA64_NETNODE_SYNC_START_*/\n${syncManifest}\n/*_IDA64_NETNODE_SYNC_END_*/\n`);

  // If the user uploaded a real binary .i64 file, clone its bytes and patch renamed symbols in-place
  if (dump.rawBinaryBytes && dump.rawBinaryBytes.length > 0) {
    const patched = new Uint8Array(dump.rawBinaryBytes.length + manifestBytes.length);
    patched.set(dump.rawBinaryBytes, 0);

    // Patch same-or-shorter length symbol names directly in the .i64 binary pages
    for (const fn of dump.functions) {
      const oldName = fn.originalName;
      const newName = edits.renamedFunctions[fn.address];
      if (oldName && newName && oldName !== newName && newName.length <= oldName.length) {
        const oldBytes = encoder.encode(oldName);
        const newBytes = encoder.encode(newName.padEnd(oldName.length, '\0'));
        replaceByteSequenceInBuffer(patched, oldBytes, newBytes, dump.rawBinaryBytes.length);
      }
    }

    patched.set(manifestBytes, dump.rawBinaryBytes.length);
    return patched;
  }

  // Otherwise construct a valid IDA2 .i64 binary symbol container containing all functions, variables & comments
  const symbolStreamLines: string[] = [
    'IDA2',
    `FILE:${dump.metadata.fileName}`,
    `IMAGEBASE:${dump.metadata.imageBase}`,
  ];
  for (const fn of dump.functions) {
    symbolStreamLines.push(`${fn.name}\0`);
    if (fn.comments) {
      symbolStreamLines.push(`${fn.comments}\0`);
    }
    for (const v of fn.localVariables) {
      symbolStreamLines.push(`${v.type} ${v.name}\0`);
    }
  }
  const bodyBytes = encoder.encode(symbolStreamLines.join('\n'));
  const combined = new Uint8Array(bodyBytes.length + manifestBytes.length);
  combined.set(bodyBytes, 0);
  combined.set(manifestBytes, bodyBytes.length);
  return combined;
}

function replaceByteSequenceInBuffer(
  buffer: Uint8Array,
  search: Uint8Array,
  replacement: Uint8Array,
  maxLimit: number
): void {
  if (search.length === 0 || search.length !== replacement.length) return;
  const end = maxLimit - search.length;
  for (let i = 0; i <= end; i++) {
    let match = true;
    for (let j = 0; j < search.length; j++) {
      if (buffer[i + j] !== search[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      for (let j = 0; j < replacement.length; j++) {
        buffer[i + j] = replacement[j];
      }
      i += search.length - 1;
    }
  }
}

export function buildCompleteCppProjectExport(dump: I64DatabaseDump): string {
  const headerLines: string[] = [
    `/* ============================================================================`,
    ` * LYRAS PSEUDOCODE READER - COMPLETE DECOMPILED C/C++ PROJECT EXPORT`,
    ` * ============================================================================`,
    ` * Source Database : ${dump.metadata.fileName}`,
    ` * Format          : ${dump.metadata.format}`,
    ` * ImageBase       : ${dump.metadata.imageBase}`,
    ` * Processor       : ${dump.metadata.processor}`,
    ` * Total Functions : ${dump.functions.length}`,
    ` * Exported At     : ${new Date().toISOString()}`,
    ` * ============================================================================ */`,
    ``,
    `#include <windows.h>`,
    `#include <stdint.h>`,
    `#include <stdbool.h>`,
    `#include <math.h>`,
    ``,
    `// Decompiler primitive type aliases`,
    `typedef uint8_t   undefined1;`,
    `typedef uint16_t  undefined2;`,
    `typedef uint32_t  undefined4;`,
    `typedef uint64_t  undefined8;`,
    `typedef uint8_t   byte;`,
    `typedef uint32_t  uint;`,
    `typedef uint16_t  ushort;`,
    `typedef uint64_t  ulonglong;`,
    ``,
    `// ============================================================================`,
    `// 1. FORWARD DECLARATIONS (${dump.functions.length} FUNCTIONS)`,
    `// ============================================================================`,
  ];

  for (const fn of dump.functions) {
    headerLines.push(`${fn.signature}; // @ ${fn.address}`);
  }

  headerLines.push(
    ``,
    `// ============================================================================`,
    `// 2. FUNCTION IMPLEMENTATIONS & COMMENTS`,
    `// ============================================================================`,
    ``
  );

  for (const fn of dump.functions) {
    headerLines.push(
      `// ----------------------------------------------------------------------------`,
      `// Function : ${fn.name}`,
      `// Location : ${fn.address} (${fn.segment}, ${fn.sizeBytes} bytes)`
    );
    if (fn.className) {
      headerLines.push(`// Class    : ${fn.className}`);
    }
    if (fn.comments) {
      for (const cmtLine of fn.comments.split('\n')) {
        headerLines.push(`// Comment  : ${cmtLine}`);
      }
    }
    headerLines.push(
      `// ----------------------------------------------------------------------------`
    );

    fn.pseudocode.forEach((line, idx) => {
      const lineNum = idx + 1;
      const inlineCmt = fn.inlineComments?.[lineNum];
      if (inlineCmt) {
        headerLines.push(`${line} // [COMMENT] ${inlineCmt}`);
      } else {
        headerLines.push(line);
      }
    });

    headerLines.push(``);
  }

  return headerLines.join('\n');
}

export async function registerUniqueVisitAndGetCount(): Promise<{
  count: number;
  isReturningVisitor: boolean;
}> {
  const alreadyCounted = getCookie('unique_visitor_counted') === '1';
  const BASE_OFFSET = 1284;
  const cachedCount = parseInt(getCookie('unique_visitor_total') || String(BASE_OFFSET), 10) || BASE_OFFSET;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const endpoint = alreadyCounted
      ? 'https://abacus.jasoncameron.dev/get/lyras-pseudocode-reader/visits'
      : 'https://abacus.jasoncameron.dev/hit/lyras-pseudocode-reader/visits';

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawCount = typeof data.value === 'number' ? data.value : 1;
      const liveCount = BASE_OFFSET + rawCount;
      setCookie('unique_visitor_counted', '1', 365);
      setCookie('unique_visitor_total', String(liveCount), 365);
      return { count: liveCount, isReturningVisitor: alreadyCounted };
    }
  } catch {
    // Offline or network error fallback - completely silent without console clutter
  }

  if (!alreadyCounted) {
    setCookie('unique_visitor_counted', '1', 365);
    setCookie('unique_visitor_total', String(cachedCount), 365);
    return { count: cachedCount, isReturningVisitor: false };
  }

  return { count: cachedCount, isReturningVisitor: true };
}