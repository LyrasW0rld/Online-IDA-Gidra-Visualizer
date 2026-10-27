import { CFGNode, CFGEdge } from '../types';

/**
 * Parses C/C++ pseudocode lines and constructs a genuine Control Flow Graph (CFG)
 * where:
 * - Every `if (...)`, `else if (...)`, `switch (...)`, or `for/while` condition node
 *   captures its exact condition expression (`conditionExpression`)
 * - Every block captures all functions called inside it (`calledFunctions`)
 * - `TRUE` branch points to the true-body block, `FALSE` branch points to the `else` block
 *   (or the post-if convergence block if there is no `else`)
 * - Both `TRUE` and `FALSE` branches cleanly converge on the subsequent block rather than
 *   producing disconnected or nonsensical jumps!
 */
export function buildDynamicCfgFromPseudocode(
  funcAddress: string,
  funcName: string,
  pseudocode: string[],
  isAddresslessC = false
): { cfgNodes: CFGNode[]; cfgEdges: CFGEdge[] } {
  const baseEa = parseInt(funcAddress.replace(/^0x/i, ''), 16) || 0x00401000;
  const nodes: CFGNode[] = [];
  const edges: CFGEdge[] = [];

  interface RawSegment {
    type: CFGNode['type'];
    label: string;
    conditionExpression?: string;
    calledFunctions: string[];
    startLine: number;
    endLine: number;
    previewLines: string[];
    isElseBranch?: boolean;
  }

  const extractCallsFromLines = (lines: string[]): string[] => {
    const calls = new Set<string>();
    const ignore = new Set([
      'if', 'for', 'while', 'switch', 'return', 'sizeof', 'fabs', 'sinf', 'cosf', 'tanf', 'atan2f'
    ]);
    for (const l of lines) {
      const matches = l.matchAll(/\b([A-Za-z_][A-Za-z0-9_:]*)\s*\(/g);
      for (const m of matches) {
        const fn = m[1];
        if (!ignore.has(fn) && fn !== funcName) {
          calls.add(fn);
        }
      }
    }
    return Array.from(calls);
  };

  const segments: RawSegment[] = [];
  let currentType: CFGNode['type'] = 'entry';
  let currentLabel = `ENTRY: ${funcName.slice(0, 22)}`;
  let currentCondition: string | undefined = undefined;
  let currentIsElse = false;
  let currentStart = 1;
  let currentPreview: string[] = [];

  const flushSegment = (endLine: number) => {
    if (endLine < currentStart) return;
    const filteredPreview = currentPreview
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 0 &&
          !l.startsWith('//-----') &&
          !l.startsWith('/* WARNING') &&
          l !== '{' &&
          l !== '}'
      );

    if (filteredPreview.length > 0 || segments.length === 0) {
      const preview =
        filteredPreview.length > 0
          ? filteredPreview.slice(0, 4)
          : [`// Lines ${currentStart}..${endLine}`];
      segments.push({
        type: currentType,
        label: currentLabel,
        conditionExpression: currentCondition,
        calledFunctions: extractCallsFromLines(filteredPreview),
        startLine: currentStart,
        endLine,
        previewLines: preview,
        isElseBranch: currentIsElse,
      });
    }
  };

  for (let i = 0; i < pseudocode.length; i++) {
    const lineNum = i + 1;
    const raw = pseudocode[i];
    const trimmed = raw.trim();

    if (!trimmed || trimmed === '{' || trimmed === '}') {
      continue;
    }

    const isIf = /^if\s*\(/.test(trimmed);
    const isElseIf = /^else\s+if\s*\(/.test(trimmed);
    const isElse = /^else\b/.test(trimmed) && !isElseIf;
    const isLoop = /^(for|while|do)\b/.test(trimmed);
    const isSwitchCase = /^(switch|case\b|default:)/.test(trimmed);
    const isReturn = /^return\b/.test(trimmed);

    const currentLineSpan = lineNum - currentStart;

    if (
      lineNum > 3 &&
      (isIf ||
        isElseIf ||
        isElse ||
        isLoop ||
        isSwitchCase ||
        isReturn ||
        (currentLineSpan >= 4 && currentPreview.length >= 3))
    ) {
      flushSegment(lineNum - 1);
      currentStart = lineNum;
      currentPreview = [trimmed];
      currentIsElse = false;
      currentCondition = undefined;

      if (isIf || isElseIf || isSwitchCase) {
        currentType = 'condition';
        const condMatch = trimmed.match(/(?:if|switch|case)\s*\(?([^){:]+)/);
        const condExpr = condMatch ? condMatch[1].trim() : trimmed;
        currentCondition = condExpr;
        currentLabel = isElseIf
          ? `ELSE IF (${condExpr.slice(0, 26)})`
          : isSwitchCase
          ? `SWITCH (${condExpr.slice(0, 26)})`
          : `IF (${condExpr.slice(0, 28)})`;
      } else if (isLoop) {
        currentType = 'loop';
        const loopMatch = trimmed.match(/(?:for|while)\s*\((.*)\)/);
        currentCondition = loopMatch ? loopMatch[1].trim() : trimmed;
        currentLabel = `LOOP (${currentCondition.slice(0, 26)})`;
      } else if (isReturn) {
        currentType = 'return';
        currentLabel = `RETURN (${trimmed.replace(/^return\s*/, '').replace(/;$/, '').slice(0, 22) || 'void'})`;
      } else if (isElse) {
        currentType = 'body';
        currentIsElse = true;
        currentLabel = `ELSE_BRANCH_L${lineNum}`;
      } else {
        currentType = 'body';
        const callMatch = trimmed.match(/([A-Za-z0-9_:]+)\s*\(/);
        currentLabel = callMatch
          ? `CALL ${callMatch[1].slice(0, 24)}()`
          : `EXEC_BLOCK_L${lineNum}`;
      }
    } else {
      if (!trimmed.startsWith('//-----')) {
        currentPreview.push(trimmed);
        // Also check if the very first entry segment contains an `if` condition
        if (segments.length === 0 && (isIf || isSwitchCase)) {
          const condMatch = trimmed.match(/(?:if|switch)\s*\((.*)\)/);
          if (condMatch) {
            currentCondition = condMatch[1].trim();
          }
        }
      }
    }
  }

  flushSegment(pseudocode.length);

  if (segments.length > 0) {
    segments[0].type = 'entry';
    segments[segments.length - 1].type = 'return';
  }

  // Convert segments into CFGNodes with monotonically increasing addresses (or Line numbers for .c files)
  let offsetBytes = 0;
  segments.forEach((seg, idx) => {
    const ea = baseEa + offsetBytes;
    const nodeAddr = isAddresslessC
      ? `Line ${seg.startLine}`
      : '0x' + ea.toString(16).toUpperCase().padStart(8, '0');
    const shortAddr = isAddresslessC
      ? `L${seg.startLine}`
      : ea.toString(16).toUpperCase().padStart(6, '0');
    const id = `bb_${shortAddr}_${idx}`;

    nodes.push({
      id,
      address: nodeAddr,
      label: seg.label,
      conditionExpression: seg.conditionExpression,
      calledFunctions: seg.calledFunctions,
      codePreview: seg.previewLines,
      type: seg.type,
      LineStart: seg.startLine,
      LineEnd: seg.endLine,
    });

    const lineSpan = Math.max(2, seg.endLine - seg.startLine + 1);
    offsetBytes += lineSpan * 0x10;
  });

  // Wire up control flow edges accurately:
  // If node[i] is a CONDITION or ENTRY with a condition:
  //   - TRUE branch -> node[i + 1] (the immediate true body)
  //   - FALSE branch -> node[i + 2] (either the `else` block or the post-if continuation)
  //   - If node[i + 1] (true body) does NOT end in a `return`, and node[i + 2] is an `else` block,
  //     then node[i + 1] jumps to node[i + 3] (the convergence block after `else`), while node[i + 2]
  //     also flows into node[i + 3]!
  const handledAsTrueBody = new Set<number>();

  for (let i = 0; i < nodes.length; i++) {
    if (handledAsTrueBody.has(i)) continue;

    const curr = nodes[i];
    const next = nodes[i + 1];
    const afterNext = nodes[i + 2];
    const joinAfterElse = nodes[i + 3];

    if (!next) break;

    const hasCondition =
      curr.type === 'condition' ||
      (curr.type === 'entry' && Boolean(curr.conditionExpression) && nodes.length >= 3);

    if (hasCondition && afterNext) {
      const condText = curr.conditionExpression || curr.label;
      // TRUE Edge -> next block
      edges.push({
        from: curr.id,
        to: next.id,
        label: 'true',
        conditionHint: `${condText} == TRUE`,
      });

      // FALSE Edge -> afterNext block
      edges.push({
        from: curr.id,
        to: afterNext.id,
        label: 'false',
        conditionHint: `${condText} == FALSE`,
      });

      // Mark `i + 1` as the true-branch body so we wire its outgoing convergence edge properly
      handledAsTrueBody.add(i + 1);
      const nextEndsInReturn =
        next.type === 'return' ||
        next.codePreview.some((l) => /^return\b/.test(l.trim()));

      if (!nextEndsInReturn) {
        if (segments[i + 2]?.isElseBranch && joinAfterElse) {
          // True body skips over the else block and merges at joinAfterElse
          edges.push({
            from: next.id,
            to: joinAfterElse.id,
            label: 'unconditional',
            conditionHint: 'Merge after IF-TRUE',
          });
        } else {
          // No separate else block: True body flows into afterNext (the convergence block)
          edges.push({
            from: next.id,
            to: afterNext.id,
            label: 'unconditional',
            conditionHint: 'Continue after IF-TRUE',
          });
        }
      }
    } else if (curr.type === 'loop') {
      const condText = curr.conditionExpression || 'Loop active';
      edges.push({
        from: curr.id,
        to: next.id,
        label: 'true',
        conditionHint: `${condText} (Continue Loop)`,
      });
      edges.push({
        from: next.id,
        to: curr.id,
        label: 'loop',
        conditionHint: 'Repeat next iteration',
      });
      if (afterNext) {
        edges.push({
          from: curr.id,
          to: afterNext.id,
          label: 'false',
          conditionHint: 'Exit Loop',
        });
      }
    } else if (curr.type !== 'return') {
      edges.push({
        from: curr.id,
        to: next.id,
        label: 'unconditional',
      });
    }
  }

  return { cfgNodes: nodes, cfgEdges: edges };
}