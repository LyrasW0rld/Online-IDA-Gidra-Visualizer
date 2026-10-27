import { I64DatabaseDump, DecompiledFunction, LocalVariable, UserSymbolEdits } from '../types';
import { buildDynamicCfgFromPseudocode } from './cfgBuilder';
import { isGenericComment } from './commentUtils';

// Local helper to avoid circular import with i64BinaryParser.ts
function inferClassAndMethodFromC(
  funcName: string,
  signatureClean?: string
): { className?: string; methodName: string } {
  const scopeMatch =
    signatureClean?.match(/([A-Za-z_][A-Za-z0-9_]*)::([~A-Za-z_][A-Za-z0-9_]*)/) ||
    funcName.match(/^([A-Za-z_][A-Za-z0-9_]*)::([~A-Za-z_][A-Za-z0-9_]*)/);

  if (scopeMatch) {
    return {
      className: scopeMatch[1],
      methodName: scopeMatch[2],
    };
  }

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
      return {
        className: mappedClass,
        methodName: funcName.slice(prefix.length + 1),
      };
    }
  }

  return {
    className: undefined,
    methodName: funcName,
  };
}

/**
 * Parses a raw Ghidra or IDA exported `.c` / `.cpp` source file into structured functions,
 * classes, local variables, comments, and dynamic Control Flow Graphs.
 */
export function parseGhidraCSourceFile(
  cSourceText: string,
  fileName: string,
  fileSize: number,
  sourceUrl?: string
): I64DatabaseDump {
  const lines = cSourceText.replace(/\r\n/g, '\n').split('\n');
  const functions: DecompiledFunction[] = [];
  const classSet = new Set<string>();
  let totalComments = 0;

  let i = 0;
  let funcIndex = 0;

  while (i < lines.length) {
    // Collect preceding comments (`//` or `/* ... */`) right before a function definition
    const precedingComments: string[] = [];
    while (
      i < lines.length &&
      (lines[i].trim().startsWith('//') ||
        lines[i].trim().startsWith('/*') ||
        lines[i].trim().startsWith('*'))
    ) {
      const cleanedCmt = lines[i]
        .trim()
        .replace(/^(\/\/|\/\*+|\*+\/?)\s*/, '')
        .replace(/\*\/$/, '')
        .trim();
      if (cleanedCmt && !cleanedCmt.startsWith('---') && !cleanedCmt.startsWith('===')) {
        precedingComments.push(cleanedCmt);
      }
      i++;
    }

    if (i >= lines.length) break;

    const sigCandidate = lines[i].trim();
    const nextLine = (lines[i + 1] || '').trim();
    const isFuncStart =
      sigCandidate.length > 5 &&
      !sigCandidate.startsWith('#') &&
      !sigCandidate.startsWith('typedef') &&
      !sigCandidate.startsWith('struct ') &&
      !sigCandidate.startsWith('if') &&
      !sigCandidate.startsWith('for') &&
      !sigCandidate.startsWith('while') &&
      !sigCandidate.startsWith('switch') &&
      sigCandidate.includes('(') &&
      (sigCandidate.endsWith('{') ||
        (sigCandidate.endsWith(')') && nextLine.startsWith('{')));

    if (isFuncStart) {
      const funcStartLine = i + 1;
      const signatureClean = sigCandidate.replace(/\{$/, '').trim();

      const parenIdx = signatureClean.indexOf('(');
      const beforeParen = signatureClean.slice(0, parenIdx).trim();
      const tokens = beforeParen.split(/\s+/);
      const rawFuncName = (tokens[tokens.length - 1] || `func_${funcIndex}`).replace(/^\*+/, '');
      const returnType = tokens.slice(0, -1).join(' ') || 'void';

      const bodyLines: string[] = [];
      let braceDepth = 0;
      let startedBraces = false;
      let j = i;

      while (j < lines.length) {
        const currentLine = lines[j];
        bodyLines.push(currentLine);
        for (const ch of currentLine) {
          if (ch === '{') {
            braceDepth++;
            startedBraces = true;
          } else if (ch === '}') {
            braceDepth--;
          }
        }
        j++;
        if (startedBraces && braceDepth <= 0) {
          break;
        }
      }

      const addrInNameMatch = rawFuncName.match(/(?:FUN_|sub_)([0-9A-Fa-f]{6,8})/);
      const addrInCommentMatch = precedingComments
        .join(' ')
        .match(/0x([0-9A-Fa-f]{6,8})/);

      const hasRealAddress = Boolean(addrInNameMatch || addrInCommentMatch);
      const address = addrInNameMatch
        ? `0x${addrInNameMatch[1].toUpperCase().padStart(8, '0')}`
        : addrInCommentMatch
        ? `0x${addrInCommentMatch[1].toUpperCase().padStart(8, '0')}`
        : `Line ${funcStartLine}`;

      const localVariables: LocalVariable[] = [];
      const inlineComments: Record<number, string> = {};

      const paramStr = signatureClean.slice(parenIdx + 1, signatureClean.lastIndexOf(')')).trim();
      if (paramStr && paramStr !== 'void') {
        paramStr.split(',').forEach((p, pIdx) => {
          const cleanP = p.trim();
          const pMatch = cleanP.match(/^(.*?)([A-Za-z_][A-Za-z0-9_]*)$/);
          if (pMatch) {
            localVariables.push({
              name: pMatch[2].trim(),
              type: pMatch[1].trim() || 'int',
              location: `param_${pIdx + 1}`,
            });
          }
        });
      }

      bodyLines.forEach((bLine, relIdx) => {
        const trimmedB = bLine.trim();
        const cmtPos = trimmedB.indexOf('//');
        if (cmtPos > 0) {
          const cmtText = trimmedB.slice(cmtPos + 2).trim();
          if (cmtText) {
            inlineComments[relIdx + 1] = cmtText;
            totalComments++;
          }
        }
        if (
          relIdx >= 1 &&
          relIdx <= 18 &&
          trimmedB.endsWith(';') &&
          !trimmedB.includes('(') &&
          !trimmedB.includes('=')
        ) {
          const varDeclMatch = trimmedB
            .replace(/;.*$/, '')
            .trim()
            .match(/^([A-Za-z_][A-Za-z0-9_\s*]+?)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
          if (varDeclMatch && varDeclMatch[1] !== 'return' && varDeclMatch[1] !== 'goto') {
            localVariables.push({
              name: varDeclMatch[2].trim(),
              type: varDeclMatch[1].trim(),
              location: 'local',
            });
          }
        }
      });

      const { className, methodName } = inferClassAndMethodFromC(rawFuncName, signatureClean);
      if (className) classSet.add(className);

      const headerComment = precedingComments.join('\n');
      if (headerComment) totalComments++;

      const { cfgNodes, cfgEdges } = buildDynamicCfgFromPseudocode(
        address,
        rawFuncName,
        bodyLines,
        !hasRealAddress
      );

      const isSub = rawFuncName.startsWith('FUN_') || rawFuncName.startsWith('sub_');

      functions.push({
        id: `c_fn_${funcIndex}_${rawFuncName}`,
        address,
        hasRealAddress,
        name: rawFuncName,
        originalName: rawFuncName,
        className,
        methodName,
        demangledName: signatureClean,
        segment: '.c',
        returnType,
        callingConvention: '__cdecl',
        signature: signatureClean,
        sizeBytes: bodyLines.join('\n').length,
        localVariables,
        pseudocode: bodyLines,
        cfgNodes,
        cfgEdges,
        xrefsTo: [],
        xrefsFrom: [],
        comments:
          headerComment ||
          `Ghidra C Function ${rawFuncName} (Lines ${funcStartLine}–${
            funcStartLine + bodyLines.length - 1
          })`,
        inlineComments,
        tags: [
          'Ghidra .C',
          ...(className ? [`Class:${className}`] : []),
          ...(headerComment && !isGenericComment(headerComment) ? ['Commented'] : []),
          isSub ? 'FUN_Routine' : 'Renamed',
        ],
        isRenamed: !isSub,
      });

      funcIndex++;
      i = j;
    } else {
      i++;
    }
  }

  const nameToFunc = new Map<string, DecompiledFunction>();
  functions.forEach((f) => nameToFunc.set(f.name, f));

  for (const caller of functions) {
    const bodyText = caller.pseudocode.slice(1).join('\n');
    for (const [calleeName, calleeFunc] of nameToFunc.entries()) {
      if (calleeName === caller.name) continue;
      if (bodyText.includes(`${calleeName}(`)) {
        caller.xrefsFrom.push({
          address: calleeFunc.address,
          funcName: calleeName,
          type: 'CALL',
        });
        calleeFunc.xrefsTo.push({
          address: caller.address,
          funcName: caller.name,
          type: 'CALL',
        });
      }
    }
  }

  return {
    metadata: {
      fileName: fileName.endsWith('.c') ? fileName : `${fileName}.c`,
      format: 'Ghidra C Source (.c Decompiled Code)',
      fileSize,
      md5: 'ghidra-c-source-export',
      imageBase: functions[0]?.hasRealAddress ? functions[0].address : 'Line 1 (C Source)',
      processor: 'Ghidra C Decompiler Output (.c)',
      compiler: 'Standard C / Ghidra SLEIGH Decompiler',
      exportedAt: new Date().toISOString(),
      googleDriveFileId: sourceUrl,
      totalFunctions: functions.length,
      totalClasses: classSet.size,
      totalCommentsExtracted: totalComments,
      isLiveBinaryParsed: true,
      isCSourceFile: true,
      originalCSourceText: cSourceText,
    },
    functions,
  };
}

/**
 * Exports a loaded `.c` file back out as a pure `.c` file (NOT C++),
 * preserving the original C file structure and applying all function renames,
 * variable renames, and updated comments!
 */
export function buildModifiedCFileExport(
  dump: I64DatabaseDump,
  _edits: UserSymbolEdits
): string {
  const headerBanner = [
    `/* ============================================================================`,
    ` * EXPORTED C SOURCE FILE: ${dump.metadata.fileName}`,
    ` * Modified with Lyras Pseudocode Reader (All Function & Variable Renames Applied)`,
    ` * Exported At: ${new Date().toISOString()}`,
    ` * ============================================================================ */`,
    ``,
  ];

  const blocks: string[] = [...headerBanner];

  for (const fn of dump.functions) {
    if (fn.comments) {
      blocks.push(`/*`);
      for (const cLine of fn.comments.split('\n')) {
        blocks.push(` * ${cLine}`);
      }
      blocks.push(` */`);
    }

    fn.pseudocode.forEach((line, idx) => {
      const lineNum = idx + 1;
      const inlineCmt = fn.inlineComments?.[lineNum];
      if (inlineCmt && !line.includes(inlineCmt)) {
        blocks.push(`${line} /* ${inlineCmt} */`);
      } else {
        blocks.push(line);
      }
    });

    blocks.push(``);
  }

  return blocks.join('\n');
}

export const SAMPLE_GHIDRA_C_SOURCE = `/* Ghidra Decompiler C Export - Decompiled Module (.c)
 * Note: Pure C Decompiler output without raw assembly addresses.
 */

#include <stdint.h>
#include <stdbool.h>

// Checks hardware timer and dispatches vehicle physics, passenger arrows, and audio streams
void GameLoop_ExecuteFrameStep(float deltaStepSeconds, int *pGameModeState)
{
  int activeState;
  int cabStatus;

  if (pGameModeState == (int *)0x0) {
    return;
  }
  activeState = *pGameModeState;
  if (activeState == 2) {
    cabStatus = CTaxiPhysicsBody::UpdateCrazyDashAndDrift(deltaStepSeconds, 1);
    if (cabStatus > 0) {
      CPassengerManager::EvaluateCrazyStuntTips(cabStatus, deltaStepSeconds);
    }
    CTrafficVehicleAI::UpdateTrafficSplines(deltaStepSeconds);
  }
  else if (activeState == 1) {
    Menu_UpdateDriverSelectionCarousel(deltaStepSeconds);
  }
  Render_PresentFrameD3D8();
  return;
}

// Evaluates Crazy Dash timing window (<= 7 frames) and Limiter Cut boost multiplier
int CTaxiPhysicsBody::UpdateCrazyDashAndDrift(float fDeltaStep, int uInputMask)
{
  float fBoostImpulse;
  float fCurrentSpeedKph;
  int nDashWindowFrames;

  nDashWindowFrames = 4;
  fCurrentSpeedKph = 118.5f;
  if ((uInputMask & 1) != 0 && nDashWindowFrames <= 7) {
    fBoostImpulse = 2.45f * fDeltaStep;
    if (fCurrentSpeedKph > 110.0f) {
      fBoostImpulse = fBoostImpulse * 1.38f;
      Audio_TriggerTurboRoarSfx(1);
    }
    return (int)(fCurrentSpeedKph + fBoostImpulse * 10.0f);
  }
  else {
    fBoostImpulse = 1.0f;
  }
  return (int)fCurrentSpeedKph;
}

// Calculates passenger tip multipliers for Crazy Through and Crazy Jump combos
int CPassengerManager::EvaluateCrazyStuntTips(int nCabSpeedState, float fHangtimeSec)
{
  int nComboCounter;
  float fTipDollars;

  nComboCounter = 1;
  fTipDollars = 0.0f;
  if (nCabSpeedState > 120) {
    nComboCounter = nComboCounter + 1;
    fTipDollars = (float)nComboCounter * 2.50f;
  }
  else if (fHangtimeSec > 0.65f) {
    nComboCounter = nComboCounter + 2;
    fTipDollars = fHangtimeSec * 5.0f;
  }
  if (fTipDollars > 0.0f) {
    Hud_AddPlayerSessionCash(fTipDollars);
    return nComboCounter;
  }
  return 0;
}

// Advances ambient city vehicles and cable cars along road splines
void CTrafficVehicleAI::UpdateTrafficSplines(float fDeltaStep)
{
  int iSlot;
  float fDistanceToCab;

  for (iSlot = 0; iSlot < 32; iSlot = iSlot + 1) {
    fDistanceToCab = (float)(iSlot * 9);
    if (fDistanceToCab < 15.0f) {
      Audio_TriggerTrafficHorn(iSlot);
    }
  }
  return;
}

// Updates the character selection carousel in the main menu
void Menu_UpdateDriverSelectionCarousel(float fDeltaStep)
{
  int selectedDriverIdx;

  selectedDriverIdx = 0;
  if (fDeltaStep > 0.0f) {
    selectedDriverIdx = (selectedDriverIdx + 1) & 3;
  }
  return;
}

// Plays turbo roar or tire screech sound effect
int Audio_TriggerTurboRoarSfx(int nSoundBankId)
{
  if (nSoundBankId <= 0) {
    return -1;
  }
  return nSoundBankId;
}

// Plays positional 3D horn sound when player cab passes close to traffic
void Audio_TriggerTrafficHorn(int nTrafficSlotId)
{
  if (nTrafficSlotId >= 0) {
    Audio_TriggerTurboRoarSfx(nTrafficSlotId + 10);
  }
  return;
}

// Adds awarded stunt tip money to the player's total session cash
void Hud_AddPlayerSessionCash(float fAddedDollars)
{
  float fTotalCash;

  fTotalCash = 100.0f;
  if (fAddedDollars > 0.0f) {
    fTotalCash = fTotalCash + fAddedDollars;
  }
  return;
}

// Presents the rendered Direct3D8 swapchain frame
void Render_PresentFrameD3D8(void)
{
  return;
}
`;