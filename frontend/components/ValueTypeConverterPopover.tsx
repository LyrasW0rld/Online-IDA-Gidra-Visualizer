import React, { useMemo, useState } from 'react';
import { Calculator, X, Check, Cpu, Sparkles } from 'lucide-react';

export interface ValueConverterTarget {
  rawToken: string;
  lineNumber: number;
  variableName?: string;
  currentVarType?: string;
}

interface ValueTypeConverterPopoverProps {
  target: ValueConverterTarget | null;
  onClose: () => void;
  onApplyLiteralConversion: (lineNumber: number, oldLiteral: string, newLiteral: string) => void;
  onApplyVariableTypeChange?: (varName: string, newType: string) => void;
  lang: 'en' | 'de';
}

const AVAILABLE_C_TYPES = [
  'int',
  'unsigned int',
  'float',
  'double',
  'char *',
  'uint8_t',
  'int16_t',
  'uint32_t',
  'int64_t',
  'BOOL',
  'DWORD',
  'HANDLE',
  'eGameModeState',
  'CTaxiPhysicsBody *',
  'CPassengerActor *',
];

const KNOWN_GAME_ENUMS: Record<number, string> = {
  0: 'GAME_STATE_ATTRACT_MODE (0)',
  1: 'GAME_STATE_DRIVER_SELECT / GEAR_DRIVE (1)',
  2: 'GAME_STATE_IN_GAME_PLAYING / GEAR_REVERSE (2)',
  3: 'GAME_STATE_SCORE_TALLY_RANKING (3)',
  4: 'INPUT_SHIFT_DRIVE (0x04)',
  7: 'CRAZY_DASH_MAX_WINDOW_FRAMES (7)',
  8: 'INPUT_SHIFT_REVERSE (0x08)',
  16: 'MB_ICONHAND / CRAZYBOX_COUNT (0x10)',
  64: 'MAX_TRAFFIC_POOL_VEHICLES (64)',
  128: 'MAX_PASSENGER_POOL_SLOTS (128)',
};

export const ValueTypeConverterPopover: React.FC<ValueTypeConverterPopoverProps> = ({
  target,
  onClose,
  onApplyLiteralConversion,
  onApplyVariableTypeChange,
  lang,
}) => {
  const [customInput, setCustomInput] = useState(target?.rawToken || '');
  const [selectedType, setSelectedType] = useState(target?.currentVarType || 'float');

  React.useEffect(() => {
    if (target) {
      setCustomInput(target.rawToken);
      if (target.currentVarType) {
        setSelectedType(target.currentVarType);
      }
    }
  }, [target]);

  const conversions = useMemo(() => {
    const raw = (customInput || target?.rawToken || '').trim();
    if (!raw) return null;

    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);

    const cleanNum = raw.replace(/[fFuUlL]+$/, '');
    let isFloatLiteral = raw.includes('.') && !raw.startsWith('0x');

    if (isFloatLiteral) {
      const fVal = parseFloat(cleanNum);
      if (!isNaN(fVal)) {
        view.setFloat32(0, fVal, false);
      }
    } else if (/^0x[0-9a-fA-F]+$/.test(cleanNum)) {
      const uVal = parseInt(cleanNum, 16) >>> 0;
      view.setUint32(0, uVal, false);
    } else if (/^-?\d+$/.test(cleanNum)) {
      const iVal = parseInt(cleanNum, 10);
      view.setInt32(0, iVal, false);
    } else {
      // String / identifier ASCII byte preview
      for (let i = 0; i < 4; i++) {
        view.setUint8(i, raw.charCodeAt(i) || 0);
      }
    }

    const uint32Val = view.getUint32(0, false);
    const int32Val = view.getInt32(0, false);
    const float32Val = view.getFloat32(0, false);
    const hexStr = '0x' + uint32Val.toString(16).toUpperCase().padStart(8, '0');
    const binStr = '0b' + uint32Val.toString(2).padStart(32, '0');

    // Reinterpret 4 bytes as ASCII characters (Little Endian & Big Endian)
    const charsBE = [
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    ]
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');

    const formattedFloat =
      Number.isFinite(float32Val) && Math.abs(float32Val) > 1e-7 && Math.abs(float32Val) < 1e8
        ? `${Number(float32Val.toFixed(5))}f`
        : `${float32Val.toExponential(3)}f`;

    const enumMatch =
      KNOWN_GAME_ENUMS[int32Val] ||
      KNOWN_GAME_ENUMS[uint32Val] ||
      `ENUM_VAL_${uint32Val}`;

    return [
      {
        label: 'Float (IEEE-754 32-bit)',
        typeBadge: 'float',
        value: formattedFloat,
      },
      {
        label: 'Hexadecimal (DWORD)',
        typeBadge: 'uint32_t',
        value: hexStr,
      },
      {
        label: 'Signed Int (int32)',
        typeBadge: 'int',
        value: String(int32Val),
      },
      {
        label: 'Unsigned Int (uint32)',
        typeBadge: 'unsigned int',
        value: `${uint32Val}u`,
      },
      {
        label: 'Enum Constant',
        typeBadge: 'enum',
        value: enumMatch.split(' ')[0],
        description: enumMatch,
      },
      {
        label: 'ASCII / FourCC String',
        typeBadge: 'char[4]',
        value: `"${charsBE}"`,
      },
      {
        label: 'Bitmask / Binary',
        typeBadge: 'bits',
        value: binStr,
      },
    ];
  }, [customInput, target]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#11141C] border-2 border-[#D4B483] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#D4B483] text-[#18181B] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 stroke-[2.5]" />
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider">
                {lang === 'de'
                  ? 'Typ- & Wert-Konverter (Live Berechnung)'
                  : 'Type & Value Converter (Live Calculator)'}
              </h3>
              <p className="text-[11px] font-semibold text-[#18181B]/80 font-mono">
                {lang === 'de' ? `Zeile ${target.lineNumber}` : `Line ${target.lineNumber}`} • Token:{' '}
                {target.rawToken}
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

        <div className="p-4 space-y-4">
          {/* Variable Data Type Selector (if a variable was double-clicked or selected) */}
          {target.variableName && onApplyVariableTypeChange && (
            <div className="p-3 rounded-lg bg-[#161B26] border border-sky-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-sky-300 font-bold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  {lang === 'de'
                    ? `Datentyp von Variable "${target.variableName}" ändern:`
                    : `Change Data Type of Variable "${target.variableName}":`}
                </span>
                <span className="text-zinc-400">
                  {lang === 'de' ? 'Aktuell:' : 'Current:'} {target.currentVarType || 'int'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="flex-1 bg-[#090B10] border border-zinc-700 focus:border-[#D4B483] rounded px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                >
                  {AVAILABLE_C_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-[#11141C] text-white">
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    onApplyVariableTypeChange(target.variableName!, selectedType);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded bg-[#D4B483] text-[#18181B] font-mono font-bold text-xs uppercase hover:bg-[#E2C9A5] transition-colors"
                >
                  {lang === 'de' ? 'Typ Übernehmen' : 'Apply Type'}
                </button>
              </div>
            </div>
          )}

          {/* Live Value Input */}
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1">
              {lang === 'de'
                ? 'Wert zum Umrechnen (Hex, Float, Int oder String):'
                : 'Value to Reinterpret / Convert (Hex, Float, Int, or String):'}
            </label>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="w-full bg-[#090B10] border border-zinc-700 focus:border-[#D4B483] rounded px-3 py-1.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
            />
          </div>

          {/* Calculated Representations List */}
          {conversions && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center justify-between">
                <span>
                  {lang === 'de'
                    ? 'Automatisch berechnete Darstellung (Klick = Im Code ersetzen):'
                    : 'Calculated Representations (Click = Replace in Code):'}
                </span>
              </div>
              {conversions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    onApplyLiteralConversion(target.lineNumber, target.rawToken, item.value);
                    onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-[#0D1017] hover:bg-[#D4B483] group border border-zinc-800 hover:border-[#D4B483] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-sky-300 group-hover:bg-[#18181B] group-hover:text-[#D4B483] font-bold">
                        {item.typeBadge}
                      </span>
                      <span className="text-xs font-semibold text-zinc-300 group-hover:text-[#18181B]">
                        {item.label}
                      </span>
                    </div>
                    {item.description && (
                      <div className="text-[11px] font-mono text-zinc-400 group-hover:text-[#18181B]/80 mt-0.5 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-400 group-hover:text-[#18181B] bg-black/50 group-hover:bg-black/10 px-2.5 py-1 rounded shrink-0">
                    {item.value}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};