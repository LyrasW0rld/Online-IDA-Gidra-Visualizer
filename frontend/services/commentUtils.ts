import { DecompiledFunction } from '../types';

/**
 * Checks whether a single trimmed line of comment text is an automatic/generic
 * IDA, Ghidra, or decompiler placeholder comment rather than a real user/reversing comment.
 */
export function isGenericCommentLine(line: string): boolean {
  const clean = line
    .trim()
    .replace(/^(\/\/|\/\*|\*)\s*/, '')
    .replace(/\*\/$/, '')
    .trim();

  if (!clean) return true;

  // Horizontal rules or divider characters (e.g. "-------------------", "=======", "/* ===== */")
  if (/^[-=*#_/\\ ]+$/.test(clean)) return true;

  // IDA function banner separator lines, e.g. "----- (0x00406DF0) --------------------------------------------------------"
  if (/^[-=]{3,}\s*\([0-9a-fxA-FX]+\)\s*[-=]{3,}/i.test(clean)) return true;
  if (/^[-=]{5,}/.test(clean)) return true;

  // IDA / Ghidra DB Comment tag header, e.g. "[IDA/Ghidra DB Comment @ 0x6F10C]: Funktion an 0x0040F020"
  if (/(?:\[\s*)?(?:IDA\/Ghidra|IDA|Ghidra)\s+(?:DB\s+)?Comment\s*@\s*(?:0x)?[0-9a-fA-F]+/i.test(clean)) return true;

  // Netnode and raw byte debug offsets, e.g. "Netnode Offset: 0x6F5DC | Raw Bytes: 6F 73 74 72 65 61 6D 5F 6F 70 65"
  if (/Netnode Offset:\s*(?:0x)?[0-9a-fA-F]+/i.test(clean)) return true;
  if (/Raw Bytes:\s*[0-9A-Fa-f\s]+/i.test(clean)) return true;

  // Decompiler / stub generators
  if (/^Decompiled function\b/i.test(clean)) return true;
  if (/^Ghidra C Function\b/i.test(clean)) return true;
  if (/^Unbenannte IDA Pro Subroutine\b/i.test(clean) || /Unnamed IDA Pro subroutine/i.test(clean)) return true;
  if (/^WARNING:\s*Ghidra Archive/i.test(clean)) return true;
  if (/^WARNING:\s*(?:Subroutine|Removing|Type propagation|Globals starting|Control flow|Treating indirect)\b/i.test(clean)) return true;

  // Internal IDA netnode artifacts, e.g. "$$ ^47FF60.__return_address" or "$$ ..."
  if (/^\$\$\s*(\^|[0-9a-zA-Z_])/i.test(clean)) return true;

  // Disassembly jumptable labels, e.g. "jumptable 004BAF14 case 59"
  if (/^jumptable\b/i.test(clean)) return true;
  if (/^jump table\b/i.test(clean) || /^switch table\b/i.test(clean)) return true;

  // IDA auto-analysis signatures, e.g. "18 defined bytes match; Xref candidates: ..."
  if (/\b\d+\s+defined bytes match\b/i.test(clean)) return true;
  if (/\bXref candidates:\b/i.test(clean)) return true;

  // Generic IDA address markers, e.g. "Funktion an 0x0040F020" or "Function at 0x..."
  if (/^(?:Funktion an|Function at)\s+(?:0x)?[0-9a-fA-F]+/i.test(clean)) return true;

  // Standard runtime / compiler boilerplate strings scraped by binary scanners
  if (/^Microsoft Visual C\+\+/i.test(clean)) return true;
  if (/^Runtime Error\b/i.test(clean)) return true;
  if (/^VirtualAlloc failed\b/i.test(clean)) return true;
  if (/^Pure virtual function call\b/i.test(clean)) return true;

  return false;
}

/**
 * Checks whether an entire comment block (single or multi-line) consists purely of
 * generic / automatic boilerplate comments.
 * Returns true if the comment has no real user-meaningful content.
 */
export function isGenericComment(text: string | undefined | null): boolean {
  if (!text || !text.trim()) return true;
  const lines = text.split(/\r?\n/);
  // If every non-empty line is generic, the entire comment is generic
  return lines.every((line) => isGenericCommentLine(line));
}

/**
 * Determines whether a function contains genuine reversing comments
 * (either in the function header comment or inline line comments).
 */
export function hasRealComment(fn: DecompiledFunction): boolean {
  // Check function header comment
  if (fn.comments && !isGenericComment(fn.comments)) {
    return true;
  }
  // Check inline comments (ignoring synthetic line 11 comments from earlier parser versions)
  if (fn.inlineComments && Object.keys(fn.inlineComments).length > 0) {
    const hasMeaningfulInline = Object.entries(fn.inlineComments).some(
      ([lineStr, c]) => {
        if (!c || isGenericComment(c)) return false;
        // Ignore synthetic demo line 11 comments that duplicate the header comment text
        if (lineStr === '11' && fn.comments && fn.comments.includes(c)) return false;
        return true;
      }
    );
    if (hasMeaningfulInline) return true;
  }
  return false;
}
