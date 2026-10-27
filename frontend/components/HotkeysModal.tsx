import React, { useEffect } from 'react';
import {
  Keyboard,
  X,
  Compass,
  Code2,
  GitFork,
  Move,
  Maximize2,
  Columns,
  Sparkles,
  Search,
} from 'lucide-react';

interface HotkeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'de';
}

interface ShortcutItem {
  keys: string[];
  action: string;
  description: string;
}

interface ShortcutCategory {
  title: string;
  icon: React.ReactNode;
  items: ShortcutItem[];
}

export const HotkeysModal: React.FC<HotkeysModalProps> = ({ isOpen, onClose, lang }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories: ShortcutCategory[] = [
    {
      title: 'Navigation & Workspace',
      icon: <Compass className="w-4 h-4 text-sky-400" />,
      items: [
        {
          keys: ['G'],
          action: 'Go to Address / Symbol',
          description: 'Jump directly to any hex address (e.g. 0x00418A20), function name, or keyword.',
        },
        {
          keys: ['M'],
          action: 'Toggle Top Menu',
          description: 'Collapse or expand the upper header navbar to maximize code workspace.',
        },
        {
          keys: ['Esc'],
          action: 'Close Modal',
          description: 'Instantly dismiss any open popup window, dialog, or search box.',
        },
        {
          keys: ['Click Token'],
          action: 'Highlight Occurrences',
          description: 'Click any variable, function or identifier to highlight all usages in the code.',
        },
      ],
    },
    {
      title: 'Editing & Type Analysis',
      icon: <Code2 className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          keys: ['Double-Click Number'],
          action: 'Value Type Calculator',
          description: 'Double-click any integer, hex offset, or float literal in pseudocode for live bitwise, hex, float, and ASCII conversions.',
        },
        {
          keys: ['E'],
          action: 'Quick Edit Symbol / Comment',
          description: 'Edit local variable type, variable name, or line comment for the currently active function.',
        },
        {
          keys: ['Double-Click Var/Func'],
          action: 'Rename Symbol Live',
          description: 'Rename a function or variable directly in the code with full C++ project export synchronization.',
        },
      ],
    },
    {
      title: '2D Control Flow Graph (CFG)',
      icon: <GitFork className="w-4 h-4 text-sky-400" />,
      items: [
        {
          keys: ['Mouse Drag Canvas'],
          action: 'Pan Graph (2D)',
          description: 'Click and drag anywhere on the graph background to smoothly pan across complex logic trees.',
        },
        {
          keys: ['Mouse Wheel'],
          action: 'Zoom In / Out',
          description: 'Scroll mouse wheel to zoom dynamically between 40% and 160% with instant focus centering.',
        },
        {
          keys: ['Double-Click Node'],
          action: 'Set as Subtree Root',
          description: 'Isolate and focus on a specific branch, if-condition, or loop target as the new root of the tree.',
        },
        {
          keys: ['Depth [- / +]'],
          action: 'Adjust Branch Depth',
          description: 'Change the recursive tree exploration depth on the fly directly from the graph toolbar.',
        },
        {
          keys: ['Compact / Normal'],
          action: 'Toggle Node Width',
          description: 'Switch between 260px (ultra-compact for laptops) and 320px (standard full width) blocks.',
        },
        {
          keys: ['Maximize Button'],
          action: 'Full-Screen Graph',
          description: 'Expand the 2D logic tree across the full window width, just like IDA Pro / Ghidra graph view.',
        },
      ],
    },
    {
      title: 'Panel Resizing & Customization',
      icon: <Columns className="w-4 h-4 text-sky-400" />,
      items: [
        {
          keys: ['Drag Border'],
          action: 'Resize Sidebar with Mouse',
          description: 'Click and drag the vertical border between panels to adjust width like Windows Explorer. Saved in cookies.',
        },
        {
          keys: ['[<] / [>] Buttons'],
          action: 'Step Resize Width',
          description: 'Click left or right arrow buttons in the panel header to quickly widen or narrow sidebars.',
        },
        {
          keys: ['Panel Collapse Icon'],
          action: 'Minimize Sidebar',
          description: 'Collapse sidebars into sleek vertical icon strips to view pseudocode or graph exclusively.',
        },
      ],
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] bg-[#0E1118] border-2 border-[#FFCC00] rounded-xl shadow-2xl flex flex-col overflow-hidden text-white font-sans"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 bg-[#141824] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FFCC00] text-black">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Keyboard Shortcuts &amp; Controls</span>
                <span className="text-[11px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded border border-sky-500/40 font-mono">
                  HOTKEYS
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Quick reference for reverse engineering speed and efficiency
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {categories.map((cat) => (
            <div key={cat.title} className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 border-b border-zinc-800/80 pb-1.5">
                {cat.icon}
                <span>{cat.title}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {cat.items.map((item) => (
                  <div
                    key={item.action}
                    className="p-3 rounded-lg bg-[#090B10] border border-zinc-800/80 hover:border-[#FFCC00]/50 transition-colors flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-[#F5E6CC] font-mono">
                        {item.action}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-100 border border-zinc-700 text-[11px] font-mono font-bold shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed font-sans">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-[#121520] flex items-center justify-between text-xs text-zinc-400 font-mono shrink-0">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold">Esc</kbd> or click outside to close</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#FFCC00] text-black font-bold font-mono text-xs hover:bg-[#FFD633] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
