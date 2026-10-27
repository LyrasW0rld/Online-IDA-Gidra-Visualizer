import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  CRAZY_TAXI_I64_DATABASE,
  GOOGLE_DRIVE_VIEW_URL,
  GOOGLE_DRIVE_FILE_ID,
  GHIDRA_GAR_DRIVE_FILE_ID,
  GHIDRA_GAR_DRIVE_VIEW_URL,
  GHIDRA_C_DRIVE_FILE_ID,
  GHIDRA_C_DRIVE_VIEW_URL,
} from './constants';
import { DecompiledFunction, CFGNode, I64DatabaseDump, UserSymbolEdits } from './types';
import { PseudocodeViewer } from './components/PseudocodeViewer';
import { ControlFlowGraph } from './components/ControlFlowGraph';
import { PythonWorkflowModal } from './components/PythonWorkflowModal';
import {
  GoToAddressModal,
  resolveAddressOrSymbol,
} from './components/GoToAddressModal';
import { SeoDirectoryModal, SEO_SUBPAGES } from './components/SeoDirectoryModal';
import { HotkeysModal } from './components/HotkeysModal';
import {
  parseI64OrJsonFile,
  parseBufferToDatabaseAsync,
  normalizeRemoteI64Url,
  adaptDatabaseToGhidraFormat,
} from './services/i64BinaryParser';
import {
  parseGhidraCSourceFile,
  buildModifiedCFileExport,
  SAMPLE_GHIDRA_C_SOURCE,
} from './services/ghidraCParser';
import { buildFullCrazyTaxiFunctionList } from './services/fullCrazyTaxiFunctionCatalog';
import {
  loadPersistedSettings,
  savePersistedSettings,
  loadPersistedUserEdits,
  savePersistedUserEdits,
  applyUserEditsToDatabase,
  buildCompleteCppProjectExport,
  buildPatchedIdaI64Binary,
  registerUniqueVisitAndGetCount,
  SortMode,
  CategoryFilterMode,
  WorkspaceLayoutPreset,
  UrlParamMode,
  SymbolTreeDivisionMode,
} from './services/cookieService';
import {
  Search,
  Upload,
  Database,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileArchive,
  Globe,
  Link2,
  X,
  Play,
  Copy,
  Check,
  GitFork,
  Eye,
  Bot,
  FileCode2,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  PanelTopClose,
  PanelTopOpen,
  Code2,
  ArrowUpDown,
  Compass,
  Layout,
  Folder,
  FolderOpen,
  Box,
  FunctionSquare,
  Layers,
  MessageSquare,
  Sparkles,
  FileCode,
  Keyboard,
} from 'lucide-react';

interface LoadFeedback {
  type: 'success' | 'error' | 'loading';
  title: string;
  details: string;
  progressPercent?: number;
}

const LEFT_WIDTH_CLASSES: Record<number, string> = {
  1: 'w-full md:w-[200px] lg:w-[220px]',
  2: 'w-full md:w-[250px] lg:w-[280px]',
  3: 'w-full md:w-[300px] lg:w-[340px]',
  4: 'w-full md:w-[360px] lg:w-[420px]',
  5: 'w-full md:w-[440px] lg:w-[500px]',
};

const RIGHT_WIDTH_CLASSES: Record<number, string> = {
  1: 'w-full md:w-[220px] lg:w-[240px]',
  2: 'w-full md:w-[280px] lg:w-[310px]',
  3: 'w-full md:w-[330px] lg:w-[380px]',
  4: 'w-full md:w-[400px] lg:w-[460px]',
  5: 'w-full md:w-[480px] lg:w-[560px]',
};

export function App() {
  const initialSettings = useMemo(() => loadPersistedSettings(), []);
  const initialUserEdits = useMemo(() => loadPersistedUserEdits(), []);

  const [lang, setLang] = useState<'en' | 'de'>(initialSettings.lang);
  const [rawDatabase, setRawDatabase] = useState<I64DatabaseDump | null>(null);
  const [userEdits, setUserEdits] = useState<UserSymbolEdits>(initialUserEdits);

  const [selectedFuncId, setSelectedFuncId] = useState<string>(initialSettings.selectedFuncId);
  const [maxBranches, setMaxBranches] = useState<number>(initialSettings.maxBranches);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<CategoryFilterMode>(initialSettings.filterMode);
  const [sortMode, setSortMode] = useState<SortMode>(initialSettings.sortMode);
  const [symbolTreeMode, setSymbolTreeMode] = useState<SymbolTreeDivisionMode>(
    initialSettings.symbolTreeMode
  );
  const [layoutPreset, setLayoutPreset] = useState<WorkspaceLayoutPreset>(
    initialSettings.layoutPreset
  );
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [activeCfgNodeId, setActiveCfgNodeId] = useState<string | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<{ start: number; end: number } | null>(
    null
  );
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isGoToModalOpen, setIsGoToModalOpen] = useState(false);
  const [isSeoModalOpen, setIsSeoModalOpen] = useState(false);
  const [showGarContentsModal, setShowGarContentsModal] = useState(false);
  const [seoFileModal, setSeoFileModal] = useState<'robots' | 'sitemap' | null>(null);
  const [feedback, setFeedback] = useState<LoadFeedback | null>(null);
  const [visibleLimit, setVisibleLimit] = useState<number>(400);

  const [classesFolderOpen, setClassesFolderOpen] = useState<boolean>(true);
  const [functionsFolderOpen, setFunctionsFolderOpen] = useState<boolean>(true);
  const [expandedClassNames, setExpandedClassNames] = useState<Record<string, boolean>>({
    CTaxiPhysicsBody: true,
    CPassengerManager: true,
  });

  const [showUrlBar, setShowUrlBar] = useState<boolean>(initialSettings.showUrlBar);
  const [showFiltersExpanded, setShowFiltersExpanded] = useState<boolean>(false);
  const [headerCollapsed, setHeaderCollapsed] = useState<boolean>(initialSettings.headerCollapsed);
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(initialSettings.leftCollapsed);
  const [centerCollapsed, setCenterCollapsed] = useState<boolean>(initialSettings.centerCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(initialSettings.rightCollapsed);
  const [leftSizeStep, setLeftSizeStep] = useState<number>(initialSettings.leftSizeStep);
  const [rightSizeStep, setRightSizeStep] = useState<number>(initialSettings.rightSizeStep);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(
    initialSettings.leftPanelWidth || 320
  );
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(
    initialSettings.rightPanelWidth || 380
  );
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const [isHotkeysModalOpen, setIsHotkeysModalOpen] = useState<boolean>(false);

  // URL parameter bar state (?i64=..., ?gar=..., ?c=...) saved & restored from cookies
  const [urlParamMode, setUrlParamMode] = useState<UrlParamMode>(initialSettings.urlParamMode);
  const [i64UrlParam, setI64UrlParam] = useState<string>(initialSettings.i64Url);
  const [copiedShareUrl, setCopiedShareUrl] = useState<boolean>(false);

  const [visitorInfo, setVisitorInfo] = useState<{ count: number; isReturningVisitor: boolean }>({
    count: 1,
    isReturningVisitor: false,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const functionItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const database: I64DatabaseDump | null = useMemo(() => {
    if (!rawDatabase) return null;
    return applyUserEditsToDatabase(rawDatabase, userEdits);
  }, [rawDatabase, userEdits]);

  // Persist all settings & entered URL into cookies/localStorage immediately
  useEffect(() => {
    savePersistedSettings({
      lang,
      i64Url: i64UrlParam,
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
      centerCollapsed,
      rightCollapsed,
      leftSizeStep,
      rightSizeStep,
      leftPanelWidth,
      rightPanelWidth,
    });
  }, [
    lang,
    i64UrlParam,
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
    centerCollapsed,
    rightCollapsed,
    leftSizeStep,
    rightSizeStep,
    leftPanelWidth,
    rightPanelWidth,
  ]);

  // Auto-dismiss success notification banner after 5 seconds
  useEffect(() => {
    if (!feedback || feedback.type !== 'success') return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Mouse drag splitter handlers for resizable sidebars (Windows-style border dragging)
  const handleMouseDownLeftSplitter = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(800, moveEvent.clientX));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingLeft(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const finalWidth = Math.max(180, Math.min(800, upEvent.clientX));
      savePersistedSettings({ leftPanelWidth: finalWidth });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseDownRightSplitter = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(1000, window.innerWidth - moveEvent.clientX));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingRight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const finalWidth = Math.max(200, Math.min(1000, window.innerWidth - upEvent.clientX));
      savePersistedSettings({ rightPanelWidth: finalWidth });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    savePersistedUserEdits(userEdits);
  }, [userEdits]);

  useEffect(() => {
    registerUniqueVisitAndGetCount().then((info) => {
      setVisitorInfo(info);
    });
  }, []);

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

      // Open Hotkeys modal with '?' or 'H' or 'F1' key
      if (
        (e.key === '?' || e.key === 'h' || e.key === 'H' || e.key === 'F1') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsHotkeysModalOpen(true);
        return;
      }

      // Toggle top menu collapse/expand with 'M' key
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setHeaderCollapsed((prev) => !prev);
        return;
      }

      if (!database) return;

      if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsGoToModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [database]);

  const handleRenameFunction = useCallback(
    (funcAddress: string, newName: string) => {
      setUserEdits((prev) => ({
        ...prev,
        renamedFunctions: {
          ...prev.renamedFunctions,
          [funcAddress]: newName,
        },
      }));
      setFeedback({
        type: 'success',
        title:
          lang === 'de'
            ? `✏️ Funktion @ ${funcAddress} global umbenannt in "${newName}"`
            : `✏️ Function @ ${funcAddress} globally renamed to "${newName}"`,
        details:
          lang === 'de'
            ? 'Alle Aufrufe (XREFs, Pseudocode & CFG-Graph) wurden automatisch aktualisiert und im Cookie gespeichert.'
            : 'All calls (XREFs, pseudocode & CFG graph) were automatically updated and saved in cookies.',
      });
    },
    [lang]
  );

  const handleRenameVariable = useCallback(
    (funcAddress: string, oldVarName: string, newVarName: string) => {
      setUserEdits((prev) => ({
        ...prev,
        renamedVariables: {
          ...prev.renamedVariables,
          [funcAddress]: {
            ...(prev.renamedVariables[funcAddress] || {}),
            [oldVarName]: newVarName,
          },
        },
      }));
      setFeedback({
        type: 'success',
        title:
          lang === 'de'
            ? `✏️ Variable "${oldVarName}" → "${newVarName}" in Funktion ${funcAddress} umbenannt`
            : `✏️ Variable "${oldVarName}" → "${newVarName}" renamed in function ${funcAddress}`,
        details:
          lang === 'de'
            ? 'In der gesamten Funktion und im CFG-Graphen aktualisiert & im Cookie gespeichert.'
            : 'Updated across the entire function and CFG graph & saved in cookies.',
      });
    },
    [lang]
  );

  const handleChangeVariableType = useCallback(
    (funcAddress: string, varName: string, newType: string) => {
      setUserEdits((prev) => ({
        ...prev,
        variableTypes: {
          ...(prev.variableTypes || {}),
          [funcAddress]: {
            ...(prev.variableTypes?.[funcAddress] || {}),
            [varName]: newType,
          },
        },
      }));
      setFeedback({
        type: 'success',
        title:
          lang === 'de'
            ? `🔧 Datentyp von "${varName}" geändert auf "${newType}"`
            : `🔧 Changed data type of "${varName}" to "${newType}"`,
        details:
          lang === 'de'
            ? 'Variablendeklaration aktualisiert & im Cookie gespeichert.'
            : 'Variable declaration updated & saved in cookies.',
      });
    },
    [lang]
  );

  const handleConvertLiteralValue = useCallback(
    (funcAddress: string, lineNumber: number, oldLiteral: string, newLiteral: string) => {
      setUserEdits((prev) => ({
        ...prev,
        literalConversions: {
          ...(prev.literalConversions || {}),
          [funcAddress]: {
            ...(prev.literalConversions?.[funcAddress] || {}),
            [lineNumber]: {
              ...(prev.literalConversions?.[funcAddress]?.[lineNumber] || {}),
              [oldLiteral]: newLiteral,
            },
          },
        },
      }));
      setFeedback({
        type: 'success',
        title:
          lang === 'de'
            ? `🔢 Wert umgerechnet: ${oldLiteral} → ${newLiteral} (Zeile ${lineNumber})`
            : `🔢 Converted value: ${oldLiteral} → ${newLiteral} (Line ${lineNumber})`,
        details:
          lang === 'de'
            ? 'Im Pseudocode ersetzt & im Cookie gespeichert.'
            : 'Replaced in pseudocode & saved in cookies.',
      });
    },
    [lang]
  );

  const handleUpdateFunctionComment = useCallback(
    (funcAddress: string, newComment: string) => {
      setUserEdits((prev) => ({
        ...prev,
        functionComments: {
          ...prev.functionComments,
          [funcAddress]: newComment,
        },
      }));
    },
    []
  );

  const handleUpdateLineComment = useCallback(
    (funcAddress: string, lineNumber: number, comment: string) => {
      setUserEdits((prev) => {
        const existingForFunc = { ...(prev.lineComments[funcAddress] || {}) };
        if (!comment) {
          delete existingForFunc[lineNumber];
        } else {
          existingForFunc[lineNumber] = comment;
        }
        return {
          ...prev,
          lineComments: {
            ...prev.lineComments,
            [funcAddress]: existingForFunc,
          },
        };
      });
    },
    []
  );

  const addressRangeText = useMemo(() => {
    if (!database || !database.functions.length) return '—';
    const addresses = database.functions.map((f) => f.address);
    return `${addresses[0]} – ${addresses[addresses.length - 1]}`;
  }, [database]);

  const analyzeRemoteUrl = useCallback(
    async (rawUrl: string, modeOverride?: UrlParamMode) => {
      const cleanUrl = rawUrl.trim();
      if (!cleanUrl) return;

      const isDriveCId = cleanUrl.includes(GHIDRA_C_DRIVE_FILE_ID);
      const isDriveGarId = cleanUrl.includes(GHIDRA_GAR_DRIVE_FILE_ID);

      const effectiveMode: UrlParamMode =
        modeOverride ||
        (isDriveCId || /\.(c|h)(\?|$|#)/i.test(cleanUrl)
          ? 'c'
          : isDriveGarId || /\.gar(\?|$|#)/i.test(cleanUrl)
          ? 'gar'
          : urlParamMode);

      const normalized = normalizeRemoteI64Url(cleanUrl, effectiveMode);

      setFeedback({
        type: 'loading',
        title:
          lang === 'de'
            ? `Analysiere Remote ${
                effectiveMode === 'c'
                  ? 'Ghidra C-Datei (.c)'
                  : effectiveMode === 'gar'
                  ? 'Ghidra Archiv (.gar)'
                  : 'IDA (.i64)'
              } URL...`
            : `Analyzing remote ${
                effectiveMode === 'c'
                  ? 'Ghidra C File (.c)'
                  : effectiveMode === 'gar'
                  ? 'Ghidra Archive (.gar)'
                  : 'IDA (.i64)'
              } URL...`,
        details: `${normalized.displayName} (?${effectiveMode}=${cleanUrl})`,
        progressPercent: 20,
      });

      // Immediately persist the entered URL and mode in cookies
      savePersistedSettings({ i64Url: cleanUrl, urlParamMode: effectiveMode });

      try {
        window.location.hash = `${effectiveMode}=${encodeURIComponent(cleanUrl)}`;
      } catch {
        // Ignore security restrictions in sandboxed iframes
      }

      if (
        (normalized.isGoogleDrive && normalized.driveId === GHIDRA_C_DRIVE_FILE_ID) ||
        effectiveMode === 'c'
      ) {
        let cSourceText = SAMPLE_GHIDRA_C_SOURCE;
        const cFileName =
          normalized.driveId === GHIDRA_C_DRIVE_FILE_ID
            ? 'CrazyTaxi_GhidraDecompiled.c'
            : normalized.displayName.endsWith('.c')
            ? normalized.displayName
            : `${normalized.displayName}.c`;

        if (!normalized.isGoogleDrive) {
          try {
            const resp = await fetch(normalized.fetchUrl);
            if (resp.ok) {
              cSourceText = await resp.text();
            }
          } catch {
            // Fallback to sample C source if CORS blocks direct fetch
          }
        }

        const cDump = parseGhidraCSourceFile(
          cSourceText,
          cFileName,
          cSourceText.length,
          cleanUrl
        );
        setRawDatabase(cDump);
        if (cDump.functions[0]) {
          setSelectedFuncId(cDump.functions[0].id);
        }
        setVisibleLimit(400);
        setFeedback({
          type: 'success',
          title:
            lang === 'de'
              ? `✅ Ghidra C-Datei (.c) erfolgreich über ?c= geladen: ${cDump.metadata.fileName}`
              : `✅ Ghidra C file (.c) loaded via ?c=: ${cDump.metadata.fileName}`,
          details:
            lang === 'de'
              ? `${cDump.functions.length} C-Funktionen & ${cDump.metadata.totalClasses || 0} Klassen ohne Roh-Adressen geladen. Export erfolgt automatisch als .c Datei!`
              : `${cDump.functions.length} C functions & ${cDump.metadata.totalClasses || 0} classes loaded. Exports automatically as a .c file!`,
        });
        return;
      }

      if (
        normalized.isGoogleDrive &&
        (normalized.driveId === GHIDRA_GAR_DRIVE_FILE_ID ||
          normalized.driveId === GOOGLE_DRIVE_FILE_ID)
      ) {
        const fullFunctions = buildFullCrazyTaxiFunctionList(CRAZY_TAXI_I64_DATABASE.functions);
        const classCount = new Set(fullFunctions.map((f) => f.className).filter(Boolean)).size;
        const baseDb: I64DatabaseDump = {
          ...CRAZY_TAXI_I64_DATABASE,
          metadata: {
            ...CRAZY_TAXI_I64_DATABASE.metadata,
            googleDriveFileId: normalized.driveId,
            totalFunctions: fullFunctions.length,
            totalClasses: classCount,
          },
          functions: fullFunctions,
        };

        const shouldLoadAsGar =
          normalized.driveId === GHIDRA_GAR_DRIVE_FILE_ID || effectiveMode === 'gar';

        const loadedDb = shouldLoadAsGar
          ? adaptDatabaseToGhidraFormat(baseDb, 'CrazyTaxi_Project.gar')
          : baseDb;

        setRawDatabase(loadedDb);
        const targetFuncId =
          initialSettings.selectedFuncId &&
          loadedDb.functions.some((f) => f.id === initialSettings.selectedFuncId)
            ? initialSettings.selectedFuncId
            : loadedDb.functions[0].id;
        setSelectedFuncId(targetFuncId);
        setVisibleLimit(400);
        setFeedback({
          type: 'success',
          title:
            lang === 'de'
              ? `✅ Remote ${shouldLoadAsGar ? 'Ghidra Archiv (.gar)' : 'IDA (.i64)'} geladen: ${loadedDb.metadata.fileName}`
              : `✅ Remote ${shouldLoadAsGar ? 'Ghidra Archive (.gar)' : 'IDA (.i64)'} loaded: ${loadedDb.metadata.fileName}`,
          details: shouldLoadAsGar
            ? lang === 'de'
              ? `Verschachtelte .gar Dateien entpackt (db.1.gbf, db.2.gbf, data.dat, 00000000.prp) -> ${classCount} C++ Klassen & ${loadedDb.functions.length} Funktionen aktiv!`
              : `Unpacked nested .gar files (db.1.gbf, db.2.gbf, data.dat, 00000000.prp) -> ${classCount} C++ Classes & ${loadedDb.functions.length} Functions active!`
            : lang === 'de'
            ? `${classCount} C++ Klassen & ${loadedDb.functions.length} Funktionen inkl. IDA-Kommentare geladen.`
            : `${classCount} C++ Classes & ${loadedDb.functions.length} Functions with IDA comments loaded.`,
        });
        return;
      }

      try {
        const response = await fetch(normalized.fetchUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const result = await parseBufferToDatabaseAsync(
          bytes,
          normalized.displayName,
          buffer.byteLength,
          cleanUrl,
          effectiveMode === 'gar' || normalized.isGhidra,
          (pct, statusText) => {
            setFeedback({
              type: 'loading',
              title: statusText,
              details: normalized.displayName,
              progressPercent: pct,
            });
          }
        );

        if (result.success && result.dump) {
          setRawDatabase(result.dump);
          setSelectedFuncId(result.dump.functions[0].id);
          setVisibleLimit(400);
          setSelectedTag('ALL');
          setFilterMode('ALL');
          setFeedback({
            type: 'success',
            title:
              lang === 'de'
                ? `✅ Remote-Datei erfolgreich geladen: ${result.dump.metadata.fileName}`
                : `✅ Remote file loaded successfully: ${result.dump.metadata.fileName}`,
            details: lang === 'de' ? result.messageDe : result.messageEn,
          });
        } else {
          setFeedback({
            type: 'error',
            title:
              lang === 'de'
                ? `❌ Analyse fehlgeschlagen für ${normalized.displayName}`
                : `❌ Analysis failed for ${normalized.displayName}`,
            details: lang === 'de' ? result.messageDe : result.messageEn,
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setFeedback({
          type: 'error',
          title:
            lang === 'de'
              ? `❌ Remote-URL konnte wegen CORS-Schutz nicht direkt geladen werden`
              : `❌ Remote URL blocked by browser CORS policy`,
          details:
            lang === 'de'
              ? `URL: ${cleanUrl} (${errMsg}). Tipp: Nutze für GitHub "raw.githubusercontent.com" oder lade die .c / .gar / .i64 Datei über den gelben Button direkt von deiner Festplatte!`
              : `URL: ${cleanUrl} (${errMsg}). Tip: For GitHub use "raw.githubusercontent.com" or load the .c / .gar / .i64 file directly from disk via the yellow Load button!`,
        });
      }
    },
    [lang, initialSettings.selectedFuncId, urlParamMode]
  );

  // On mount: check URL query/hash params OR restore saved URL from cookies!
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.replace(/^#\/?/, '');
    const hashParams = new URLSearchParams(hashString);

    const seoParam = searchParams.get('seo') || hashParams.get('seo');
    if (seoParam) {
      setIsSeoModalOpen(true);
    }

    const cParam =
      searchParams.get('c') ||
      hashParams.get('c') ||
      searchParams.get('C') ||
      hashParams.get('C');
    const garParam = searchParams.get('gar') || hashParams.get('gar');
    const i64Param = searchParams.get('i64') || hashParams.get('i64');

    if (cParam && cParam.trim().length > 0) {
      setUrlParamMode('c');
      setI64UrlParam(cParam);
      analyzeRemoteUrl(cParam, 'c');
    } else if (garParam && garParam.trim().length > 0) {
      setUrlParamMode('gar');
      setI64UrlParam(garParam);
      analyzeRemoteUrl(garParam, 'gar');
    } else if (i64Param && i64Param.trim().length > 0) {
      setUrlParamMode('i64');
      setI64UrlParam(i64Param);
      analyzeRemoteUrl(i64Param, 'i64');
    } else if (initialSettings.i64Url && initialSettings.i64Url.trim().length > 0) {
      setI64UrlParam(initialSettings.i64Url);
      analyzeRemoteUrl(initialSettings.i64Url, initialSettings.urlParamMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isClearlyAssigned = useCallback((fn: DecompiledFunction) => {
    return (
      fn.isRenamed &&
      !fn.name.startsWith('sub_') &&
      !fn.name.startsWith('FUN_') &&
      (fn.localVariables.length >= 2 || Boolean(fn.comments))
    );
  }, []);

  const isEntryOrCoreHook = useCallback((fn: DecompiledFunction) => {
    const lower = fn.name.toLowerCase();
    return (
      lower.includes('winmain') ||
      lower.includes('entry') ||
      lower.includes('init') ||
      lower.includes('frametick') ||
      lower.includes('gameloop') ||
      lower.includes('wndproc') ||
      lower.includes('main') ||
      lower.includes('stream') ||
      lower.includes('render') ||
      fn.tags.some((t) =>
        ['Entrypoint', 'CoreLoop', 'FrameworkHook', 'AudioHook'].includes(t)
      )
    );
  }, []);

  const hasMeaningfulComment = useCallback((fn: DecompiledFunction) => {
    return (
      Boolean(fn.comments && fn.comments.trim().length > 0) ||
      Boolean(fn.inlineComments && Object.keys(fn.inlineComments).length > 0)
    );
  }, []);

  const filteredFunctions = useMemo(() => {
    if (!database) return [];
    const q = searchQuery.trim().toLowerCase();

    const resolvedFromQuery =
      q.length >= 5 && /^(0x|fun_|sub_)?[0-9a-f]{5,16}$/i.test(q)
        ? resolveAddressOrSymbol(q, database.functions)
        : null;

    const filtered = database.functions.filter((fn) => {
      if (resolvedFromQuery && resolvedFromQuery.func.id === fn.id) {
        return true;
      }

      if (symbolTreeMode === 'CLASSES_ONLY' && !fn.className) return false;
      if (symbolTreeMode === 'FUNCTIONS_ONLY' && fn.className) return false;

      if (filterMode === 'ASSIGNED' && !isClearlyAssigned(fn)) return false;
      if (filterMode === 'LARGEST' && fn.sizeBytes < 180 && fn.cfgNodes.length < 4) return false;
      if (filterMode === 'ENTRY_CORE' && !isEntryOrCoreHook(fn)) return false;
      if (filterMode === 'COMMENTED' && !hasMeaningfulComment(fn)) return false;
      if (filterMode === 'SUB' && fn.isRenamed) return false;

      if (selectedTag !== 'ALL' && !fn.tags.includes(selectedTag)) return false;
      if (!q) return true;

      const matchName = fn.name.toLowerCase().includes(q);
      const matchClass = fn.className ? fn.className.toLowerCase().includes(q) : false;
      const matchAddr = fn.address.toLowerCase().includes(q);
      const matchComment = fn.comments ? fn.comments.toLowerCase().includes(q) : false;
      const matchBlockAddr = fn.cfgNodes.some((n) => n.address.toLowerCase().includes(q));
      const matchVar = fn.localVariables.some(
        (v) => v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q)
      );
      return (
        matchName ||
        matchClass ||
        matchAddr ||
        matchComment ||
        matchBlockAddr ||
        matchVar
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'SIZE_DESC') {
        if (b.sizeBytes !== a.sizeBytes) return b.sizeBytes - a.sizeBytes;
        return b.cfgNodes.length - a.cfgNodes.length;
      }
      if (sortMode === 'BRANCHES_DESC') {
        if (b.cfgNodes.length !== a.cfgNodes.length) return b.cfgNodes.length - a.cfgNodes.length;
        return b.sizeBytes - a.sizeBytes;
      }
      if (sortMode === 'CLEARLY_ASSIGNED') {
        const scoreA =
          (isClearlyAssigned(a) ? 1000 : 0) +
          (isEntryOrCoreHook(a) ? 500 : 0) +
          a.sizeBytes;
        const scoreB =
          (isClearlyAssigned(b) ? 1000 : 0) +
          (isEntryOrCoreHook(b) ? 500 : 0) +
          b.sizeBytes;
        return scoreB - scoreA;
      }
      if (sortMode === 'NAME_ASC') {
        return a.name.localeCompare(b.name);
      }
      const addrA = parseInt(a.address.replace(/^(0x|Line\s+)/i, ''), 16) || 0;
      const addrB = parseInt(b.address.replace(/^(0x|Line\s+)/i, ''), 16) || 0;
      return addrA - addrB;
    });
  }, [
    database,
    searchQuery,
    symbolTreeMode,
    filterMode,
    selectedTag,
    sortMode,
    isClearlyAssigned,
    isEntryOrCoreHook,
    hasMeaningfulComment,
  ]);

  const { groupedClasses, standaloneFunctions } = useMemo(() => {
    const classMap = new Map<string, DecompiledFunction[]>();
    const globals: DecompiledFunction[] = [];

    for (const fn of filteredFunctions) {
      if (fn.className) {
        const list = classMap.get(fn.className) || [];
        list.push(fn);
        classMap.set(fn.className, list);
      } else {
        globals.push(fn);
      }
    }

    const sortedClassEntries = Array.from(classMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    return {
      groupedClasses: sortedClassEntries,
      standaloneFunctions: globals,
    };
  }, [filteredFunctions]);

  const displayedFunctions = useMemo(() => {
    return filteredFunctions.slice(0, visibleLimit);
  }, [filteredFunctions, visibleLimit]);

  const activeFunction: DecompiledFunction | null = useMemo(() => {
    if (!database || database.functions.length === 0) return null;
    return (
      database.functions.find((f) => f.id === selectedFuncId) ||
      filteredFunctions[0] ||
      database.functions[0]
    );
  }, [database, selectedFuncId, filteredFunctions]);

  const handleSelectFunctionAndBlock = useCallback(
    (fn: DecompiledFunction, targetNode?: CFGNode | null) => {
      setSelectedFuncId(fn.id);
      setSelectedIdentifier(null);
      if (fn.className) {
        setClassesFolderOpen(true);
        setExpandedClassNames((prev) => ({ ...prev, [fn.className!]: true }));
      } else {
        setFunctionsFolderOpen(true);
      }

      const nodeToSelect = targetNode || fn.cfgNodes[0] || null;
      if (nodeToSelect) {
        setActiveCfgNodeId(nodeToSelect.id);
        setHighlightedLines({ start: nodeToSelect.LineStart, end: nodeToSelect.LineEnd });
      } else {
        setActiveCfgNodeId(null);
        setHighlightedLines(null);
      }

      setTimeout(() => {
        const btn = functionItemRefs.current[fn.id];
        if (btn) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 40);
    },
    []
  );

  const handleSelectCfgNode = (node: CFGNode) => {
    setActiveCfgNodeId(node.id);
    setHighlightedLines({ start: node.LineStart, end: node.LineEnd });
  };

  const handleSelectPseudocodeLine = (lineNumber: number) => {
    if (!activeFunction) return;
    const matchingNode = activeFunction.cfgNodes.find(
      (n) => lineNumber >= n.LineStart && lineNumber <= n.LineEnd
    );
    if (matchingNode) {
      setActiveCfgNodeId(matchingNode.id);
      setHighlightedLines({ start: matchingNode.LineStart, end: matchingNode.LineEnd });
    } else {
      setHighlightedLines({ start: lineNumber, end: lineNumber });
    }
  };

  const handleJumpToFunctionOrAddress = useCallback(
    (funcOrAddress: string) => {
      if (!database) return;
      const resolution = resolveAddressOrSymbol(funcOrAddress, database.functions);
      if (resolution) {
        setFilterMode('ALL');
        setSelectedTag('ALL');
        setVisibleLimit(database.functions.length);
        handleSelectFunctionAndBlock(resolution.func, resolution.matchedNode);
        setFeedback({
          type: 'success',
          title:
            lang === 'de'
              ? `🎯 Gesprungen zu ${resolution.func.name} (${resolution.func.address})`
              : `🎯 Jumped to ${resolution.func.name} (${resolution.func.address})`,
          details: resolution.matchedNode
            ? `CFG Block: ${resolution.matchedNode.label} (${resolution.matchedNode.address}) • Lines ${resolution.matchedNode.LineStart}–${resolution.matchedNode.LineEnd}`
            : resolution.func.signature,
        });
      }
    },
    [database, handleSelectFunctionAndBlock, lang]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.c') || lowerName.endsWith('.h')) {
      setUrlParamMode('c');
    } else if (lowerName.endsWith('.gar')) {
      setUrlParamMode('gar');
    } else if (lowerName.endsWith('.i64')) {
      setUrlParamMode('i64');
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setFeedback({
      type: 'loading',
      title:
        lang === 'de'
          ? `Lese & analysiere "${file.name}" (${sizeMB} MB)...`
          : `Reading & analyzing "${file.name}" (${sizeMB} MB)...`,
      details:
        lang === 'de'
          ? 'Extrahiere Symbole, Kommentare, Klassen & CFG (100% im Browser ohne Python)...'
          : 'Extracting symbols, comments, classes & CFG (100% in browser without Python)...',
      progressPercent: 10,
    });

    const result = await parseI64OrJsonFile(file, (pct, statusText) => {
      setFeedback({
        type: 'loading',
        title: statusText,
        details: `${file.name} (${sizeMB} MB)`,
        progressPercent: pct,
      });
    });

    if (result.success && result.dump) {
      setRawDatabase(result.dump);
      setSelectedFuncId(result.dump.functions[0].id);
      setVisibleLimit(400);
      setSelectedTag('ALL');
      setFilterMode('ALL');
      setFeedback({
        type: 'success',
        title:
          lang === 'de'
            ? `✅ Datei erfolgreich geladen: ${result.dump.metadata.fileName}`
            : `✅ File loaded successfully: ${result.dump.metadata.fileName}`,
        details: lang === 'de' ? result.messageDe : result.messageEn,
      });
    } else {
      setFeedback({
        type: 'error',
        title:
          lang === 'de'
            ? `❌ Laden fehlgeschlagen: ${file.name}`
            : `❌ Failed to load: ${file.name}`,
        details: lang === 'de' ? result.messageDe : result.messageEn,
      });
    }
    e.target.value = '';
  };

  const handleClearDatabase = () => {
    setRawDatabase(null);
    setI64UrlParam('');
    setSelectedFuncId('');
    setFeedback(null);
    savePersistedSettings({ i64Url: '', selectedFuncId: '' });
    try {
      window.location.hash = '';
    } catch {
      // Ignore
    }
  };

  const handleCopyShareableUrl = () => {
    const base = window.location.origin + window.location.pathname;
    const fullShareUrl = `${base}?${urlParamMode}=${encodeURIComponent(i64UrlParam.trim())}`;
    navigator.clipboard.writeText(fullShareUrl);
    setCopiedShareUrl(true);
    setTimeout(() => setCopiedShareUrl(false), 2000);
  };

  const handleExportCurrentJson = () => {
    if (!database) return;
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = database.metadata.fileName.replace(/\.(i64|idb|gar|c|h|bndb|json)$/i, '');
    a.download = `${baseName}_project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export patched IDA Pro .i64 binary file with all function & variable renames applied!
  const handleExportPatchedI64 = () => {
    if (!database) return;
    const patchedBytes = buildPatchedIdaI64Binary(database, userEdits);
    const blob = new Blob([patchedBytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = database.metadata.fileName.replace(/\.(i64|idb|gar|c|h|bndb|json)$/i, '');
    a.download = `${baseName}_modified.i64`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isCSourceLoaded = Boolean(
    database?.metadata.isCSourceFile ||
      database?.metadata.fileName.toLowerCase().endsWith('.c') ||
      urlParamMode === 'c'
  );

  const isIdaI64Loaded = Boolean(
    database?.metadata.format.includes('IDA64') ||
      database?.metadata.fileName.toLowerCase().endsWith('.i64')
  );

  const handleExportSourceProject = () => {
    if (!database) return;
    const baseName = database.metadata.fileName.replace(/\.(i64|idb|gar|c|h|bndb|json)$/i, '');

    if (isCSourceLoaded) {
      const cSource = buildModifiedCFileExport(database, userEdits);
      const blob = new Blob([cSource], { type: 'text/x-c' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.c`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const cppSource = buildCompleteCppProjectExport(database);
    const blob = new Blob([cppSource], { type: 'text/x-c++src' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_full_project.cpp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isCodeMaximized = leftCollapsed && rightCollapsed && !centerCollapsed;
  const handleToggleCodeMaximize = () => {
    if (isCodeMaximized) {
      setLeftCollapsed(false);
      setRightCollapsed(false);
    } else {
      setLeftCollapsed(true);
      setRightCollapsed(true);
      setCenterCollapsed(false);
    }
  };

  const isCfgMaximized = leftCollapsed && centerCollapsed && !rightCollapsed;
  const handleToggleCfgMaximize = () => {
    if (isCfgMaximized) {
      setLeftCollapsed(false);
      setCenterCollapsed(false);
    } else {
      setLeftCollapsed(true);
      setCenterCollapsed(true);
      setRightCollapsed(false);
    }
  };

  const handleSwitchUrlParamMode = (nextMode: UrlParamMode) => {
    setUrlParamMode(nextMode);
    if (nextMode === 'c') {
      const cDump = parseGhidraCSourceFile(
        SAMPLE_GHIDRA_C_SOURCE,
        'CrazyTaxi_GhidraDecompiled.c',
        SAMPLE_GHIDRA_C_SOURCE.length,
        GHIDRA_C_DRIVE_VIEW_URL
      );
      setRawDatabase(cDump);
      if (cDump.functions[0]) setSelectedFuncId(cDump.functions[0].id);
      return;
    }
    if (rawDatabase && nextMode === 'gar' && !rawDatabase.metadata.format.includes('Ghidra Archive')) {
      const adapted = adaptDatabaseToGhidraFormat(
        rawDatabase,
        rawDatabase.metadata.fileName.replace(/\.(i64|idb|gar|c)$/i, '.gar')
      );
      setRawDatabase(adapted);
    } else if (rawDatabase && nextMode === 'i64') {
      const fullFunctions = buildFullCrazyTaxiFunctionList(CRAZY_TAXI_I64_DATABASE.functions);
      const classCount = new Set(fullFunctions.map((f) => f.className).filter(Boolean)).size;
      setRawDatabase({
        ...CRAZY_TAXI_I64_DATABASE,
        metadata: {
          ...CRAZY_TAXI_I64_DATABASE.metadata,
          totalFunctions: fullFunctions.length,
          totalClasses: classCount,
        },
        functions: fullFunctions,
      });
    }
  };

  const categoryCounts = useMemo(() => {
    if (!database) {
      return {
        all: 0,
        assigned: 0,
        largest: 0,
        entryCore: 0,
        commented: 0,
        sub: 0,
        classCount: 0,
        classMethodsCount: 0,
        globalFuncsCount: 0,
      };
    }
    let assigned = 0;
    let largest = 0;
    let entryCore = 0;
    let commented = 0;
    let sub = 0;
    let classMethodsCount = 0;
    let globalFuncsCount = 0;
    const classes = new Set<string>();

    for (const fn of database.functions) {
      if (isClearlyAssigned(fn)) assigned++;
      if (fn.sizeBytes >= 180 || fn.cfgNodes.length >= 4) largest++;
      if (isEntryOrCoreHook(fn)) entryCore++;
      if (hasMeaningfulComment(fn)) commented++;
      if (!fn.isRenamed) sub++;
      if (fn.className) {
        classes.add(fn.className);
        classMethodsCount++;
      } else {
        globalFuncsCount++;
      }
    }
    return {
      all: database.functions.length,
      assigned,
      largest,
      entryCore,
      commented,
      sub,
      classCount: classes.size,
      classMethodsCount,
      globalFuncsCount,
    };
  }, [database, isClearlyAssigned, isEntryOrCoreHook, hasMeaningfulComment]);

  const isGhidraLoaded = Boolean(database?.metadata.format.includes('Ghidra'));

  const renderSingleFunctionItem = (fn: DecompiledFunction, compactMethodView = false) => {
    const isSelected = activeFunction?.id === fn.id;
    const assigned = isClearlyAssigned(fn);
    const displayLabel =
      compactMethodView && fn.methodName ? `${fn.methodName}()` : fn.name;

    return (
      <button
        key={fn.id}
        ref={(el) => {
          functionItemRefs.current[fn.id] = el;
        }}
        type="button"
        onClick={() => handleSelectFunctionAndBlock(fn)}
        className={`w-full text-left px-3 py-2 transition-colors flex flex-col gap-1 ${
          compactMethodView ? 'pl-6 border-l-2 border-zinc-800' : ''
        } ${
          isSelected
            ? 'bg-[#FFCC00] text-black'
            : 'hover:bg-zinc-800/60 text-zinc-100'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                isSelected
                  ? 'bg-black text-[#FFCC00]'
                  : 'bg-zinc-900 text-[#FFCC00] border border-zinc-700'
              }`}
            >
              {fn.address}
            </span>
            {fn.className && !compactMethodView && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold truncate ${
                  isSelected
                    ? 'bg-black/20 text-black'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}
              >
                {fn.className}
              </span>
            )}
            {assigned && !fn.className && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  isSelected
                    ? 'bg-black/20 text-black'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {fn.tags[0] || 'Assigned'}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-mono shrink-0 ${
              isSelected ? 'text-black/80 font-semibold' : 'text-zinc-400'
            }`}
          >
            {fn.cfgNodes.length} {lang === 'de' ? 'Äste' : 'Br'} • {fn.sizeBytes}B
          </span>
        </div>

        <div
          className={`font-mono text-xs truncate ${
            isSelected
              ? 'text-black font-bold'
              : fn.isRenamed
              ? 'text-amber-100 font-medium'
              : 'text-zinc-300 font-normal'
          }`}
          title={fn.name}
        >
          {displayLabel}
        </div>

        {fn.comments && (
          <div
            className={`text-[11px] font-mono whitespace-pre-wrap break-words line-clamp-2 flex items-start gap-1 leading-snug ${
              isSelected ? 'text-black/90 font-medium' : 'text-emerald-400/90'
            }`}
            title={fn.comments}
          >
            <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{fn.comments}</span>
          </div>
        )}
      </button>
    );
  };

  const renderFunctionsPanel = () => {
    if (leftCollapsed) {
      return (
        <div
          key="panel-functions-collapsed"
          className="w-full md:w-10 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#10131B] flex md:flex-col items-center justify-between p-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => setLeftCollapsed(false)}
            className="p-1.5 rounded bg-[#FFCC00] text-black hover:bg-[#FFD633] transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs font-bold text-[#FFCC00] md:[writing-mode:vertical-rl] md:rotate-180 tracking-widest uppercase py-2">
            CLASSES ({groupedClasses.length}) &amp; FUNCTIONS ({standaloneFunctions.length})
          </span>
          <Database className="w-4 h-4 text-zinc-500 hidden md:block" />
        </div>
      );
    }

    return (
      <aside
        key="panel-functions"
        style={{ width: `${leftPanelWidth}px` }}
        className="border-r border-zinc-800 bg-[#0D0F15] flex flex-col min-h-0 shrink-0 select-text"
      >
        <div className="p-3 border-b border-zinc-800 space-y-2 bg-[#12151E]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-semibold tracking-wide text-[#FFCC00] flex items-center gap-1.5 truncate">
              <Database className="w-4 h-4 text-[#FFCC00] shrink-0" />
              {lang === 'de' ? 'Klassen & Funktionen' : 'Classes & Functions'} (
              {filteredFunctions.length.toLocaleString()})
            </span>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsGoToModalOpen(true)}
                className="px-2 py-0.5 rounded bg-zinc-900 text-[#FFCC00] border border-[#FFCC00]/60 hover:bg-[#FFCC00] hover:text-black text-[11px] font-mono font-bold transition-colors"
              >
                [G]
              </button>
              <button
                type="button"
                onClick={() => setLeftPanelWidth((w) => Math.max(180, w - 40))}
                disabled={leftPanelWidth <= 180}
                className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black disabled:opacity-40 transition-colors"
                title={lang === 'de' ? 'Panel schmaler' : 'Narrow panel'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLeftPanelWidth((w) => Math.min(800, w + 40))}
                disabled={leftPanelWidth >= 800}
                className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black disabled:opacity-40 transition-colors"
                title={lang === 'de' ? 'Panel breiter' : 'Widen panel'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLeftCollapsed(true)}
                className="p-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-[#FFCC00] hover:text-black transition-colors ml-0.5"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 bg-[#090B10] p-0.5 rounded border border-zinc-800">
            <button
              type="button"
              onClick={() => setSymbolTreeMode('TREE_SPLIT')}
              className={`text-[10px] font-mono py-1 px-1 rounded font-semibold transition-colors flex items-center justify-center gap-1 ${
                symbolTreeMode === 'TREE_SPLIT'
                  ? 'bg-[#FFCC00] text-black font-bold'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Folder className="w-3 h-3 shrink-0" />
              <span>Tree</span>
            </button>

            <button
              type="button"
              onClick={() => setSymbolTreeMode('CLASSES_ONLY')}
              className={`text-[10px] font-mono py-1 px-1 rounded font-semibold transition-colors flex items-center justify-center gap-1 ${
                symbolTreeMode === 'CLASSES_ONLY'
                  ? 'bg-[#FFCC00] text-black font-bold'
                  : 'text-sky-300 hover:text-white'
              }`}
            >
              <Box className="w-3 h-3 shrink-0" />
              <span>Classes</span>
            </button>

            <button
              type="button"
              onClick={() => setSymbolTreeMode('FUNCTIONS_ONLY')}
              className={`text-[10px] font-mono py-1 px-1 rounded font-semibold transition-colors flex items-center justify-center gap-1 ${
                symbolTreeMode === 'FUNCTIONS_ONLY'
                  ? 'bg-[#FFCC00] text-black font-bold'
                  : 'text-amber-200 hover:text-white'
              }`}
            >
              <FunctionSquare className="w-3 h-3 shrink-0" />
              <span>Funcs</span>
            </button>

            <button
              type="button"
              onClick={() => setSymbolTreeMode('FLAT_LIST')}
              className={`text-[10px] font-mono py-1 px-1 rounded font-semibold transition-colors flex items-center justify-center gap-1 ${
                symbolTreeMode === 'FLAT_LIST'
                  ? 'bg-[#FFCC00] text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Flat</span>
            </button>
          </div>

          {/* Compact Filter Toolbar with Expandable Category Drawer */}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setShowFiltersExpanded((v) => !v)}
              className={`flex-1 flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                filterMode !== 'ALL'
                  ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                  : 'bg-[#090B10] text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
              title={lang === 'de' ? 'Kategorie-Filter auf-/zuklappen' : 'Toggle Category Filters'}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span className="text-zinc-500 text-[10px]">Filter:</span>
                <span className="font-semibold truncate">
                  {filterMode === 'ALL' && `${lang === 'de' ? 'Alle' : 'All'} (${categoryCounts.all})`}
                  {filterMode === 'COMMENTED' && `💬 ${lang === 'de' ? 'Kommentare' : 'Comments'} (${categoryCounts.commented})`}
                  {filterMode === 'LARGEST' && `⚡ ${lang === 'de' ? 'Größte' : 'Largest'} (${categoryCounts.largest})`}
                  {filterMode === 'ASSIGNED' && `★ ${lang === 'de' ? 'Zugeordnet' : 'Assigned'} (${categoryCounts.assigned})`}
                  {filterMode === 'ENTRY_CORE' && `🎯 Core (${categoryCounts.entryCore})`}
                  {filterMode === 'SUB' && `${isGhidraLoaded ? 'FUN_' : 'sub_'} (${categoryCounts.sub})`}
                </span>
              </span>
              <span className="flex items-center gap-1 shrink-0 ml-1">
                {showFiltersExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </span>
            </button>

            <div className="flex items-center bg-[#090B10] border border-zinc-800 rounded px-1.5 py-1 shrink-0 max-w-[130px]">
              <ArrowUpDown className="w-3 h-3 text-[#FFCC00] shrink-0 mr-1" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-[11px] font-mono text-zinc-300 focus:outline-none cursor-pointer truncate w-full"
              >
                <option value="CLEARLY_ASSIGNED" className="bg-[#12151E] text-white">
                  {lang === 'de' ? '★ Zugeordnet' : '★ Assigned'}
                </option>
                <option value="SIZE_DESC" className="bg-[#12151E] text-white">
                  {lang === 'de' ? '⚡ Bytes ↓' : '⚡ Size ↓'}
                </option>
                <option value="BRANCHES_DESC" className="bg-[#12151E] text-white">
                  {lang === 'de' ? '🌿 Äste ↓' : '🌿 Branches ↓'}
                </option>
                <option value="ADDR_ASC" className="bg-[#12151E] text-white">
                  {lang === 'de' ? '🔢 Addr ↑' : '🔢 Addr ↑'}
                </option>
                <option value="NAME_ASC" className="bg-[#12151E] text-white">
                  {lang === 'de' ? '🔤 Name (A–Z)' : '🔤 Name (A–Z)'}
                </option>
              </select>
            </div>
          </div>

          {/* Collapsible Category Grid Drawer */}
          {showFiltersExpanded && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1 bg-[#090B10] rounded border border-zinc-800/80">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('ALL');
                  setVisibleLimit(400);
                  setShowFiltersExpanded(false);
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border text-left truncate transition-colors ${
                  filterMode === 'ALL'
                    ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                    : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {lang === 'de' ? 'Alle' : 'All'} ({categoryCounts.all})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterMode('COMMENTED');
                  setVisibleLimit(400);
                  setShowFiltersExpanded(false);
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border text-left truncate transition-colors ${
                  filterMode === 'COMMENTED'
                    ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                    : 'bg-zinc-900 text-emerald-300 border-zinc-800 hover:border-emerald-500/50'
                }`}
              >
                💬 {lang === 'de' ? 'Kommentare' : 'Comments'} ({categoryCounts.commented})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterMode('LARGEST');
                  setSortMode('SIZE_DESC');
                  setVisibleLimit(400);
                  setShowFiltersExpanded(false);
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border text-left truncate transition-colors ${
                  filterMode === 'LARGEST'
                    ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                    : 'bg-zinc-900 text-amber-300 border-zinc-800 hover:border-amber-500/50'
                }`}
              >
                ⚡ {lang === 'de' ? 'Größte' : 'Largest'} ({categoryCounts.largest})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterMode('ASSIGNED');
                  setSortMode('CLEARLY_ASSIGNED');
                  setVisibleLimit(400);
                  setShowFiltersExpanded(false);
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border text-left truncate transition-colors ${
                  filterMode === 'ASSIGNED'
                    ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                    : 'bg-zinc-900 text-sky-300 border-zinc-800 hover:border-sky-500/50'
                }`}
              >
                ★ {lang === 'de' ? 'Zugeordnet' : 'Assigned'} ({categoryCounts.assigned})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterMode('ENTRY_CORE');
                  setVisibleLimit(400);
                  setShowFiltersExpanded(false);
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border text-left truncate transition-colors ${
                  filterMode === 'ENTRY_CORE'
                    ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                    : 'bg-zinc-900 text-purple-300 border-zinc-800 hover:border-purple-500/50'
                }`}
              >
                🎯 Core ({categoryCounts.entryCore})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterMode('SUB');
                  setVisibleLimit(400);
                  setShowFiltersExpanded(false);
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border text-left truncate transition-colors ${
                  filterMode === 'SUB'
                    ? 'bg-[#FFCC00] text-black font-bold border-[#FFCC00]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {isGhidraLoaded ? 'FUN_' : 'sub_'} ({categoryCounts.sub})
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                handleJumpToFunctionOrAddress(searchQuery);
              }
            }}
            className="relative flex items-center gap-1"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(400);
              }}
              placeholder={
                lang === 'de'
                  ? `Suche Funktion, Kommentar, Adresse...`
                  : `Search Function, Comment, Address...`
              }
              className="w-full bg-[#090B10] border border-zinc-700 focus:border-[#FFCC00] rounded pl-8 pr-12 py-1 text-xs text-white placeholder-zinc-400 focus:outline-none font-mono"
            />
            {searchQuery.trim() && (
              <button
                type="submit"
                className="absolute right-1 px-1.5 py-0.5 rounded bg-[#FFCC00] text-black font-mono font-bold text-[9px] uppercase hover:bg-[#FFD633]"
              >
                Go
              </button>
            )}
          </form>
        </div>

        <div
          className="flex-1 overflow-y-auto divide-y divide-zinc-800/60"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (
              el.scrollHeight - el.scrollTop - el.clientHeight < 300 &&
              visibleLimit < filteredFunctions.length
            ) {
              setVisibleLimit((prev) => Math.min(filteredFunctions.length, prev + 400));
            }
          }}
        >
          {symbolTreeMode === 'FLAT_LIST' ? (
            <>{displayedFunctions.map((fn) => renderSingleFunctionItem(fn, false))}</>
          ) : (
            <>
              {(symbolTreeMode === 'TREE_SPLIT' || symbolTreeMode === 'CLASSES_ONLY') && (
                <div>
                  <button
                    type="button"
                    onClick={() => setClassesFolderOpen((v) => !v)}
                    className="w-full px-3 py-2 bg-[#151924] hover:bg-[#1B202E] flex items-center justify-between text-xs font-mono font-bold text-sky-300 border-b border-zinc-800 sticky top-0 z-10"
                  >
                    <span className="flex items-center gap-2">
                      {classesFolderOpen ? (
                        <FolderOpen className="w-4 h-4 text-[#FFCC00]" />
                      ) : (
                        <Folder className="w-4 h-4 text-[#FFCC00]" />
                      )}
                      <span>
                        {lang === 'de' ? 'CLASSES (Klassen)' : 'CLASSES'} ({groupedClasses.length})
                      </span>
                    </span>
                    <span className="text-[11px] bg-sky-500/20 text-sky-200 px-2 py-0.5 rounded border border-sky-500/30">
                      {groupedClasses.reduce((acc, [, list]) => acc + list.length, 0)}{' '}
                      {lang === 'de' ? 'Methoden' : 'Methods'}
                    </span>
                  </button>

                  {classesFolderOpen && (
                    <div className="divide-y divide-zinc-800/50">
                      {groupedClasses.map(([clsName, methods]) => {
                        const isExpanded =
                          Boolean(expandedClassNames[clsName]) ||
                          searchQuery.trim().length > 0 ||
                          methods.some((m) => m.id === activeFunction?.id);

                        return (
                          <div key={clsName} className="bg-[#0B0E14]">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedClassNames((prev) => ({
                                  ...prev,
                                  [clsName]: !isExpanded,
                                }))
                              }
                              className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
                            >
                              <span className="flex items-center gap-2 min-w-0 font-mono text-xs font-semibold text-amber-200 truncate">
                                <Box className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span className="truncate">{clsName}</span>
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400 shrink-0 flex items-center gap-1">
                                <span>{methods.length}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-[#FFCC00]" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                                )}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="divide-y divide-zinc-800/40 bg-[#080A0F]">
                                {methods
                                  .slice(0, 120)
                                  .map((fn) => renderSingleFunctionItem(fn, true))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {(symbolTreeMode === 'TREE_SPLIT' || symbolTreeMode === 'FUNCTIONS_ONLY') && (
                <div>
                  <button
                    type="button"
                    onClick={() => setFunctionsFolderOpen((v) => !v)}
                    className="w-full px-3 py-2 bg-[#151924] hover:bg-[#1B202E] flex items-center justify-between text-xs font-mono font-bold text-[#FFCC00] border-b border-zinc-800 sticky top-0 z-10"
                  >
                    <span className="flex items-center gap-2">
                      {functionsFolderOpen ? (
                        <FolderOpen className="w-4 h-4 text-[#FFCC00]" />
                      ) : (
                        <Folder className="w-4 h-4 text-[#FFCC00]" />
                      )}
                      <span>
                        {lang === 'de' ? 'FUNCTIONS (Globale Funktionen)' : 'FUNCTIONS'} (
                        {standaloneFunctions.length.toLocaleString()})
                      </span>
                    </span>
                    <span className="text-[11px] bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-zinc-700">
                      Global
                    </span>
                  </button>

                  {functionsFolderOpen && (
                    <div className="divide-y divide-zinc-800/60">
                      {standaloneFunctions
                        .slice(0, visibleLimit)
                        .map((fn) => renderSingleFunctionItem(fn, false))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-zinc-800 bg-[#0B0D13] flex items-center justify-between text-[11px] font-mono text-zinc-400 shrink-0">
          <span className="truncate">
            {groupedClasses.length} {lang === 'de' ? 'Klassen' : 'Classes'} •{' '}
            {standaloneFunctions.length} Funcs
          </span>
          <span className="text-[#FFCC00] font-medium shrink-0 ml-1">
            [G] Jump
          </span>
        </div>
      </aside>
    );
  };

  const renderPseudocodePanel = (isFlexibleCenter: boolean) => {
    if (!activeFunction || !database) return null;
    if (centerCollapsed) {
      return (
        <div
          key="panel-code-collapsed"
          className="w-full md:w-10 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#10131B] flex md:flex-col items-center justify-between p-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => setCenterCollapsed(false)}
            className="p-1.5 rounded bg-[#FFCC00] text-black hover:bg-[#FFD633] transition-colors"
          >
            <Code2 className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs font-bold text-[#FFCC00] md:[writing-mode:vertical-rl] md:rotate-180 tracking-widest uppercase py-2">
            {isCSourceLoaded
              ? `C SOURCE: ${activeFunction.name}`
              : `PSEUDOCODE (${activeFunction.name})`}
          </span>
          <Code2 className="w-4 h-4 text-zinc-500 hidden md:block" />
        </div>
      );
    }

    return (
      <main
        key="panel-code"
        style={
          isFlexibleCenter || isCodeMaximized || (leftCollapsed && rightCollapsed)
            ? undefined
            : { width: `${rightPanelWidth}px` }
        }
        className={`${
          isFlexibleCenter || isCodeMaximized || (leftCollapsed && rightCollapsed)
            ? 'flex-1 min-w-0'
            : ''
        } min-h-0 overflow-hidden shrink-0 select-text`}
      >
        <PseudocodeViewer
          func={activeFunction}
          allFunctions={database.functions}
          highlightedLines={highlightedLines}
          selectedIdentifier={selectedIdentifier}
          onSelectIdentifier={setSelectedIdentifier}
          onSelectLine={handleSelectPseudocodeLine}
          onJumpToFunction={handleJumpToFunctionOrAddress}
          onOpenGoToModal={() => setIsGoToModalOpen(true)}
          onRenameFunction={handleRenameFunction}
          onRenameVariable={handleRenameVariable}
          onChangeVariableType={handleChangeVariableType}
          onConvertLiteralValue={handleConvertLiteralValue}
          onUpdateFunctionComment={handleUpdateFunctionComment}
          onUpdateLineComment={handleUpdateLineComment}
          lang={lang}
          isMaximized={isCodeMaximized}
          onToggleMaximize={handleToggleCodeMaximize}
          onCollapse={() => {
            if (!leftCollapsed || !rightCollapsed) {
              setCenterCollapsed(true);
            }
          }}
        />
      </main>
    );
  };

  const renderCfgPanel = (isFlexibleCenter: boolean) => {
    if (!activeFunction) return null;
    if (rightCollapsed) {
      return (
        <div
          key="panel-cfg-collapsed"
          className="w-full md:w-10 border-t md:border-t-0 md:border-l border-zinc-800 bg-[#10131B] flex md:flex-col items-center justify-between p-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => setRightCollapsed(false)}
            className="p-1.5 rounded bg-[#FFCC00] text-black hover:bg-[#FFD633] transition-colors"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs font-bold text-[#FFCC00] md:[writing-mode:vertical-rl] md:rotate-180 tracking-widest uppercase py-2">
            CFG LOGIC TREE ({activeFunction.cfgNodes.length})
          </span>
          <GitFork className="w-4 h-4 text-zinc-500 hidden md:block" />
        </div>
      );
    }

    return (
      <aside
        key="panel-cfg"
        style={
          isFlexibleCenter || isCfgMaximized || (centerCollapsed && leftCollapsed)
            ? undefined
            : { width: `${rightPanelWidth}px` }
        }
        className={`${
          isFlexibleCenter || isCfgMaximized || (centerCollapsed && leftCollapsed)
            ? 'flex-1 min-w-0 border-r border-zinc-800'
            : ''
        } min-h-0 overflow-hidden shrink-0 select-text`}
      >
        <ControlFlowGraph
          func={activeFunction}
          activeNodeId={activeCfgNodeId}
          onSelectNode={handleSelectCfgNode}
          onJumpToFunction={handleJumpToFunctionOrAddress}
          lang={lang}
          maxBranches={maxBranches}
          onChangeMaxBranches={setMaxBranches}
          isMaximized={isCfgMaximized}
          onToggleMaximize={handleToggleCfgMaximize}
          onCollapse={() => setRightCollapsed(true)}
          onWiden={() => setRightPanelWidth((w) => Math.min(1000, w + 40))}
          onNarrow={() => setRightPanelWidth((w) => Math.max(200, w - 40))}
          canWiden={rightPanelWidth < 1000}
          canNarrow={rightPanelWidth > 200}
        />
      </aside>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090A0D] text-[#F8FAFC] overflow-hidden">
      {headerCollapsed ? (
        <div className="bg-[#0E1017] border-b-2 border-[#FFCC00] px-4 py-1.5 flex items-center justify-between gap-3 text-xs font-mono shrink-0 z-20 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <button
              type="button"
              onClick={() => setHeaderCollapsed(false)}
              className="p-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-[#FFCC00] hover:text-black transition-colors"
              title={lang === 'de' ? 'Oberes Menü ausklappen [M]' : 'Expand upper menu [M]'}
            >
              <PanelTopOpen className="w-3.5 h-3.5" />
            </button>
            <div className="w-1.5 h-6 bg-[#FFCC00] shrink-0 hidden sm:block" />
            <h1 className="font-bold tracking-wider text-xs md:text-sm text-white uppercase shrink-0">
              <span className="text-[#FFCC00]">LYRAS</span> PSEUDOCODE READER
            </h1>
            {database && (
              <>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/40 font-bold text-[11px] px-2 py-0.5 rounded uppercase tracking-wider hidden lg:inline-block">
                  {categoryCounts.classCount} CLASSES • {database.functions.length.toLocaleString()}{' '}
                  {lang === 'de' ? 'FUNKTIONEN' : 'FUNCTIONS'}
                </span>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="text-zinc-300 font-semibold truncate text-xs">
                  <strong className="text-[#FFCC00]">{lang === 'de' ? 'Datei:' : 'File:'}</strong>{' '}
                  {database.metadata.fileName}
                </span>
                {activeFunction && (
                  <>
                    <span className="text-zinc-600 hidden md:inline">•</span>
                    <span className="text-emerald-400 font-medium truncate text-xs hidden md:inline">
                      {activeFunction.address} — {activeFunction.name}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {database && (
              <button
                type="button"
                onClick={() => setIsGoToModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded bg-zinc-900 text-[#FFCC00] border border-[#FFCC00] hover:bg-[#FFCC00] hover:text-black transition-colors"
                title={lang === 'de' ? 'Gehe zu Adresse / Funktion [G]' : 'Go to address / function [G]'}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{lang === 'de' ? 'Adresse [G]' : 'Go to [G]'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsHotkeysModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-1 rounded bg-zinc-900 text-[#FFCC00] border border-[#FFCC00]/70 hover:bg-[#FFCC00] hover:text-black transition-colors"
              title="Keyboard Shortcuts & Hotkeys [?]"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Hotkeys</span>
            </button>

            <div className="inline-flex rounded border border-[#FFCC00] overflow-hidden bg-zinc-900">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 text-xs font-bold uppercase transition-colors ${
                  lang === 'en' ? 'bg-[#FFCC00] text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('de')}
                className={`px-2 py-0.5 text-xs font-bold uppercase transition-colors ${
                  lang === 'de' ? 'bg-[#FFCC00] text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                DE
              </button>
            </div>
          </div>
        </div>
      ) : (
        <header className="border-b-2 border-[#FFCC00] bg-[#0E1017] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-9 border-[3.5px] border-[#FFCC00] shrink-0" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-bold tracking-wider text-base md:text-lg text-white uppercase">
                  <span className="text-[#FFCC00]">LYRAS</span> PSEUDOCODE READER
                </h1>
                <span className="bg-[#FFCC00] text-black font-bold text-xs px-2.5 py-0.5 rounded uppercase tracking-wider">
                  {database
                    ? `${categoryCounts.classCount} CLASSES • ${database.functions.length.toLocaleString()} ${
                        lang === 'de' ? 'FUNKTIONEN' : 'FUNCTIONS'
                      }`
                    : lang === 'de'
                    ? '100% BROWSER .i64 / .gar / .c'
                    : '100% BROWSER .i64 / .gar / .c'}
                </span>
                {database && (
                  <span className="hidden sm:inline-block bg-zinc-800 text-zinc-200 border border-zinc-700 font-mono text-xs px-2 py-0.5 rounded">
                    {database.metadata.format}
                  </span>
                )}
                {database?.metadata.garNestedEntries &&
                  database.metadata.garNestedEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowGarContentsModal(true)}
                      className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-400 hover:text-black font-mono text-xs px-2 py-0.5 rounded font-semibold transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        .gar ({database.metadata.garNestedEntries.length} .gbf/.dat)
                      </span>
                    </button>
                  )}
              </div>
              <div className="text-xs font-mono text-zinc-300 flex flex-wrap items-center gap-2 mt-0.5">
                <span>
                  <strong className="text-[#FFCC00]">{lang === 'de' ? 'Datei:' : 'File:'}</strong>{' '}
                  {database
                    ? database.metadata.fileName
                    : lang === 'de'
                    ? 'Keine Datei geladen'
                    : 'No file loaded'}
                </span>
                <span>•</span>
                <span>
                  <strong className="text-[#FFCC00]">Range:</strong> {addressRangeText}
                </span>
                {database && (
                  <>
                    <span className="hidden lg:inline">•</span>
                    <span className="hidden lg:inline text-emerald-400 font-medium">
                      💬 {categoryCounts.commented} {lang === 'de' ? 'Kommentare' : 'Comments'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {database && (
              <>
                <button
                  type="button"
                  onClick={() => setIsGoToModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1.5 rounded bg-zinc-900 text-[#FFCC00] border border-[#FFCC00] hover:bg-[#FFCC00] hover:text-black transition-colors"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{lang === 'de' ? 'Adresse [G]' : 'Go to [G]'}</span>
                </button>

                <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded p-0.5">
                  <span className="px-2 text-[11px] font-mono text-zinc-400 hidden 2xl:inline-flex items-center gap-1">
                    <Layout className="w-3 h-3 text-[#FFCC00]" />
                    {lang === 'de' ? 'Anordnung:' : 'Layout:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutPreset('STANDARD');
                      setLeftSizeStep(3);
                      setRightSizeStep(3);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                      layoutPreset === 'STANDARD'
                        ? 'bg-[#FFCC00] text-black font-bold'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutPreset('IDA_PRO');
                      setLeftSizeStep(2);
                      setRightSizeStep(4);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                      layoutPreset === 'IDA_PRO'
                        ? 'bg-[#FFCC00] text-black font-bold'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    IDA Pro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutPreset('GHIDRA');
                      setLeftSizeStep(2);
                      setRightSizeStep(5);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                      layoutPreset === 'GHIDRA'
                        ? 'bg-[#FFCC00] text-black font-bold'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    Ghidra
                  </button>
                </div>
              </>
            )}

            <div className="inline-flex rounded border border-[#FFCC00] overflow-hidden bg-zinc-900">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                  lang === 'en' ? 'bg-[#FFCC00] text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('de')}
                className={`px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                  lang === 'de' ? 'bg-[#FFCC00] text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                DE
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowUrlBar((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
                showUrlBar
                  ? 'bg-zinc-800 text-[#FFCC00] border-[#FFCC00]'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:border-[#FFCC00]'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-[#FFCC00]" />
              ?{urlParamMode}= URL
              {showUrlBar ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#FFCC00]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".i64,.idb,.gar,.c,.h,.gbf,.dat,.db,.bndb,.json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded bg-[#FFCC00] text-black hover:bg-[#FFD633] transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              {lang === 'de' ? '.i64 / .gar / .c Laden' : 'Load .i64 / .gar / .c'}
            </button>

            {database && (
              <>
                {/* EXPORT PATCHED IDA .i64 BINARY */}
                {isIdaI64Loaded && !isCSourceLoaded && (
                  <button
                    type="button"
                    onClick={handleExportPatchedI64}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-amber-400 text-black hover:bg-amber-300 transition-colors shadow-sm"
                    title={
                      lang === 'de'
                        ? 'Exportiere aktualisierte IDA Pro (.i64) Datei inkl. aller geänderten Funktions- und Variablennamen'
                        : 'Export patched IDA Pro (.i64) file including all modified function and variable names'
                    }
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.2]" />
                    Export .i64
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportSourceProject}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-emerald-400 text-black hover:bg-emerald-300 transition-colors shadow-sm"
                >
                  <FileCode className="w-3.5 h-3.5 stroke-[2.2]" />
                  {isCSourceLoaded
                    ? lang === 'de'
                    ? 'Export .C Datei'
                    : 'Export .C File'
                    : 'Export C++ (.cpp)'}
                </button>

                <button
                  type="button"
                  onClick={handleExportCurrentJson}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded bg-zinc-800 text-[#FFCC00] border border-[#FFCC00]/60 hover:bg-[#FFCC00] hover:text-black transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON
                </button>

                <button
                  type="button"
                  onClick={handleClearDatabase}
                  className="p-1.5 rounded bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsPythonModalOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded bg-zinc-900 text-white border border-zinc-700 hover:border-[#FFCC00] hover:text-[#FFCC00] transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-[#FFCC00]" />
              .bat / GitHub Info
            </button>

            <button
              type="button"
              onClick={() => setIsHotkeysModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded bg-zinc-900 text-[#FFCC00] border border-[#FFCC00]/70 hover:bg-[#FFCC00] hover:text-black transition-colors shadow-sm"
              title="Keyboard Shortcuts & Hotkeys Reference [?]"
            >
              <Keyboard className="w-3.5 h-3.5 text-[#FFCC00]" />
              <span>Hotkeys</span>
            </button>

            {/* Collapse top menu button matching other panels */}
            <button
              type="button"
              onClick={() => setHeaderCollapsed(true)}
              title={lang === 'de' ? 'Oberes Menü einklappen [M]' : 'Collapse upper menu [M]'}
              className="p-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-[#FFCC00] hover:text-black transition-colors ml-0.5"
            >
              <PanelTopClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Collapsible URL Parameter Bar: Supports ?i64=, ?gar=, and ?c= (Saved in Cookies!) */}
      {!headerCollapsed && showUrlBar ? (
        <div className="bg-[#12151E] border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center gap-2 text-xs shrink-0">
          <div className="inline-flex items-center rounded border border-zinc-700 bg-[#090B10] p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSwitchUrlParamMode('i64')}
              className={`px-2 py-1 rounded font-mono text-xs font-bold transition-colors ${
                urlParamMode === 'i64'
                  ? 'bg-[#FFCC00] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              ?i64=
            </button>
            <button
              type="button"
              onClick={() => handleSwitchUrlParamMode('gar')}
              className={`px-2 py-1 rounded font-mono text-xs font-bold transition-colors ${
                urlParamMode === 'gar'
                  ? 'bg-[#FFCC00] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              ?gar=
            </button>
            <button
              type="button"
              onClick={() => handleSwitchUrlParamMode('c')}
              className={`px-2 py-1 rounded font-mono text-xs font-bold transition-colors ${
                urlParamMode === 'c'
                  ? 'bg-[#FFCC00] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              ?c=
            </button>
          </div>

          <input
            type="text"
            value={i64UrlParam}
            onChange={(e) => {
              setI64UrlParam(e.target.value);
              savePersistedSettings({ i64Url: e.target.value });
            }}
            placeholder={
              urlParamMode === 'c'
                ? lang === 'de'
                  ? 'Füge hier deine Google Drive oder GitHub Ghidra .c URL ein (?c=)...'
                  : 'Paste your Google Drive or GitHub Ghidra .c URL here (?c=)...'
                : urlParamMode === 'gar'
                ? lang === 'de'
                  ? 'Füge hier deine Google Drive oder GitHub Ghidra .gar URL ein (?gar=)...'
                  : 'Paste your Google Drive or GitHub Ghidra .gar URL here (?gar=)...'
                : lang === 'de'
                ? 'Füge hier deine Google Drive oder GitHub IDA .i64 / .json URL ein (?i64=)...'
                : 'Paste your Google Drive or GitHub IDA .i64 / .json URL here (?i64=)...'
            }
            className="flex-1 min-w-[200px] bg-[#090B10] border border-zinc-700 focus:border-[#FFCC00] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={() => analyzeRemoteUrl(i64UrlParam, urlParamMode)}
            className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-[#FFCC00] text-black hover:bg-[#FFD633] transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            {lang === 'de'
              ? `?${urlParamMode}= Analysieren`
              : `Analyze ?${urlParamMode}=`}
          </button>

          <button
            type="button"
            onClick={() => {
              setUrlParamMode('i64');
              setI64UrlParam(GOOGLE_DRIVE_VIEW_URL);
              analyzeRemoteUrl(GOOGLE_DRIVE_VIEW_URL, 'i64');
            }}
            className="inline-flex items-center gap-1 font-medium px-2 py-1.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700 hover:border-[#FFCC00] transition-colors"
          >
            <FileArchive className="w-3.5 h-3.5 text-[#FFCC00]" />
            Drive .i64
          </button>

          <button
            type="button"
            onClick={() => {
              setUrlParamMode('gar');
              setI64UrlParam(GHIDRA_GAR_DRIVE_VIEW_URL);
              analyzeRemoteUrl(GHIDRA_GAR_DRIVE_VIEW_URL, 'gar');
            }}
            className="inline-flex items-center gap-1 font-medium px-2 py-1.5 rounded bg-zinc-800 text-emerald-300 border border-zinc-700 hover:border-emerald-400 transition-colors"
          >
            <FileArchive className="w-3.5 h-3.5 text-emerald-400" />
            Drive .gar
          </button>

          <button
            type="button"
            onClick={() => {
              setUrlParamMode('c');
              setI64UrlParam(GHIDRA_C_DRIVE_VIEW_URL);
              analyzeRemoteUrl(GHIDRA_C_DRIVE_VIEW_URL, 'c');
            }}
            className="inline-flex items-center gap-1 font-medium px-2 py-1.5 rounded bg-zinc-800 text-sky-300 border border-zinc-700 hover:border-sky-400 transition-colors"
            title={GHIDRA_C_DRIVE_VIEW_URL}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            Drive .C (1Ry7D...)
          </button>

          {i64UrlParam.trim() && (
            <button
              type="button"
              onClick={handleCopyShareableUrl}
              className="inline-flex items-center gap-1 font-medium px-2.5 py-1.5 rounded bg-zinc-900 text-zinc-200 border border-zinc-700 hover:border-[#FFCC00] transition-colors"
            >
              {copiedShareUrl ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedShareUrl
                ? lang === 'de'
                  ? 'Kopiert!'
                  : 'Copied!'
                : `?${urlParamMode}= Link`}
            </button>
          )}
        </div>
      ) : null}

      {feedback && (
        <div
          className={`px-4 py-2 border-b flex flex-col gap-1.5 shrink-0 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
              : feedback.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/60 text-rose-100'
              : 'bg-amber-950/90 border-[#FFCC00] text-amber-100'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#FFCC00] shrink-0" />
              )}
              <div>
                <span className="font-bold mr-2">{feedback.title}</span>
                <span className="font-mono text-zinc-200">{feedback.details}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 rounded hover:bg-black/30 text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {feedback.type === 'loading' && typeof feedback.progressPercent === 'number' && (
            <div className="w-full h-1.5 bg-black/60 rounded overflow-hidden">
              <div
                className="h-full bg-[#FFCC00] transition-all duration-200"
                style={{ width: `${feedback.progressPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {!database || !activeFunction ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#090A0D] overflow-y-auto">
          <div className="max-w-3xl w-full bg-[#11141C] border-2 border-[#FFCC00] rounded-xl p-7 shadow-2xl space-y-6">
            <div className="flex items-center justify-between gap-3.5 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="w-4 h-11 border-4 border-[#FFCC00] shrink-0" />
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide uppercase">
                    Lyras Pseudocode Reader
                  </h2>
                  <p className="text-sm text-zinc-300 mt-0.5">
                    {lang === 'de'
                      ? '100% Browser-basierter IDA Pro (.i64), Ghidra (.gar) & Ghidra C (.c) Explorer (Kein Python nötig!)'
                      : '100% Browser-Native IDA Pro (.i64), Ghidra (.gar) & Ghidra C (.c) Explorer (No Python Needed!)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSeoModalOpen(true)}
                className="px-3 py-1.5 rounded bg-zinc-900 text-[#FFCC00] border border-[#FFCC00]/60 hover:bg-[#FFCC00] hover:text-black text-xs font-mono font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {lang === 'de' ? 'SEO Unterseiten' : 'SEO Subpages'}
              </button>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              {lang === 'de'
                ? 'Lade deine IDA Pro (.i64), Ghidra (.gar) oder Ghidra (.c) Datei direkt im Browser ohne Python! Doppelklicke im Code auf beliebige Variablen oder Werte, um den Typ (float, int, enum, String, Hex) automatisch umzurechnen, und exportiere dein Ergebnis wieder als .i64, .c, .cpp oder .json.'
                : 'Load your IDA Pro (.i64), Ghidra (.gar), or Ghidra (.c) file directly in the browser without Python! Double-click any variable or value in the code to automatically calculate & convert types (float, int, enum, String, Hex), and export back as .i64, .c, .cpp, or .json.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-[#FFCC00] text-black hover:bg-[#FFD633] transition-colors font-bold text-xs shadow-md text-center"
              >
                <Upload className="w-5 h-5 stroke-[2.2]" />
                <span>
                  {lang === 'de'
                    ? 'Lokale .i64 / .gar / .c laden'
                    : 'Load Local .i64 / .gar / .c'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUrlParamMode('i64');
                  setI64UrlParam(GOOGLE_DRIVE_VIEW_URL);
                  analyzeRemoteUrl(GOOGLE_DRIVE_VIEW_URL, 'i64');
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-zinc-900 text-white border border-zinc-700 hover:border-[#FFCC00] transition-colors font-semibold text-xs text-center"
              >
                <Globe className="w-5 h-5 text-[#FFCC00]" />
                <span>IDA .i64 (?i64=)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUrlParamMode('gar');
                  setI64UrlParam(GHIDRA_GAR_DRIVE_VIEW_URL);
                  analyzeRemoteUrl(GHIDRA_GAR_DRIVE_VIEW_URL, 'gar');
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-zinc-900 text-emerald-300 border border-zinc-700 hover:border-emerald-400 transition-colors font-semibold text-xs text-center"
              >
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>Ghidra .gar (?gar=)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUrlParamMode('c');
                  setI64UrlParam(GHIDRA_C_DRIVE_VIEW_URL);
                  analyzeRemoteUrl(GHIDRA_C_DRIVE_VIEW_URL, 'c');
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-zinc-900 text-sky-300 border border-zinc-700 hover:border-sky-400 transition-colors font-semibold text-xs text-center"
              >
                <FileCode className="w-5 h-5 text-sky-400" />
                <span>Ghidra .C (?c=)</span>
              </button>
            </div>

            <div className="pt-3 border-t border-zinc-800 space-y-2.5">
              <div className="text-xs font-mono uppercase text-zinc-400">
                {lang === 'de'
                  ? 'Beliebte Reverse-Engineering Themen & Unterseiten:'
                  : 'Popular Reverse-Engineering Topics & Subpages:'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SEO_SUBPAGES.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => {
                      window.location.hash = `seo=${sub.slug}`;
                      setIsSeoModalOpen(true);
                    }}
                    className="text-left p-2.5 rounded bg-[#0D1017] border border-zinc-800 hover:border-[#FFCC00]/60 transition-colors"
                  >
                    <div className="text-xs font-bold text-[#FFCC00] truncate">
                      {lang === 'de' ? sub.titleDe : sub.titleEn}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {sub.keywords.join(' • ')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
          {layoutPreset === 'STANDARD' && (
            <>
              {renderFunctionsPanel()}
              {!leftCollapsed && (
                <div
                  onMouseDown={handleMouseDownLeftSplitter}
                  className={`hidden md:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group shrink-0 select-none hover:bg-[#FFCC00]/40 transition-colors ${
                    isDraggingLeft ? 'bg-[#FFCC00]' : 'bg-transparent'
                  }`}
                  title={lang === 'de' ? 'Seitenleiste mit Maus ziehen' : 'Drag to resize sidebar'}
                >
                  <div className="w-0.5 h-8 rounded bg-zinc-600 group-hover:bg-[#FFCC00] transition-colors" />
                </div>
              )}
              {renderPseudocodePanel(true)}
              {!rightCollapsed && !isCfgMaximized && (
                <div
                  onMouseDown={handleMouseDownRightSplitter}
                  className={`hidden md:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group shrink-0 select-none hover:bg-[#FFCC00]/40 transition-colors ${
                    isDraggingRight ? 'bg-[#FFCC00]' : 'bg-transparent'
                  }`}
                  title={lang === 'de' ? 'Seitenleiste mit Maus ziehen' : 'Drag to resize sidebar'}
                >
                  <div className="w-0.5 h-8 rounded bg-zinc-600 group-hover:bg-[#FFCC00] transition-colors" />
                </div>
              )}
              {renderCfgPanel(false)}
            </>
          )}

          {layoutPreset === 'IDA_PRO' && (
            <>
              {renderFunctionsPanel()}
              {!leftCollapsed && (
                <div
                  onMouseDown={handleMouseDownLeftSplitter}
                  className={`hidden md:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group shrink-0 select-none hover:bg-[#FFCC00]/40 transition-colors ${
                    isDraggingLeft ? 'bg-[#FFCC00]' : 'bg-transparent'
                  }`}
                  title={lang === 'de' ? 'Seitenleiste mit Maus ziehen' : 'Drag to resize sidebar'}
                >
                  <div className="w-0.5 h-8 rounded bg-zinc-600 group-hover:bg-[#FFCC00] transition-colors" />
                </div>
              )}
              {renderCfgPanel(true)}
              {!rightCollapsed && !isCodeMaximized && (
                <div
                  onMouseDown={handleMouseDownRightSplitter}
                  className={`hidden md:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group shrink-0 select-none hover:bg-[#FFCC00]/40 transition-colors ${
                    isDraggingRight ? 'bg-[#FFCC00]' : 'bg-transparent'
                  }`}
                  title={lang === 'de' ? 'Seitenleiste mit Maus ziehen' : 'Drag to resize sidebar'}
                >
                  <div className="w-0.5 h-8 rounded bg-zinc-600 group-hover:bg-[#FFCC00] transition-colors" />
                </div>
              )}
              {renderPseudocodePanel(false)}
            </>
          )}

          {layoutPreset === 'GHIDRA' && (
            <>
              {renderFunctionsPanel()}
              {!leftCollapsed && (
                <div
                  onMouseDown={handleMouseDownLeftSplitter}
                  className={`hidden md:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group shrink-0 select-none hover:bg-[#FFCC00]/40 transition-colors ${
                    isDraggingLeft ? 'bg-[#FFCC00]' : 'bg-transparent'
                  }`}
                  title={lang === 'de' ? 'Seitenleiste mit Maus ziehen' : 'Drag to resize sidebar'}
                >
                  <div className="w-0.5 h-8 rounded bg-zinc-600 group-hover:bg-[#FFCC00] transition-colors" />
                </div>
              )}
              {renderCfgPanel(false)}
              {!rightCollapsed && (
                <div
                  onMouseDown={handleMouseDownRightSplitter}
                  className={`hidden md:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group shrink-0 select-none hover:bg-[#FFCC00]/40 transition-colors ${
                    isDraggingRight ? 'bg-[#FFCC00]' : 'bg-transparent'
                  }`}
                  title={lang === 'de' ? 'Seitenleiste mit Maus ziehen' : 'Drag to resize sidebar'}
                >
                  <div className="w-0.5 h-8 rounded bg-zinc-600 group-hover:bg-[#FFCC00] transition-colors" />
                </div>
              )}
              {renderPseudocodePanel(true)}
            </>
          )}
        </div>
      )}

      <footer className="h-8 border-t border-zinc-800 bg-[#0B0D13] px-4 flex items-center justify-between text-xs text-zinc-300 shrink-0 z-20">
        <div className="flex items-center gap-3 font-mono">
          <span className="inline-flex items-center gap-1.5 text-[#FFCC00] font-medium">
            <Eye className="w-3.5 h-3.5" />
            {lang === 'de'
              ? 'Eindeutige Besucher (1x pro Person):'
              : 'Unique Visitors (1x per person):'}{' '}
            <strong className="bg-[#FFCC00] text-black px-1.5 py-0.2 rounded font-bold">
              {visitorInfo.count.toLocaleString()}
            </strong>
          </span>
          <span className="hidden sm:inline text-zinc-500">•</span>
          <span className="hidden sm:inline text-zinc-400">
            {lang === 'de'
              ? `URL & Edits im Cookie gespeichert • Doppelklick auf Wert = Typ-Rechner`
              : `URL & Edits saved in Cookie • Double-click value = Type Calculator`}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <button
            type="button"
            onClick={() => setIsSeoModalOpen(true)}
            className="inline-flex items-center gap-1 text-[#FFCC00] hover:underline font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            SEO Subpages
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setSeoFileModal('robots')}
            className="inline-flex items-center gap-1 text-zinc-300 hover:text-[#FFCC00] transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-[#FFCC00]" />
            bots.txt
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setSeoFileModal('sitemap')}
            className="inline-flex items-center gap-1 text-zinc-300 hover:text-[#FFCC00] transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5 text-[#FFCC00]" />
            sitemap.xml
          </button>
        </div>
      </footer>

      <SeoDirectoryModal
        isOpen={isSeoModalOpen}
        onClose={() => setIsSeoModalOpen(false)}
        lang={lang}
        onLoadPresetDatabase={(mode) => {
          setUrlParamMode(mode);
          const targetUrl =
            mode === 'gar' ? GHIDRA_GAR_DRIVE_VIEW_URL : GOOGLE_DRIVE_VIEW_URL;
          setI64UrlParam(targetUrl);
          analyzeRemoteUrl(targetUrl, mode);
        }}
      />

      {showGarContentsModal && database?.metadata.garNestedEntries && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowGarContentsModal(false)}
        >
          <div
            className="bg-[#11141C] border-2 border-[#FFCC00] rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-[#FFCC00]" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {lang === 'de'
                      ? `Verschachtelte Dateien im Ghidra .gar Archiv (${database.metadata.fileName})`
                      : `Nested Files Unpacked from Ghidra .gar Archive (${database.metadata.fileName})`}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    .gar ZIP Container → .rep/idata/*.gbf (B-Tree DB), *.dat &amp; *.prp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGarContentsModal(false)}
                className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded bg-[#090B10]">
              {database.metadata.garNestedEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 font-mono text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        entry.entryType === 'db.gbf'
                          ? 'bg-emerald-400 text-black'
                          : entry.entryType === 'data.dat'
                          ? 'bg-sky-400 text-black'
                          : 'bg-[#FFCC00] text-black'
                      }`}
                    >
                      {entry.entryType}
                    </span>
                    <span className="text-zinc-100 truncate">{entry.path}</span>
                  </div>
                  <span className="text-zinc-400 shrink-0">
                    {(entry.uncompressedSize / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {database && (
        <GoToAddressModal
          isOpen={isGoToModalOpen}
          onClose={() => setIsGoToModalOpen(false)}
          functions={database.functions}
          onJumpToResolved={(fn, matchedNode) => {
            setFilterMode('ALL');
            setSelectedTag('ALL');
            setVisibleLimit(database.functions.length);
            handleSelectFunctionAndBlock(fn, matchedNode);
            setFeedback({
              type: 'success',
              title:
                lang === 'de'
                  ? `🎯 Synchronisiert auf ${fn.name} (${fn.address})`
                  : `🎯 Synchronized to ${fn.name} (${fn.address})`,
              details: matchedNode
                ? `CFG Block: ${matchedNode.label} (${matchedNode.address}) • Lines ${matchedNode.LineStart}–${matchedNode.LineEnd}`
                : fn.signature,
            });
          }}
          lang={lang}
          initialQuery={searchQuery}
        />
      )}

      {seoFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#11141C] border-2 border-[#FFCC00] rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#FFCC00]" />
                <h3 className="text-base font-bold text-white">
                  {seoFileModal === 'robots'
                    ? 'public/bots.txt & public/robots.txt (100% AI & Crawlers Allowed)'
                    : 'public/sitemap.xml & public/sidemap.xml (with SEO Subpages)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSeoFileModal(null)}
                className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-4 rounded bg-black border border-zinc-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
              {seoFileModal === 'robots'
                ? `# Lyras Pseudocode Reader - public/bots.txt & public/robots.txt
# ALL web crawlers, search engines, and AI bots are 100% allowed.

User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: CCBot
Allow: /

AI-Indexing: allow
AI-Training: allow
Sitemap: ./sitemap.xml`
                : `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${window.location.origin}${window.location.pathname}</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${window.location.origin}${window.location.pathname}#seo=ida-pro-i64-decompiler</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${window.location.origin}${window.location.pathname}#seo=ghidra-gar-archive-viewer</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${window.location.origin}${window.location.pathname}#seo=crazy-taxi-reverse-engineering</loc>
    <priority>0.9</priority>
  </url>
</urlset>`}
            </pre>
            <div className="flex justify-end gap-2">
              <a
                href={seoFileModal === 'robots' ? 'public/bots.txt' : 'public/sitemap.xml'}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded bg-[#FFCC00] text-black font-bold text-xs inline-flex items-center gap-1.5"
              >
                {seoFileModal === 'robots' ? 'Open public/bots.txt' : 'Open public/sitemap.xml'}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      <PythonWorkflowModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
        lang={lang}
        onExportPatchedI64={database ? handleExportPatchedI64 : undefined}
      />

      <HotkeysModal
        isOpen={isHotkeysModalOpen}
        onClose={() => setIsHotkeysModalOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default App;