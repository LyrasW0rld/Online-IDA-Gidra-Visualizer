import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CFGNode, DecompiledFunction } from '../types';
import {
  Crosshair,
  ZoomIn,
  ZoomOut,
  GitFork,
  PanelRightClose,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  CornerDownRight,
  Move,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface ControlFlowGraphProps {
  func: DecompiledFunction;
  activeNodeId: string | null;
  onSelectNode: (node: CFGNode) => void;
  onJumpToFunction?: (funcOrAddress: string) => void;
  lang: 'en' | 'de';
  maxBranches: number;
  onChangeMaxBranches?: (val: number) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onCollapse?: () => void;
  onWiden?: () => void;
  onNarrow?: () => void;
  canWiden?: boolean;
  canNarrow?: boolean;
}

export const ControlFlowGraph: React.FC<ControlFlowGraphProps> = ({
  func,
  activeNodeId,
  onSelectNode,
  onJumpToFunction,
  lang,
  maxBranches,
  onChangeMaxBranches,
  isMaximized = false,
  onToggleMaximize,
  onCollapse,
  onWiden,
  onNarrow,
  canWiden = true,
  canNarrow = true,
}) => {
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 24 });
  const [zoom, setZoom] = useState<number>(0.95);
  const [compactNodes, setCompactNodes] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 24,
  });

  const [hoveredNode, setHoveredNode] = useState<{
    node: CFGNode;
    branchTag?: 'TRUE' | 'FALSE';
  } | null>(null);

  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});

  // Reset view, auto-fit zoom & custom root when switching to a different function
  useEffect(() => {
    setRootNodeId(null);
    setCollapsedBranches({});
    setHoveredNode(null);
    setPan({ x: 0, y: 24 });

    // Responsive initial zoom based on available panel width
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      if (width > 0 && width < 360) {
        setCompactNodes(true);
        setZoom(0.75);
      } else if (width > 0 && width < 480) {
        setZoom(0.85);
      } else {
        setZoom(0.95);
      }
    }
  }, [func.id]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, CFGNode>();
    func.cfgNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [func.cfgNodes]);

  const effectiveRootNode: CFGNode | undefined = useMemo(() => {
    if (rootNodeId && nodeMap.has(rootNodeId)) {
      return nodeMap.get(rootNodeId);
    }
    return func.cfgNodes[0];
  }, [rootNodeId, nodeMap, func.cfgNodes]);

  const handleResetView = () => {
    setPan({ x: 0, y: 24 });
    setZoom(0.95);
  };

  // Mouse Drag Panning Handlers
  const handleMouseDownCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start dragging on primary mouse button and not when clicking interactive buttons
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUpCanvas = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  // Mouse Wheel Zoom Handler
  const handleWheelCanvas = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.min(1.6, Math.max(0.4, +(z + delta).toFixed(2))));
  };

  const handleDoubleClickBranchTarget = (targetNode: CFGNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setRootNodeId(targetNode.id);
    setPan({ x: 0, y: 24 });
    onSelectNode(targetNode);
  };

  const toggleBranchCollapse = (branchKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedBranches((prev) => ({
      ...prev,
      [branchKey]: !prev[branchKey],
    }));
  };

  const getBadgeStyle = (type: CFGNode['type']) => {
    switch (type) {
      case 'entry':
        return 'bg-[#FFCC00] text-black font-semibold';
      case 'condition':
        return 'bg-amber-400 text-black font-semibold';
      case 'loop':
        return 'bg-sky-400 text-black font-semibold';
      case 'return':
        return 'bg-emerald-400 text-black font-semibold';
      default:
        return 'bg-zinc-200 text-black font-medium';
    }
  };

  const hoveredFullCodeLines = useMemo(() => {
    if (!hoveredNode) return [];
    const { LineStart, LineEnd } = hoveredNode.node;
    return func.pseudocode.slice(
      Math.max(0, LineStart - 1),
      Math.min(func.pseudocode.length, LineEnd)
    );
  }, [hoveredNode, func.pseudocode]);

  const renderDownArrow = (colorClass = 'border-[#FFCC00]', lineClass = 'bg-[#FFCC00]') => (
    <div className="flex flex-col items-center shrink-0">
      <div className={`w-0.5 h-5 ${lineClass}`} />
      <div className={`w-2.5 h-2.5 rotate-45 border-b-2 border-r-2 ${colorClass} -mt-1.5`} />
    </div>
  );

  /**
   * Every single CFG Node Card has a fixed, uniform width (`w-[320px] min-w-[320px] max-w-[320px] shrink-0`)
   * so NO node is ever squished regardless of tree depth or branching factor!
   */
  const renderNodeCard = (node: CFGNode, branchTag?: 'TRUE' | 'FALSE') => {
    const isSelected = activeNodeId === node.id;
    const isCurrentRoot = effectiveRootNode?.id === node.id && rootNodeId !== null;

    const outgoing = func.cfgEdges.filter((e) => e.from === node.id);
    const nextUncond = outgoing.find((e) => e.label === 'unconditional');
    const nextTargetNode = nextUncond ? nodeMap.get(nextUncond.to) : undefined;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(node);
        }}
        onDoubleClick={(e) => handleDoubleClickBranchTarget(node, e)}
        onMouseEnter={() => setHoveredNode({ node, branchTag })}
        onMouseLeave={() =>
          setHoveredNode((prev) => (prev?.node.id === node.id ? null : prev))
        }
        className={`${
          compactNodes
            ? 'w-[260px] min-w-[260px] max-w-[260px]'
            : 'w-[320px] min-w-[320px] max-w-[320px]'
        } shrink-0 rounded-lg border-2 transition-colors cursor-pointer shadow-xl overflow-hidden ${
          isSelected
            ? 'border-[#FFCC00] bg-[#181C26] ring-2 ring-[#FFCC00]/50'
            : branchTag === 'TRUE'
            ? 'border-emerald-500/70 bg-[#11171A] hover:border-emerald-400'
            : branchTag === 'FALSE'
            ? 'border-rose-500/70 bg-[#191216] hover:border-rose-400'
            : 'border-zinc-700 bg-[#12151E] hover:border-[#FFCC00]/80'
        }`}
      >
        {/* Node Header */}
        <div
          className={`px-3.5 py-2 border-b space-y-1.5 ${
            isSelected
              ? 'bg-[#FFCC00] text-black border-black/20'
              : 'bg-zinc-900 text-zinc-100 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isCurrentRoot && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-400 text-black font-extrabold uppercase shrink-0">
                ROOT
              </span>
            )}
            {branchTag && (
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                  branchTag === 'TRUE'
                    ? 'bg-emerald-400 text-black'
                    : 'bg-rose-400 text-black'
                }`}
              >
                {branchTag}
              </span>
            )}
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded uppercase shrink-0 ${
                isSelected ? 'bg-black text-[#FFCC00] font-semibold' : getBadgeStyle(node.type)
              }`}
            >
              {node.type}
            </span>
            <span
              className={`font-mono text-xs font-semibold truncate ${
                isSelected ? 'text-black' : 'text-amber-200'
              }`}
              title={node.label}
            >
              {node.label}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-current/10">
            <span
              onDoubleClick={(e) => handleDoubleClickBranchTarget(node, e)}
              title={
                lang === 'de'
                  ? 'Doppelklick: Diesen Zweig als neuen Startpunkt (Root) setzen'
                  : 'Double-click: Set this branch as the new CFG Root'
              }
              className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                isSelected
                  ? 'bg-black/15 text-black font-bold'
                  : 'bg-black/60 text-[#FFCC00] border border-zinc-800 font-semibold hover:bg-[#FFCC00] hover:text-black'
              }`}
            >
              {node.address}
            </span>
            <span
              className={`text-[11px] font-mono ${
                isSelected ? 'text-black/80 font-semibold' : 'text-zinc-400'
              }`}
            >
              {lang === 'de' ? 'Zeile' : 'Lines'} {node.LineStart}–{node.LineEnd}
            </span>
          </div>
        </div>

        {/* Node Body: Same uniform height & spacing for clean visual alignment */}
        <div
          className={`font-mono space-y-2 bg-[#0B0D12] flex flex-col justify-between ${
            compactNodes ? 'p-2 min-h-[95px] text-[11px]' : 'p-3 min-h-[125px] text-xs'
          }`}
        >
          <div className="space-y-1.5">
            {node.conditionExpression && (
              <div className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] font-mono break-words">
                <strong className="text-[#FFCC00] mr-1">
                  {lang === 'de' ? 'Bedingung:' : 'Condition:'}
                </strong>
                <code>{node.conditionExpression}</code>
              </div>
            )}

            {node.calledFunctions && node.calledFunctions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] font-bold uppercase text-sky-400 mr-1">
                  {lang === 'de' ? 'Ruft auf:' : 'Calls:'}
                </span>
                {node.calledFunctions.map((callee) => (
                  <button
                    key={callee}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToFunction?.(callee);
                    }}
                    title={
                      lang === 'de'
                        ? `Springe zu Funktion ${callee}()`
                        : `Jump to function ${callee}()`
                    }
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-500/40 hover:bg-[#FFCC00] hover:text-black font-semibold transition-colors"
                  >
                    ⚡ {callee}()
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              {node.codePreview.slice(0, 3).map((line, i) => (
                <div
                  key={i}
                  className="text-zinc-100 truncate pl-2 border-l-2 border-[#FFCC00]/60 leading-relaxed"
                  title={line}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div>
            {nextTargetNode && branchTag && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(nextTargetNode);
                }}
                onDoubleClick={(e) => handleDoubleClickBranchTarget(nextTargetNode, e)}
                className="mb-1.5 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-amber-300 hover:text-[#FFCC00]"
              >
                <span>
                  {lang === 'de' ? 'Führt weiter zu:' : 'Continues to:'}{' '}
                  <strong>{nextTargetNode.address}</strong>
                </span>
                <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
              </div>
            )}

            <div className="pt-1 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-400">
              <span>
                {lang === 'de'
                  ? 'Doppelklick = Root Fokus'
                  : 'Double-click = Focus Root'}
              </span>
              <span className="inline-flex items-center gap-1 text-[#FFCC00] font-medium">
                <Crosshair className="w-3 h-3" /> Sync
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Unconstrained horizontal & vertical tree layout (`w-max shrink-0`):
   * Child branches sit side-by-side in a `flex-row gap-10 w-max` container so they NEVER compress
   * or squish each other! The user can freely pan left/right/up/down across the entire tree.
   */
  const renderRecursiveSubtree = (
    currentNodeId: string,
    visited: Set<string>,
    depth: number,
    branchTag?: 'TRUE' | 'FALSE'
  ): React.ReactNode => {
    if (depth > maxBranches || visited.has(currentNodeId)) {
      return null;
    }

    const node = nodeMap.get(currentNodeId);
    if (!node) return null;

    const nextVisited = new Set(visited);
    nextVisited.add(currentNodeId);

    const outgoing = func.cfgEdges.filter((e) => e.from === currentNodeId);
    const trueEdge = outgoing.find((e) => e.label === 'true');
    const falseEdge = outgoing.find((e) => e.label === 'false');
    const loopEdge = outgoing.find((e) => e.label === 'loop');
    const uncondEdge = outgoing.find((e) => e.label === 'unconditional');

    const trueNode = trueEdge ? nodeMap.get(trueEdge.to) : undefined;
    const falseNode = falseEdge ? nodeMap.get(falseEdge.to) : undefined;

    // Case 1: Condition / Branch Split with independent TRUE (left) and FALSE (right) subtrees
    if (trueNode && falseNode && trueNode.id !== falseNode.id) {
      const trueBranchKey = `${node.id}_TRUE`;
      const falseBranchKey = `${node.id}_FALSE`;
      const isTrueCollapsed = Boolean(collapsedBranches[trueBranchKey]);
      const isFalseCollapsed = Boolean(collapsedBranches[falseBranchKey]);

      const trueBranchVisited = new Set(nextVisited);
      trueBranchVisited.add(falseNode.id);

      const falseBranchVisited = new Set(nextVisited);
      falseBranchVisited.add(trueNode.id);

      return (
        <div key={`${node.id}_d${depth}`} className="flex flex-col items-center w-max shrink-0">
          {renderNodeCard(node, branchTag)}

          {/* Stem down from parent condition block */}
          <div className="w-0.5 h-5 bg-[#FFCC00] shrink-0" />

          {/* Unconstrained Horizontal Fork Container: Left (TRUE) and Right (FALSE) Subtrees */}
          <div className="grid grid-cols-2 items-start justify-center w-max shrink-0">
            {/* LEFT SUBTREE: TRUE BRANCH */}
            <div className="flex flex-col items-center w-max shrink-0 px-3 sm:px-5">
              {/* Pixel-perfect True branch connector: starts at column center and extends to the right edge */}
              <div className="w-full relative h-4 shrink-0">
                <div className="absolute top-0 left-1/2 right-0 h-0.5 bg-emerald-400" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-emerald-400" />
              </div>
              <div className="w-2.5 h-2.5 rotate-45 border-b-2 border-r-2 border-emerald-400 -mt-1.5 shrink-0" />

              <div className="my-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => toggleBranchCollapse(trueBranchKey, e)}
                  className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-black font-mono font-bold text-xs inline-flex items-center gap-1 shadow-md transition-colors"
                >
                  {isTrueCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>TRUE → {trueNode.address}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDoubleClickBranchTarget(trueNode, e)}
                  className="px-2 py-1 rounded bg-zinc-800 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-400 hover:text-black text-[11px] font-mono font-bold transition-colors"
                >
                  Focus
                </button>
              </div>

              {!isTrueCollapsed && renderDownArrow('border-emerald-400', 'bg-emerald-400')}

              {isTrueCollapsed ? (
                <button
                  type="button"
                  onClick={(e) => toggleBranchCollapse(trueBranchKey, e)}
                  className={`mt-1 ${
                    compactNodes ? 'w-[260px]' : 'w-[320px]'
                  } py-3 px-4 rounded-lg border-2 border-dashed border-emerald-500/60 bg-emerald-950/25 text-emerald-300 text-xs font-mono hover:bg-emerald-950/45 transition-colors text-center`}
                >
                  + {lang === 'de' ? 'TRUE-Zweig ausklappen' : 'Expand TRUE Branch'} (
                  {trueNode.label})
                </button>
              ) : (
                <div className="mt-1">
                  {renderRecursiveSubtree(trueNode.id, trueBranchVisited, depth + 1, 'TRUE')}
                </div>
              )}
            </div>

            {/* RIGHT SUBTREE: FALSE BRANCH */}
            <div className="flex flex-col items-center w-max shrink-0 px-3 sm:px-5">
              {/* Pixel-perfect False branch connector: starts at the left edge and ends at column center */}
              <div className="w-full relative h-4 shrink-0">
                <div className="absolute top-0 left-0 right-1/2 h-0.5 bg-rose-400" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-rose-400" />
              </div>
              <div className="w-2.5 h-2.5 rotate-45 border-b-2 border-r-2 border-rose-400 -mt-1.5 shrink-0" />

              <div className="my-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => toggleBranchCollapse(falseBranchKey, e)}
                  className="px-2.5 py-1 rounded bg-rose-400 hover:bg-rose-300 text-black font-mono font-bold text-xs inline-flex items-center gap-1 shadow-md transition-colors"
                >
                  {isFalseCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>FALSE → {falseNode.address}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDoubleClickBranchTarget(falseNode, e)}
                  className="px-2 py-1 rounded bg-zinc-800 text-rose-300 border border-rose-500/40 hover:bg-rose-400 hover:text-black text-[11px] font-mono font-bold transition-colors"
                >
                  Focus
                </button>
              </div>

              {!isFalseCollapsed && renderDownArrow('border-rose-400', 'bg-rose-400')}

              {isFalseCollapsed ? (
                <button
                  type="button"
                  onClick={(e) => toggleBranchCollapse(falseBranchKey, e)}
                  className={`mt-1 ${
                    compactNodes ? 'w-[260px]' : 'w-[320px]'
                  } py-3 px-4 rounded-lg border-2 border-dashed border-rose-500/60 bg-rose-950/25 text-rose-300 text-xs font-mono hover:bg-rose-950/45 transition-colors text-center`}
                >
                  + {lang === 'de' ? 'FALSE-Zweig ausklappen' : 'Expand FALSE Branch'} (
                  {falseNode.label})
                </button>
              ) : (
                <div className="mt-1">
                  {renderRecursiveSubtree(falseNode.id, falseBranchVisited, depth + 1, 'FALSE')}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Case 2: Linear / Unconditional or Loop node
    const nextTargetId = uncondEdge?.to || trueEdge?.to || falseEdge?.to;
    const nextNode = nextTargetId ? nodeMap.get(nextTargetId) : undefined;

    return (
      <div key={`${node.id}_d${depth}`} className="flex flex-col items-center w-max shrink-0">
        {renderNodeCard(node, branchTag)}

        {loopEdge && (
          <div className="mt-1.5 px-3 py-1 rounded bg-sky-500/20 border border-sky-400/50 text-sky-300 text-xs font-mono">
            ↺ {lang === 'de' ? 'SCHLEIFE ZURÜCK →' : 'LOOP BACK →'}{' '}
            {nodeMap.get(loopEdge.to)?.address || loopEdge.to}
          </div>
        )}

        {nextNode && !nextVisited.has(nextNode.id) && depth < maxBranches && (
          <>
            <div className="my-1">{renderDownArrow('border-[#FFCC00]', 'bg-[#FFCC00]')}</div>
            {renderRecursiveSubtree(nextNode.id, nextVisited, depth + 1)}
          </>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[#090B10] select-none relative overflow-hidden">
      {/* Header with Resize, Depth, Reset View / Root & Collapse Controls */}
      <div className="p-2.5 border-b border-zinc-800 bg-[#12151E] flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-6 bg-[#FFCC00] shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold tracking-wide text-[#FFCC00] flex items-center gap-1.5 truncate">
              <GitFork className="w-4 h-4 text-[#FFCC00] shrink-0" />
              {lang === 'de' ? '2D CFG-Graph' : '2D CFG Graph'}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-zinc-300 font-mono truncate">
              {rootNodeId && effectiveRootNode
                ? `Root: ${effectiveRootNode.address} (${effectiveRootNode.label})`
                : lang === 'de'
                ? 'Pan & Zoom'
                : 'Pan & Zoom'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {onChangeMaxBranches && (
            <div className="flex items-center gap-1 bg-[#090B10] px-1.5 py-0.5 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300">
              <span className="text-[#FFCC00] font-semibold hidden sm:inline">
                {lang === 'de' ? 'Tiefe:' : 'Depth:'}
              </span>
              <button
                type="button"
                onClick={() => onChangeMaxBranches(Math.max(1, maxBranches - 1))}
                className="w-4 h-4 rounded bg-zinc-800 hover:bg-[#FFCC00] hover:text-black text-center font-bold text-xs"
                title={lang === 'de' ? 'Graph-Tiefe verringern' : 'Decrease Graph Depth'}
              >
                -
              </button>
              <span className="w-4 text-center font-bold text-white">{maxBranches}</span>
              <button
                type="button"
                onClick={() => onChangeMaxBranches(Math.min(30, maxBranches + 1))}
                className="w-4 h-4 rounded bg-zinc-800 hover:bg-[#FFCC00] hover:text-black text-center font-bold text-xs"
                title={lang === 'de' ? 'Graph-Tiefe erhöhen' : 'Increase Graph Depth'}
              >
                +
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCompactNodes((v) => !v)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
              compactNodes
                ? 'bg-[#FFCC00] text-black font-bold'
                : 'bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title={
              lang === 'de'
                ? 'Kompakte / Standard Knotenbreite umschalten'
                : 'Toggle Compact / Normal Node Width'
            }
          >
            {compactNodes ? 'Compact' : 'Normal'}
          </button>

          {rootNodeId && (
            <button
              type="button"
              onClick={() => {
                setRootNodeId(null);
                setPan({ x: 0, y: 24 });
                if (func.cfgNodes[0]) onSelectNode(func.cfgNodes[0]);
              }}
              className="px-1.5 py-0.5 rounded bg-[#FFCC00] text-black font-mono font-bold text-[10px] inline-flex items-center gap-1 hover:bg-[#FFD633]"
              title={
                lang === 'de'
                  ? 'Zurück zum Funktions-Anfang (Entry Root)'
                  : 'Reset CFG to Function Entry Root'
              }
            >
              <RotateCcw className="w-3 h-3" />
              <span>Entry</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetView}
            className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black text-[10px] font-mono inline-flex items-center gap-1 transition-colors"
            title={lang === 'de' ? 'Ansicht zentrieren' : 'Center / Reset View'}
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">{lang === 'de' ? 'Center' : 'Center'}</span>
          </button>

          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              className={`p-1 rounded transition-colors ${
                isMaximized
                  ? 'bg-[#FFCC00] text-black font-bold'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black'
              }`}
              title={
                isMaximized
                  ? lang === 'de'
                    ? 'Graph verkleinern'
                    : 'Restore Graph Size'
                  : lang === 'de'
                  ? 'Graph maximieren (Vollbild)'
                  : 'Maximize Graph Panel'
              }
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onWiden && (
            <button
              type="button"
              onClick={onWiden}
              disabled={!canWiden}
              className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black disabled:opacity-40 transition-colors"
              title={lang === 'de' ? 'Graph-Panel verbreitern' : 'Widen Graph Panel'}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          {onNarrow && (
            <button
              type="button"
              onClick={onNarrow}
              disabled={!canNarrow}
              className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black disabled:opacity-40 transition-colors"
              title={lang === 'de' ? 'Graph-Panel schmaler machen' : 'Narrow Graph Panel'}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
            className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black transition-colors"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(0.95)}
            className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-mono hover:bg-[#FFCC00] hover:text-black transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}
            className="p-1 rounded bg-zinc-800 text-zinc-200 hover:bg-[#FFCC00] hover:text-black transition-colors"
          >
            <ZoomIn className="w-3 h-3" />
          </button>

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-[#FFCC00] hover:text-black transition-colors ml-0.5"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sleek Compact Legend Bar */}
      <div className="px-3 py-1 border-b border-zinc-800/80 bg-[#0D0F15] flex items-center justify-between gap-2 text-[11px] shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            TRUE
          </span>
          <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
            FALSE
          </span>
          <span className="inline-flex items-center gap-1 text-sky-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Calls / Loop
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#FFCC00] hidden sm:inline-flex items-center gap-1">
          <Move className="w-3 h-3" />
          {compactNodes ? '260px Nodes' : '320px Nodes'}
        </span>
      </div>

      {/* NON-GLITCHING FLOATING HOVER OVERLAY */}
      {hoveredNode && (
        <div className="pointer-events-none absolute bottom-2 right-2 max-w-[340px] w-auto p-2.5 rounded-lg border border-[#FFCC00]/80 bg-[#111520]/95 backdrop-blur-md shadow-2xl z-40 space-y-1">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-700 pb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="bg-[#FFCC00] text-black font-mono font-bold text-[9px] px-1 py-0.2 rounded uppercase shrink-0">
                {hoveredNode.node.type}
              </span>
              <span className="font-mono text-xs font-bold text-white truncate">
                {hoveredNode.node.label}
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold text-[#FFCC00] shrink-0">
              {hoveredNode.node.address} (L{hoveredNode.node.LineStart}–{hoveredNode.node.LineEnd})
            </span>
          </div>
          <pre className="p-1.5 rounded bg-black/90 border border-zinc-800 font-mono text-[10px] text-emerald-300 max-h-24 overflow-hidden whitespace-pre-wrap break-words leading-tight">
            {hoveredFullCodeLines.length > 0
              ? hoveredFullCodeLines.slice(0, 4).join('\n')
              : hoveredNode.node.codePreview.slice(0, 4).join('\n')}
          </pre>
        </div>
      )}

      {/* UNLIMITED 2D PANNABLE & ZOOMABLE GRAPH VIEWPORT */}
      <div
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        onMouseLeave={handleMouseUpCanvas}
        onWheel={handleWheelCanvas}
        className={`flex-1 relative overflow-hidden bg-[radial-gradient(#1e2433_1px,transparent_1px)] [background-size:20px_20px] ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          className="absolute left-1/2 top-0 origin-top transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(calc(-50% + ${pan.x}px), ${pan.y}px, 0) scale(${zoom})`,
          }}
        >
          {effectiveRootNode ? (
            <div className="p-8 pb-48 w-max">
              {renderRecursiveSubtree(effectiveRootNode.id, new Set<string>(), 1)}
            </div>
          ) : (
            <div className="text-xs font-mono text-zinc-400 text-center py-12">
              {lang === 'de' ? 'Keine CFG-Blöcke vorhanden.' : 'No CFG blocks available.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};