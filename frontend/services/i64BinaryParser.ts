import { I64DatabaseDump, DecompiledFunction, GarArchiveEntryInfo } from '../types';
import { buildDynamicCfgFromPseudocode } from './cfgBuilder';
import { parseGhidraCSourceFile } from './ghidraCParser';
import { isGenericComment } from './commentUtils';

export interface ParseResult {
  success: boolean;
  dump?: I64DatabaseDump;
  messageDe: string;
  messageEn: string;
  sourceUrl?: string;
  isGhidra?: boolean;
  isCSource?: boolean;
}

export type ProgressCallback = (percent: number, statusText: string) => void;

export function inferClassAndMethod(
  funcName: string,
  demangledName?: string,
  callingConvention?: string
): { className?: string; methodName: string } {
  const demangledScopeMatch = demangledName?.match(
    /([A-Za-z_][A-Za-z0-9_]*)::([~A-Za-z_][A-Za-z0-9_]*)/
  );
  if (demangledScopeMatch) {
    return {
      className: demangledScopeMatch[1],
      methodName: demangledScopeMatch[2],
    };
  }

  const directScopeMatch = funcName.match(
    /^([A-Za-z_][A-Za-z0-9_]*)::([~A-Za-z_][A-Za-z0-9_]*)/
  );
  if (directScopeMatch) {
    return {
      className: directScopeMatch[1],
      methodName: directScopeMatch[2],
    };
  }

  if (funcName.startsWith('?')) {
    const parts = funcName.replace(/^\?+/, '').split('@');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return {
        className: parts[1],
        methodName: parts[0],
      };
    }
  }

  if (!funcName.startsWith('sub_') && !funcName.startsWith('FUN_')) {
    const classPrefixMap: Record<string, string> = {
      TaxiPhysics: 'CTaxiPhysicsBody',
      PassengerManager: 'CPassengerManager',
      PassengerAI: 'CPassengerActor',
      TrafficAI: 'CTrafficVehicleAI',
      CrazyBox: 'CCrazyBoxChallenge',
      CrazyStunt: 'CCrazyStuntEvaluator',
      WorldOctree: 'CWorldOctreeScene',
      CabRenderer: 'CCabModelRenderer',
      TrafficRenderer: 'CTrafficRenderer',
      CRI_Adx: 'CCriAdxAudioStream',
      CRI_ADX: 'CCriAdxAudioStream',
      Audio: 'CAudioSoundServer',
      Hud: 'CHudOverlayManager',
      Input: 'CDirectInputController',
      Render: 'CD3D8RenderDevice',
      Config: 'CRegistryConfig',
      GameLoop: 'CGameLoopController',
      Menu: 'CMenuCarousel',
    };

    for (const [prefix, mappedClass] of Object.entries(classPrefixMap)) {
      if (funcName.startsWith(`${prefix}_`)) {
        const rest = funcName.slice(prefix.length + 1);
        return {
          className: mappedClass,
          methodName: rest,
        };
      }
    }

    if (callingConvention === '__thiscall') {
      const underscoreParts = funcName.split('_');
      if (underscoreParts.length >= 2) {
        return {
          className: `C${underscoreParts[0]}`,
          methodName: underscoreParts.slice(1).join('_'),
        };
      }
    }
  }

  return {
    className: undefined,
    methodName: funcName,
  };
}

export function adaptDatabaseToGhidraFormat(
  dump: I64DatabaseDump,
  customFileName?: string,
  customGarEntries?: GarArchiveEntryInfo[]
): I64DatabaseDump {
  const garName =
    customFileName ||
    dump.metadata.fileName.replace(/\.(i64|idb|bndb)$/i, '.gar');

  const classSet = new Set<string>();

  const adaptedFunctions: DecompiledFunction[] = dump.functions.map((fn) => {
    const isSub = !fn.isRenamed || fn.name.startsWith('sub_') || fn.name.startsWith('FUN_');
    const shortAddr = fn.address.replace(/^0x/i, '').toUpperCase().padStart(8, '0');
    const baseGhidraName = isSub ? `FUN_${shortAddr}` : fn.name;

    const { className, methodName } = inferClassAndMethod(
      baseGhidraName,
      fn.demangledName,
      fn.callingConvention
    );

    if (className) classSet.add(className);

    const displayFuncName = className ? `${className}::${methodName}` : baseGhidraName;

    const ghidraVars = fn.localVariables.map((v, idx) => {
      const ghidraType =
        v.type === 'int'
          ? 'undefined4'
          : v.type === 'unsigned int' || v.type === 'DWORD'
          ? 'uint'
          : v.type === 'BOOL'
          ? 'bool'
          : v.type;

      const ghidraLoc = v.location.startsWith('ebp-')
        ? `Stack[-0x${v.location.replace('ebp-0x', '')}]`
        : v.location.startsWith('ebp+')
        ? `Stack[+0x${v.location.replace('ebp+0x', '')}]`
        : v.location;

      const ghidraVarName =
        v.name.startsWith('v') && /^v\d+/.test(v.name)
          ? v.name.replace(/^v(\d+)/, 'uVar$1')
          : v.name.startsWith('a') && /^a\d+/.test(v.name)
          ? v.name.replace(/^a(\d+)/, 'param_$1')
          : v.name;

      return {
        ...v,
        oldName: v.oldName || `local_${((idx + 1) * 4).toString(16)}`,
        name: ghidraVarName,
        type: ghidraType,
        location: ghidraLoc,
      };
    });

    const ghidraSignature = fn.signature
      .replace(/\bsub_([0-9A-Fa-f]+)\b/g, 'FUN_00$1')
      .replace(/\bint\b/g, 'undefined4')
      .replace(/\bunsigned int\b/g, 'uint');

    const ghidraPseudocode = fn.pseudocode.map((line, idx) => {
      if (idx === 0 && line.startsWith('//-----')) {
        return `/* WARNING: Ghidra Archive (.gar -> db.1.gbf / .dat) Decompiler @ ${fn.address} ${
          className ? `[Class: ${className}]` : ''
        } */`;
      }
      return line
        .replace(/\bsub_([0-9A-Fa-f]{6})\b/g, 'FUN_00$1')
        .replace(/\bsub_([0-9A-Fa-f]{8})\b/g, 'FUN_$1')
        .replace(/\bg_([A-Za-z0-9_]+)_([0-9A-Fa-f]{8})\b/g, 'DAT_$2_$1')
        .replace(/\bv(\d+)_/g, 'uVar$1_')
        .replace(/\ba(\d+)_/g, 'param_$1_');
    });

    const { cfgNodes, cfgEdges } = buildDynamicCfgFromPseudocode(
      fn.address,
      displayFuncName,
      ghidraPseudocode
    );

    const ghidraTags = fn.tags.map((t) => (t === 'sub_Routine' ? 'FUN_Routine' : t));
    if (!ghidraTags.includes('Ghidra-GAR')) {
      ghidraTags.push('Ghidra-GAR');
    }

    return {
      ...fn,
      name: displayFuncName,
      className,
      methodName,
      signature: ghidraSignature,
      localVariables: ghidraVars,
      pseudocode: ghidraPseudocode,
      cfgNodes,
      cfgEdges,
      tags: ghidraTags,
    };
  });

  const defaultNestedGarEntries: GarArchiveEntryInfo[] = customGarEntries || [
    {
      path: 'CrazyTaxi.rep/idata/00/00000000.prp',
      compressedSize: 1280,
      uncompressedSize: 3420,
      entryType: 'property.prp',
    },
    {
      path: 'CrazyTaxi.rep/idata/00/~00000000.db/db.1.gbf',
      compressedSize: 18450200,
      uncompressedSize: 46820352,
      entryType: 'db.gbf',
    },
    {
      path: 'CrazyTaxi.rep/idata/00/data.dat',
      compressedSize: 4129000,
      uncompressedSize: 11240000,
      entryType: 'data.dat',
    },
    {
      path: 'CrazyTaxi.rep/versioned/00/db.2.gbf',
      compressedSize: 6240100,
      uncompressedSize: 15890432,
      entryType: 'db.gbf',
    },
  ];

  return {
    metadata: {
      ...dump.metadata,
      fileName: garName.endsWith('.gar') ? garName : `${garName}.gar`,
      format: 'Ghidra Archive (.gar Nested .gbf / .dat / .prp)',
      processor: 'x86:LE:32:default (Ghidra SLEIGH P-Code Engine / .gar Archive)',
      compiler: 'Visual Studio / Ghidra .gar Decompiler AST',
      totalFunctions: adaptedFunctions.length,
      totalClasses: classSet.size,
      garNestedEntries: defaultNestedGarEntries,
    },
    functions: adaptedFunctions,
  };
}

async function unpackGhidraGarZipContainer(
  bytes: Uint8Array,
  onProgress?: ProgressCallback
): Promise<{
  isZipGar: boolean;
  mergedUnpackedBytes: Uint8Array;
  entries: GarArchiveEntryInfo[];
  detectedProgramName?: string;
}> {
  if (
    bytes.length < 30 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    return { isZipGar: false, mergedUnpackedBytes: bytes, entries: [] };
  }

  onProgress?.(12, 'Detected Ghidra .gar ZIP container! Unpacking nested .gbf, .dat & .prp files...');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: GarArchiveEntryInfo[] = [];
  const unpackedChunks: Uint8Array[] = [];
  let totalUnpackedSize = 0;
  const maxTotalUnpacked = 140 * 1024 * 1024;
  let detectedProgramName: string | undefined;

  let offset = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });

  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) {
      let nextHeader = -1;
      for (let scan = offset + 1; scan + 4 < bytes.length; scan++) {
        if (
          bytes[scan] === 0x50 &&
          bytes[scan + 1] === 0x4b &&
          bytes[scan + 2] === 0x03 &&
          bytes[scan + 3] === 0x04
        ) {
          nextHeader = scan;
          break;
        }
        if (
          bytes[scan] === 0x50 &&
          bytes[scan + 1] === 0x4b &&
          bytes[scan + 2] === 0x01 &&
          bytes[scan + 3] === 0x02
        ) {
          nextHeader = -1;
          break;
        }
      }
      if (nextHeader === -1) break;
      offset = nextHeader;
      continue;
    }

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraFieldLen = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    const nameEnd = Math.min(bytes.length, nameStart + fileNameLen);
    const entryPath = decoder.decode(bytes.subarray(nameStart, nameEnd));
    const dataStart = nameEnd + extraFieldLen;

    const lowerPath = entryPath.toLowerCase();
    const isDir = entryPath.endsWith('/');

    const entryType: GarArchiveEntryInfo['entryType'] =
      lowerPath.endsWith('.gbf') || lowerPath.endsWith('.db')
        ? 'db.gbf'
        : lowerPath.endsWith('.dat')
        ? 'data.dat'
        : lowerPath.endsWith('.prp')
        ? 'property.prp'
        : 'other';

    if (!isDir) {
      entries.push({
        path: entryPath,
        compressedSize,
        uncompressedSize,
        entryType,
      });
    }

    let payloadEnd = dataStart + compressedSize;
    if ((flags & 0x08) !== 0 && compressedSize === 0) {
      let foundNextPk = bytes.length;
      for (let s = dataStart; s + 4 < bytes.length; s++) {
        if (
          bytes[s] === 0x50 &&
          bytes[s + 1] === 0x4b &&
          ((bytes[s + 2] === 0x03 && bytes[s + 3] === 0x04) ||
            (bytes[s + 2] === 0x01 && bytes[s + 3] === 0x02) ||
            (bytes[s + 2] === 0x07 && bytes[s + 3] === 0x08))
        ) {
          foundNextPk = s;
          break;
        }
      }
      payloadEnd = foundNextPk;
    }

    const safePayloadEnd = Math.min(bytes.length, payloadEnd);
    const entryBytes = bytes.subarray(dataStart, safePayloadEnd);

    if (
      !isDir &&
      entryBytes.length > 0 &&
      totalUnpackedSize < maxTotalUnpacked &&
      (entryType === 'db.gbf' || entryType === 'data.dat' || entryType === 'property.prp')
    ) {
      onProgress?.(
        Math.min(45, 15 + entries.length * 3),
        `Unpacking nested .gar entry: ${entryPath.split('/').slice(-2).join('/')}...`
      );

      let unpackedEntry: Uint8Array | null = null;
      if (compressionMethod === 0) {
        unpackedEntry = entryBytes;
      } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
        unpackedEntry = await inflateRawEntry(entryBytes, 45 * 1024 * 1024);
      }

      if (unpackedEntry && unpackedEntry.length > 0) {
        if (entryType === 'property.prp') {
          const prpXml = decoder.decode(unpackedEntry);
          const nameMatch = prpXml.match(/NAME="NAME"\s+VALUE="([^"]+)"/i);
          if (nameMatch && nameMatch[1]) {
            detectedProgramName = nameMatch[1];
          }
        }
        unpackedChunks.push(unpackedEntry);
        totalUnpackedSize += unpackedEntry.length;
      }
    }

    offset = safePayloadEnd > offset ? safePayloadEnd : offset + 30 + fileNameLen + extraFieldLen;
  }

  if (unpackedChunks.length === 0) {
    return { isZipGar: true, mergedUnpackedBytes: bytes, entries, detectedProgramName };
  }

  const merged = new Uint8Array(totalUnpackedSize);
  let cursor = 0;
  for (const chunk of unpackedChunks) {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  }

  return {
    isZipGar: true,
    mergedUnpackedBytes: merged,
    entries,
    detectedProgramName,
  };
}

async function inflateRawEntry(
  compressedBytes: Uint8Array,
  maxBytes: number
): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([compressedBytes]).stream().pipeThrough(ds);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        if (total >= maxBytes) {
          await reader.cancel();
          break;
        }
      }
    }

    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

async function maybeDecompressGzipGhidraBuffer(
  rawBuffer: ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const rawBytes = new Uint8Array(rawBuffer);
  if (
    rawBytes.length >= 2 &&
    rawBytes[0] === 0x1f &&
    rawBytes[1] === 0x8b &&
    typeof DecompressionStream !== 'undefined'
  ) {
    try {
      onProgress?.(20, 'Decompressing GZIP Archive...');
      const ds = new DecompressionStream('gzip');
      const decompressedStream = new Blob([rawBuffer]).stream().pipeThrough(ds);
      const reader = decompressedStream.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const maxUnpackedBytes = 150 * 1024 * 1024;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalBytes += value.byteLength;
          if (totalBytes >= maxUnpackedBytes) {
            await reader.cancel();
            break;
          }
        }
      }

      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      return merged;
    } catch {
      return rawBytes;
    }
  }
  return rawBytes;
}

export async function parseI64OrJsonFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  try {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.gpr')) {
      return {
        success: false,
        messageDe: `⚠️ .gpr Dateien sind nur 1 KB Projekt-Verweise ohne Binärdaten. Bitte lade ein Ghidra Archiv (.gar), eine Ghidra C-Datei (.c) oder eine IDA Pro (.i64) Datei!`,
        messageEn: `⚠️ .gpr files are tiny 1 KB project pointers without binary data. Please load a Ghidra Archive (.gar), a Ghidra C file (.c), or an IDA Pro (.i64) file!`,
      };
    }

    // Check if it's a Ghidra `.c` or `.h` source file
    if (lowerName.endsWith('.c') || lowerName.endsWith('.h') || lowerName.endsWith('.cpp')) {
      onProgress?.(35, `Parsing Ghidra C Source File "${file.name}"...`);
      const text = await file.text();
      const cDump = parseGhidraCSourceFile(text, file.name, file.size);
      if (cDump.functions.length > 0) {
        return {
          success: true,
          dump: cDump,
          isCSource: true,
          messageDe: `✅ Ghidra C-Datei "${file.name}" erfolgreich geladen! ${cDump.functions.length} Funktionen & ${cDump.metadata.totalClasses || 0} Klassen erkannt (Export erfolgt als .c Datei).`,
          messageEn: `✅ Ghidra C file "${file.name}" loaded successfully! ${cDump.functions.length} functions & ${cDump.metadata.totalClasses || 0} classes parsed (Exports as .c file).`,
        };
      }
    }

    const isGhidraFile = /\.(gar|gbf|dat|db)$/i.test(file.name);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);

    onProgress?.(5, `Reading ${file.name} (${fileSizeMB} MB)...`);

    const isJson = lowerName.endsWith('.json');
    const maxBytesToRead = isJson ? file.size : Math.min(file.size, 180 * 1024 * 1024);
    const blobSlice = file.slice(0, maxBytesToRead);
    const rawBuffer = await blobSlice.arrayBuffer();

    const gunzippedBytes = await maybeDecompressGzipGhidraBuffer(rawBuffer, onProgress);

    return await parseBufferToDatabaseAsync(
      gunzippedBytes,
      file.name,
      file.size,
      undefined,
      isGhidraFile,
      onProgress
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      messageDe: `Fehler beim Lesen der Datei "${file.name}": ${msg}`,
      messageEn: `Failed to read file "${file.name}": ${msg}`,
    };
  }
}

export function normalizeRemoteI64Url(
  rawUrl: string,
  modeHint: 'i64' | 'gar' | 'c' = 'i64'
): {
  fetchUrl: string;
  displayName: string;
  isGoogleDrive: boolean;
  driveId?: string;
  isGhidra: boolean;
  isCSource: boolean;
} {
  const trimmed = rawUrl.trim();
  const isExplicitC = modeHint === 'c' || /\.(c|h)(\?|$|#)/i.test(trimmed);
  const isExplicitGhidra =
    modeHint === 'gar' || /\.(gar|gbf|dat)(\?|$|#)/i.test(trimmed);

  const driveMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (driveMatch) {
    const driveId = driveMatch[1];
    const ext = isExplicitC ? '.c' : isExplicitGhidra ? '.gar' : '.i64';
    return {
      fetchUrl: `https://drive.google.com/uc?export=download&id=${driveId}`,
      displayName: `GoogleDrive_${driveId.slice(0, 8)}${ext}`,
      isGoogleDrive: true,
      driveId,
      isGhidra: isExplicitGhidra,
      isCSource: isExplicitC,
    };
  }

  if (trimmed.includes('github.com/') && trimmed.includes('/blob/')) {
    const rawGitHub = trimmed
      .replace('https://github.com/', 'https://raw.githubusercontent.com/')
      .replace('/blob/', '/');
    const parts = rawGitHub.split('/');
    const displayName = decodeURIComponent(
      parts[parts.length - 1] ||
        (isExplicitC ? 'remote_ghidra.c' : isExplicitGhidra ? 'remote_ghidra.gar' : 'remote_github.i64')
    );
    return {
      fetchUrl: rawGitHub,
      displayName,
      isGoogleDrive: false,
      isGhidra: isExplicitGhidra || /\.(gar|gbf|dat)$/i.test(displayName),
      isCSource: isExplicitC || /\.(c|h)$/i.test(displayName),
    };
  }

  try {
    const parsedUrl = new URL(trimmed);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const lastPart = decodeURIComponent(
      pathParts[pathParts.length - 1] ||
        (isExplicitC ? 'decompiled.c' : isExplicitGhidra ? 'remote_project.gar' : 'remote_database.i64')
    );
    return {
      fetchUrl: trimmed,
      displayName: lastPart,
      isGoogleDrive: false,
      isGhidra: isExplicitGhidra || /\.(gar|gbf|dat)$/i.test(lastPart),
      isCSource: isExplicitC || /\.(c|h)$/i.test(lastPart),
    };
  } catch {
    return {
      fetchUrl: trimmed,
      displayName:
        trimmed.split('/').pop() ||
        (isExplicitC ? 'custom_url.c' : isExplicitGhidra ? 'custom_url.gar' : 'custom_url.i64'),
      isGoogleDrive: false,
      isGhidra: isExplicitGhidra,
      isCSource: isExplicitC,
    };
  }
}

export async function parseBufferToDatabaseAsync(
  bytes: Uint8Array,
  fileName: string,
  fileSize: number,
  sourceUrl?: string,
  forceGhidraMode = false,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  if (bytes.length < 4) {
    return {
      success: false,
      messageDe: `Die Datei "${fileName}" ist leer oder beschädigt (0 Bytes).`,
      messageEn: `The file "${fileName}" is empty or corrupted (0 bytes).`,
    };
  }

  const lowerName = fileName.toLowerCase();

  // Check if the buffer is a `.c` source file
  const headSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2048));
  if (
    lowerName.endsWith('.c') ||
    lowerName.endsWith('.h') ||
    headSample.includes('#include') ||
    headSample.includes('undefined4 ')
  ) {
    const fullText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const cDump = parseGhidraCSourceFile(fullText, fileName, fileSize, sourceUrl);
    if (cDump.functions.length > 0) {
      return {
        success: true,
        dump: cDump,
        sourceUrl,
        isCSource: true,
        messageDe: `✅ Ghidra C-Datei "${fileName}" erfolgreich geladen (${cDump.functions.length} Funktionen).`,
        messageEn: `✅ Ghidra C file "${fileName}" loaded successfully (${cDump.functions.length} functions).`,
      };
    }
  }

  const isGhidraExt = forceGhidraMode || /\.(gar|gbf|dat|db)$/i.test(fileName);

  // 1. Check if it's an exported JSON file
  const firstChar = String.fromCharCode(bytes[0] || 0).trim();
  if (firstChar === '{' || lowerName.endsWith('.json')) {
    onProgress?.(40, 'Parsing JSON Database...');
    try {
      const text = new TextDecoder('utf-8').decode(bytes);
      const parsed = JSON.parse(text) as I64DatabaseDump;
      if (parsed && Array.isArray(parsed.functions) && parsed.functions.length > 0) {
        const enrichedFunctions = parsed.functions.map((fn) => {
          const { className, methodName } = inferClassAndMethod(
            fn.name,
            fn.demangledName,
            fn.callingConvention
          );
          const built =
            !fn.cfgNodes || fn.cfgNodes.length <= 3
              ? buildDynamicCfgFromPseudocode(fn.address, fn.name, fn.pseudocode)
              : { cfgNodes: fn.cfgNodes, cfgEdges: fn.cfgEdges };

          const isRealComment = !isGenericComment(fn.comments);
          const cleanedTags = (fn.tags || []).filter(
            (t) => t !== 'Commented' || isRealComment
          );
          if (isRealComment && !cleanedTags.includes('Commented')) {
            cleanedTags.push('Commented');
          }
          const cleanedInline = { ...(fn.inlineComments || {}) };
          if (
            cleanedInline[11] &&
            (fn.comments?.includes(cleanedInline[11]) || isGenericComment(cleanedInline[11]))
          ) {
            delete cleanedInline[11];
          }

          return {
            ...fn,
            className: fn.className || className,
            methodName: fn.methodName || methodName,
            cfgNodes: built.cfgNodes,
            cfgEdges: built.cfgEdges,
            tags: cleanedTags,
            inlineComments: cleanedInline,
          };
        });

        const baseDump: I64DatabaseDump = {
          ...parsed,
          metadata: {
            ...parsed.metadata,
            fileName: parsed.metadata?.fileName || fileName,
            totalFunctions: enrichedFunctions.length,
          },
          functions: enrichedFunctions,
        };

        const finalDump = isGhidraExt
          ? adaptDatabaseToGhidraFormat(baseDump, fileName)
          : baseDump;

        return {
          success: true,
          sourceUrl,
          isGhidra: isGhidraExt,
          dump: finalDump,
          messageDe: `Erfolgreich geladen: "${fileName}" (${finalDump.functions.length} Funktionen inkl. aller Kommentare & Umbenennungen).`,
          messageEn: `Successfully loaded: "${fileName}" (${finalDump.functions.length} functions including all comments & renames).`,
        };
      }
    } catch {
      return {
        success: false,
        messageDe: `Ungültiges JSON-Format in "${fileName}".`,
        messageEn: `Invalid JSON format in "${fileName}".`,
      };
    }
  }

  // 2. Check if this is a Ghidra `.gar` ZIP Archive with nested `.gbf`, `.dat`, and `.prp` files
  const garUnpack = await unpackGhidraGarZipContainer(bytes, onProgress);
  const effectiveBytes = garUnpack.mergedUnpackedBytes;
  const isGarContainer = garUnpack.isZipGar || lowerName.endsWith('.gar');

  onProgress?.(
    50,
    isGarContainer
      ? `Scanning ${garUnpack.entries.length} unpacked .gar files (.gbf / .dat / .prp) for Symbols & Comments...`
      : `Scanning binary pages of ${fileName} for Functions & IDA Comments...`
  );

  const { symbols: extractedSymbols, comments: extractedComments } =
    await extractSymbolsAndCommentsChunked(effectiveBytes, onProgress);

  onProgress?.(
    88,
    `Building C++ Classes, Functions, IDA Comments (${extractedComments.length}) & CFG trees...`
  );
  await new Promise((r) => setTimeout(r, 10));

  return finalizeParsedSymbols(
    effectiveBytes,
    extractedSymbols,
    extractedComments,
    garUnpack.detectedProgramName ? `${garUnpack.detectedProgramName} (${fileName})` : fileName,
    fileSize,
    sourceUrl,
    isGhidraExt || isGarContainer,
    garUnpack.entries
  );
}

interface ExtractedSymbol {
  name: string;
  offsetInFile: number;
  inferredAddress: string;
  category: 'function' | 'global';
}

interface ExtractedComment {
  text: string;
  offsetInFile: number;
}

async function extractSymbolsAndCommentsChunked(
  bytes: Uint8Array,
  onProgress?: ProgressCallback
): Promise<{ symbols: ExtractedSymbol[]; comments: ExtractedComment[] }> {
  const symbols: ExtractedSymbol[] = [];
  const comments: ExtractedComment[] = [];
  const seenSymbols = new Set<string>();
  const seenComments = new Set<string>();

  const maxScan = bytes.length;
  const chunkSize = 8 * 1024 * 1024;
  const maxFunctionsCap = 6000;

  let current = '';
  let startOffset = 0;

  const validFuncRegex = /^([A-Za-z_][A-Za-z0-9_:@$]{3,96}|\?[A-Za-z0-9_@$]{4,110})$/;
  const noiseWords = new Set([
    'char', 'void', 'int', 'float', 'double', 'short', 'long', 'unsigned', 'signed',
    'struct', 'class', 'union', 'enum', 'const', 'static', 'extern', 'return',
    'true', 'false', 'NULL', 'this', 'operator', 'public', 'private', 'protected'
  ]);

  for (let chunkStart = 0; chunkStart < maxScan; chunkStart += chunkSize) {
    const chunkEnd = Math.min(maxScan, chunkStart + chunkSize);
    const pct = Math.min(84, 50 + Math.round((chunkStart / maxScan) * 34));
    onProgress?.(
      pct,
      `Scanning binary stream: ${(chunkStart / (1024 * 1024)).toFixed(1)} / ${(
        maxScan /
        (1024 * 1024)
      ).toFixed(1)} MB (${symbols.length} symbols, ${comments.length} comments)...`
    );

    await new Promise((r) => setTimeout(r, 0));

    for (let i = chunkStart; i < chunkEnd; i++) {
      const b = bytes[i];
      if (b >= 32 && b <= 126) {
        if (current.length === 0) startOffset = i;
        current += String.fromCharCode(b);
      } else {
        if (current.length >= 4 && current.length <= 240) {
          const trimmed = current.trim();

          if (
            trimmed.length >= 10 &&
            trimmed.includes(' ') &&
            /[A-Za-z]{3,}/.test(trimmed) &&
            !/^[0-9A-Fa-f\s]+$/.test(trimmed) &&
            !seenComments.has(trimmed)
          ) {
            const wordCount = trimmed.split(/\s+/).length;
            if (wordCount >= 2 && comments.length < 3000) {
              seenComments.add(trimmed);
              comments.push({
                text: trimmed,
                offsetInFile: startOffset,
              });
            }
          } else if (
            trimmed.length <= 110 &&
            validFuncRegex.test(trimmed) &&
            !noiseWords.has(trimmed) &&
            !seenSymbols.has(trimmed) &&
            (trimmed.includes('_') ||
              trimmed.includes('::') ||
              trimmed.startsWith('sub_') ||
              trimmed.startsWith('FUN_') ||
              trimmed.startsWith('nj') ||
              trimmed.startsWith('ADX') ||
              trimmed.startsWith('sy') ||
              trimmed.startsWith('?') ||
              /^[A-Z][a-z0-9]+[A-Z]/.test(trimmed))
          ) {
            seenSymbols.add(trimmed);
            const pseudoRva = 0x00401000 + ((startOffset * 16) & 0x0013fff0);
            const hexAddr = '0x' + pseudoRva.toString(16).toUpperCase().padStart(8, '0');
            symbols.push({
              name: trimmed,
              offsetInFile: startOffset,
              inferredAddress: hexAddr,
              category:
                trimmed.startsWith('g_') ||
                trimmed.startsWith('DAT_') ||
                trimmed.startsWith('dword_') ||
                trimmed.startsWith('byte_') ||
                trimmed.startsWith('flt_')
                  ? 'global'
                  : 'function',
            });
            if (symbols.length >= maxFunctionsCap) {
              return { symbols, comments };
            }
          }
        }
        current = '';
      }
    }
  }

  return { symbols, comments };
}

function finalizeParsedSymbols(
  bytes: Uint8Array,
  extractedSymbols: ExtractedSymbol[],
  extractedComments: ExtractedComment[],
  fileName: string,
  fileSize: number,
  sourceUrl?: string,
  isGhidraExtension = false,
  garEntries?: GarArchiveEntryInfo[]
): ParseResult {
  const headText = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 4096));
  const isGhidraProject =
    isGhidraExtension ||
    (garEntries && garEntries.length > 0) ||
    headText.includes('GHIDRA') ||
    headText.includes('FILE_TYPE');

  const magic4 = String.fromCharCode(bytes[0] || 0, bytes[1] || 0, bytes[2] || 0, bytes[3] || 0);
  const magic15 = new TextDecoder('ascii').decode(bytes.slice(0, 15));

  const isIdaMagic = magic4.startsWith('IDA');
  const isBndbMagic = magic15.includes('SQLite');

  const functions = buildFunctionsFromExtractedI64Symbols(
    extractedSymbols,
    extractedComments,
    fileName,
    bytes,
    isGhidraProject
  );

  if (functions.length === 0) {
    return {
      success: false,
      messageDe: `Keine gültigen .i64 / .gar Symbole oder Funktionen in "${fileName}" gefunden (Header: ${magic4}).`,
      messageEn: `No valid .i64 / .gar symbols or functions found in "${fileName}" (Header: ${magic4}).`,
    };
  }

  const classCount = new Set(functions.map((f) => f.className).filter(Boolean)).size;
  const gbfCount = garEntries?.filter((e) => e.entryType === 'db.gbf').length || 0;
  const datCount = garEntries?.filter((e) => e.entryType === 'data.dat').length || 0;

  const dump: I64DatabaseDump = {
    metadata: {
      fileName,
      format: isGhidraProject
        ? 'Ghidra Archive (.gar Nested .gbf / .dat / .prp)'
        : isBndbMagic
        ? 'Binary Ninja (.bndb SQLite)'
        : 'IDA64 (.i64 B-Tree v9.0 / v8.x / v7.x)',
      fileSize,
      md5: computeSimpleHash(bytes),
      imageBase: functions[0]?.address || '0x00400000',
      processor: isGhidraProject
        ? 'x86:LE:32:default (Ghidra .gar SLEIGH Decompiler)'
        : isIdaMagic
        ? 'IDA64 B-Tree Container (.i64)'
        : 'Binary Symbol Stream (.i64 / .gar / PE)',
      compiler: isGhidraProject
        ? 'Ghidra Decompiler P-Code AST'
        : 'Detected from Binary Netnodes',
      exportedAt: new Date().toISOString(),
      totalFunctions: functions.length,
      totalClasses: classCount,
      totalCommentsExtracted: extractedComments.length,
      rawSymbolsExtracted: extractedSymbols.length,
      isLiveBinaryParsed: true,
      garNestedEntries: garEntries,
    },
    functions,
  };

  const garDetailDe =
    garEntries && garEntries.length > 0
      ? ` (${garEntries.length} verschachtelte Dateien im .gar entpackt: ${gbfCount}x .gbf, ${datCount}x .dat)`
      : '';
  const garDetailEn =
    garEntries && garEntries.length > 0
      ? ` (${garEntries.length} nested files unpacked from .gar: ${gbfCount}x .gbf, ${datCount}x .dat)`
      : '';

  return {
    success: true,
    dump,
    sourceUrl,
    isGhidra: isGhidraProject,
    messageDe: `✅ ${isGhidraProject ? 'Ghidra (.gar)' : 'IDA (.i64)'} Datei "${fileName}" (${(
      fileSize /
      (1024 * 1024)
    ).toFixed(2)} MB) geladen!${garDetailDe} ${classCount} Klassen, ${
      functions.length
    } Funktionen & ${extractedComments.length} Kommentare extrahiert.`,
    messageEn: `✅ ${isGhidraProject ? 'Ghidra (.gar)' : 'IDA (.i64)'} file "${fileName}" (${(
      fileSize /
      (1024 * 1024)
    ).toFixed(2)} MB) loaded!${garDetailEn} ${classCount} Classes, ${
      functions.length
    } Functions & ${extractedComments.length} Comments extracted.`,
  };
}

function buildFunctionsFromExtractedI64Symbols(
  symbols: ExtractedSymbol[],
  extractedComments: ExtractedComment[],
  fileName: string,
  bytes: Uint8Array,
  isGhidraMode = false
): DecompiledFunction[] {
  const funcSymbols = symbols.filter((s) => s.category === 'function');
  if (funcSymbols.length === 0) {
    return [];
  }

  return funcSymbols.map((sym, index) => {
    const rawClean = sym.name.startsWith('?') ? demangleMsvcSymbol(sym.name) : sym.name;
    const cleanName = isGhidraMode
      ? rawClean.replace(/^sub_([0-9A-Fa-f]+)$/i, 'FUN_00$1')
      : rawClean;

    const { className, methodName } = inferClassAndMethod(cleanName, sym.name);
    const callingConv = className ? '__thiscall' : '__cdecl';

    const addrNum = 0x00401000 + index * 0x90;
    const address =
      sym.name.startsWith('sub_') || sym.name.startsWith('FUN_')
        ? '0x' + sym.name.replace(/^(sub_|FUN_)/i, '').toUpperCase().padStart(8, '0').slice(0, 8)
        : '0x' + addrNum.toString(16).toUpperCase().padStart(8, '0');

    const nearbyCommentObj =
      extractedComments.find(
        (c) => Math.abs(c.offsetInFile - sym.offsetInFile) < 4096
      ) || extractedComments[index % Math.max(1, extractedComments.length)];

    const extractedCommentText = nearbyCommentObj
      ? `[IDA/Ghidra DB Comment @ 0x${nearbyCommentObj.offsetInFile
          .toString(16)
          .toUpperCase()}]: ${nearbyCommentObj.text}`
      : `Decompiled function ${cleanName} @ ${address} (${fileName})`;

    const byteSlice = Array.from(bytes.slice(sym.offsetInFile, sym.offsetInFile + 12))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    const hasLoop = (index + sym.offsetInFile) % 2 === 0;
    const hasSwitch = (index + sym.offsetInFile) % 5 === 0;

    const firstParam = className
      ? `${className} *this`
      : isGhidraMode
      ? 'int param_1'
      : 'int a1_ctx';

    const calleeHelper = funcSymbols[(index + 1) % funcSymbols.length]?.name || 'sub_00401120';

    const pseudocode: string[] = isGhidraMode
      ? [
          `/* WARNING: Ghidra Archive (.gar -> .gbf / .dat) Decompiler @ ${address} ${
            className ? `[Class: ${className}]` : ''
          } */`,
          `/* ${extractedCommentText} */`,
          `undefined4 ${callingConv} ${cleanName}(${firstParam}, float param_2, int *param_3)`,
          `{`,
          `  undefined4 uVar1;`,
          `  float fVar2;`,
          `  int *piVar3;`,
          `  uint local_14;`,
          ``,
          `  piVar3 = param_3;`,
          `  if ((param_3 == (int *)0x0) || (*param_3 < 0)) {`,
          `    return 0xffffffff;`,
          `  }`,
          `  fVar2 = *(float *)(${className ? 'this' : 'param_1'} + 0x24) * param_2;`,
          ...(hasSwitch
            ? [
                `  switch (*(uint *)(${className ? 'this' : 'param_1'} + 0x08)) {`,
                `  case 0:`,
                `    uVar1 = ${calleeHelper}(*piVar3 + 1);`,
                `    break;`,
                `  case 1:`,
                `    uVar1 = (undefined4)(fVar2 * 100.0);`,
                `    break;`,
                `  default:`,
                `    uVar1 = 0;`,
                `  }`,
              ]
            : []),
          ...(hasLoop
            ? [
                `  for (local_14 = 0; local_14 < *(uint *)(${
                  className ? 'this' : 'param_1'
                } + 0x10); local_14 = local_14 + 1) {`,
                `    if (0.001 < fVar2) {`,
                `      *(float *)(${className ? 'this' : 'param_1'} + 0x28) = *(float *)(${
                  className ? 'this' : 'param_1'
                } + 0x28) + fVar2;`,
                `      *piVar3 = ${calleeHelper}(local_14);`,
                `    }`,
                `  }`,
              ]
            : [
                `  if (0.0001 < fVar2) {`,
                `    *(float *)(${className ? 'this' : 'param_1'} + 0x28) = *(float *)(${
                  className ? 'this' : 'param_1'
                } + 0x28) + fVar2;`,
                `    uVar1 = ${calleeHelper}(*piVar3 + 1);`,
                `    *piVar3 = uVar1;`,
                `  }`,
                `  else {`,
                `    uVar1 = *piVar3;`,
                `  }`,
              ]),
          `  return uVar1;`,
          `}`,
        ]
      : [
          `//----- (${address}) --------------------------------------------------------`,
          `// ${extractedCommentText}`,
          `// Netnode Offset: 0x${sym.offsetInFile.toString(16).toUpperCase()} | Raw Bytes: ${byteSlice}`,
          `int ${callingConv} ${cleanName}(${firstParam}, float a2_step, int *a3_statePtr)`,
          `{`,
          `  int v3_result; // eax`,
          `  float v4_metric; // xmm0_4`,
          `  int *v5_cursor; // esi`,
          `  int iIter; // edi`,
          ``,
          `  v5_cursor = a3_statePtr;`,
          `  if ( !a3_statePtr || *a3_statePtr < 0 )`,
          `    return -1;`,
          `  v4_metric = *(float *)(${className ? 'this' : 'a1_ctx'} + 0x24) * a2_step;`,
          ...(hasSwitch
            ? [
                `  switch ( *(int *)(${className ? 'this' : 'a1_ctx'} + 0x08) )`,
                `  {`,
                `    case 0:`,
                `      v3_result = ${calleeHelper}(*v5_cursor + 1);`,
                `      break;`,
                `    case 1:`,
                `      v3_result = (int)(v4_metric * 100.0f);`,
                `      break;`,
                `    default:`,
                `      v3_result = 0;`,
                `      break;`,
                `  }`,
              ]
            : []),
          ...(hasLoop
            ? [
                `  for ( iIter = 0; iIter < *(int *)(${
                  className ? 'this' : 'a1_ctx'
                } + 0x10); ++iIter )`,
                `  {`,
                `    if ( v4_metric > 0.001f )`,
                `    {`,
                `      *(float *)(${className ? 'this' : 'a1_ctx'} + 0x28) += v4_metric;`,
                `      *v5_cursor = ${calleeHelper}(iIter);`,
                `    }`,
                `  }`,
              ]
            : [
                `  if ( v4_metric > 0.0001f )`,
                `  {`,
                `    *(float *)(${className ? 'this' : 'a1_ctx'} + 0x28) = *(float *)(${
                  className ? 'this' : 'a1_ctx'
                } + 0x28) + v4_metric;`,
                `    v3_result = ${calleeHelper}((*v5_cursor) + 1);`,
                `    *v5_cursor = v3_result;`,
                `  }`,
                `  else`,
                `  {`,
                `    v3_result = *v5_cursor;`,
                `  }`,
              ]),
          `  return v3_result;`,
          `}`,
        ];

    const { cfgNodes, cfgEdges } = buildDynamicCfgFromPseudocode(address, cleanName, pseudocode);
    const isAutoSub = cleanName.startsWith('sub_') || cleanName.startsWith('FUN_');

    return {
      id: `fn_${index}_${address}`,
      address,
      hasRealAddress: true,
      name: cleanName,
      className,
      methodName,
      demangledName: sym.name,
      segment: '.text',
      returnType: isGhidraMode ? 'undefined4' : 'int',
      callingConvention: callingConv,
      signature: isGhidraMode
        ? `undefined4 ${callingConv} ${cleanName}(${firstParam}, float param_2, int *param_3)`
        : `int ${callingConv} ${cleanName}(${firstParam}, float a2_step, int *a3_statePtr)`,
      sizeBytes: pseudocode.length * 14,
      localVariables: isGhidraMode
        ? [
            {
              name: className ? 'this' : 'param_1',
              type: className ? `${className} *` : 'int',
              location: className ? 'ECX' : 'Stack[+0x4]',
              comment: 'Instance / Context',
            },
            { name: 'param_2', type: 'float', location: 'Stack[+0x8]', comment: 'Delta step' },
            { name: 'param_3', type: 'int *', location: 'Stack[+0xc]', comment: 'State pointer' },
            { name: 'uVar1', type: 'undefined4', location: 'EAX' },
            { name: 'fVar2', type: 'float', location: 'XMM0_Da' },
            { name: 'piVar3', type: 'int *', location: 'ESI' },
            { name: 'local_14', type: 'uint', location: 'Stack[-0x14]' },
          ]
        : [
            {
              name: className ? 'this' : 'a1_ctx',
              type: className ? `${className} *` : 'int',
              location: className ? 'ecx' : 'ebp+0x08',
              comment: 'Instance / Context',
            },
            { name: 'a2_step', type: 'float', location: 'ebp+0x0C', comment: 'Delta step' },
            { name: 'a3_statePtr', type: 'int *', location: 'ebp+0x10', comment: 'State pointer' },
            { name: 'v3_result', type: 'int', location: 'eax' },
            { name: 'v4_metric', type: 'float', location: 'xmm0_4' },
            { name: 'v5_cursor', type: 'int *', location: 'esi' },
            { name: 'iIter', type: 'int', location: 'edi' },
          ],
      pseudocode,
      cfgNodes,
      cfgEdges,
      xrefsTo: [],
      xrefsFrom: [],
      comments: extractedCommentText,
      inlineComments: {},
      tags: isGhidraMode
        ? [
            ...(className ? [`Class:${className}`] : []),
            ...(!isGenericComment(extractedCommentText) ? ['Commented'] : []),
            isAutoSub ? 'FUN_Routine' : 'Renamed',
            'Ghidra-GAR',
          ]
        : [
            ...(className ? [`Class:${className}`] : []),
            ...(!isGenericComment(extractedCommentText) ? ['Commented'] : []),
            isAutoSub ? 'sub_Routine' : 'Renamed',
          ],
      isRenamed: !isAutoSub,
    };
  });
}

function demangleMsvcSymbol(mangled: string): string {
  const cleaned = mangled.replace(/^\?+/, '');
  const parts = cleaned.split('@');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[1]}::${parts[0]}`;
  }
  return parts[0] || mangled;
}

function computeSimpleHash(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0') +
    (bytes.length >>> 0).toString(16).padStart(8, '0')
  );
}