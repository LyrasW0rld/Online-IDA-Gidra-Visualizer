export interface LocalVariable {
  oldName?: string;
  name: string;
  type: string;
  location: string; // e.g., "ebp-0x14", "Stack[-0x14]", "local", or "esi"
  comment?: string;
}

export interface CFGNode {
  id: string;
  address: string; // e.g., "0x0043A100" or "Line 24" for addressless .c files
  label: string;
  conditionExpression?: string; // e.g., "pCab->currentGearState == GEAR_DRIVE"
  calledFunctions?: string[]; // Functions triggered inside this block
  codePreview: string[];
  type: 'entry' | 'condition' | 'body' | 'loop' | 'return';
  LineStart: number;
  LineEnd: number;
}

export interface CFGEdge {
  from: string;
  to: string;
  label?: 'true' | 'false' | 'unconditional' | 'loop';
  conditionHint?: string;
}

export interface CrossReference {
  address: string;
  funcName: string;
  type: 'CALL' | 'DATA_READ' | 'DATA_WRITE' | 'JMP';
}

export interface DecompiledFunction {
  id: string;
  address: string;
  hasRealAddress?: boolean;
  name: string;
  originalName?: string;
  className?: string;
  methodName?: string;
  demangledName?: string;
  segment: '.text' | '.rdata' | '.data' | 'seg000' | '.c';
  returnType: string;
  callingConvention: '__cdecl' | '__thiscall' | '__fastcall' | '__stdcall' | '__userpurge' | '__usercall';
  signature: string;
  sizeBytes: number;
  localVariables: LocalVariable[];
  pseudocode: string[];
  cfgNodes: CFGNode[];
  cfgEdges: CFGEdge[];
  xrefsTo: CrossReference[];
  xrefsFrom: CrossReference[];
  comments?: string;
  inlineComments?: Record<number, string>;
  tags: string[];
  isRenamed: boolean;
}

export interface GarArchiveEntryInfo {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  entryType: 'db.gbf' | 'property.prp' | 'data.dat' | 'other';
}

export interface I64DatabaseMetadata {
  fileName: string;
  format:
    | 'IDA64 (.i64 B-Tree v9.0 / v8.x / v7.x)'
    | 'Ghidra Archive (.gar Nested .gbf / .dat / .prp)'
    | 'Ghidra C Source (.c Decompiled Code)'
    | 'Binary Ninja (.bndb SQLite)'
    | 'Exported JSON Snapshot';
  fileSize: number;
  md5: string;
  sha256?: string;
  imageBase: string;
  processor: string;
  compiler: string;
  exportedAt: string;
  googleDriveFileId?: string;
  totalFunctions: number;
  totalClasses?: number;
  totalCommentsExtracted?: number;
  rawSymbolsExtracted?: number;
  isLiveBinaryParsed?: boolean;
  isCSourceFile?: boolean;
  originalCSourceText?: string;
  garNestedEntries?: GarArchiveEntryInfo[];
}

export interface I64DatabaseDump {
  metadata: I64DatabaseMetadata;
  functions: DecompiledFunction[];
  rawBinaryBytes?: Uint8Array;
}

export interface UserSymbolEdits {
  /** functionAddress -> newFunctionName */
  renamedFunctions: Record<string, string>;
  /** functionAddress -> { oldVarName -> newVarName } */
  renamedVariables: Record<string, Record<string, string>>;
  /** functionAddress -> { varName -> newType (e.g. float, int, uint, char*, enum) } */
  variableTypes: Record<string, Record<string, string>>;
  /** functionAddress -> { lineNumber -> { oldLiteral -> newFormattedLiteral } } */
  literalConversions: Record<string, Record<number, Record<string, string>>>;
  /** functionAddress -> function Header Comment */
  functionComments: Record<string, string>;
  /** functionAddress -> { lineNumber -> inline comment } */
  lineComments: Record<string, Record<number, string>>;
}