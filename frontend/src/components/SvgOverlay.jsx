import { useMemo } from 'react';
import { CircuitBoard } from 'lucide-react';

/**
 * Standard mini breadboard dimensions:
 * - 30 columns (1–30)
 * - Rows: a, b, c, d, e (top half) + f, g, h, i, j (bottom half)
 * - Power rails: top +/- and bottom +/-
 * - Gap between row e and row f
 *
 * Total holes ≈ 400 main + 100 power = 500, we render ~400 main signal holes
 */

const COLS = 30;
const SIGNAL_ROWS_TOP = ['a', 'b', 'c', 'd', 'e'];
const SIGNAL_ROWS_BOTTOM = ['f', 'g', 'h', 'i', 'j'];
const ALL_ROWS = [...SIGNAL_ROWS_TOP, ...SIGNAL_ROWS_BOTTOM];
const POWER_ROWS = ['+', '-'];

// Layout constants
const HOLE_R = 3;
const HOLE_SPACING_X = 16;
const HOLE_SPACING_Y = 16;
const MARGIN_LEFT = 50;
const MARGIN_TOP = 50;
const POWER_RAIL_TOP_Y = 12;
const POWER_RAIL_BOTTOM_OFFSET = 20;
const GAP_HEIGHT = 24;

// Wire status colors
const STATUS_COLORS = {
  correct: '#10b981',     // emerald-500
  warning: '#f59e0b',     // amber-500
  error: '#f43f5e',       // rose-500
  neutral: '#6366f1',     // indigo-500
};

/**
 * Convert a breadboard coordinate like "a1" or "+5" to SVG {x, y}.
 */
function coordToSVG(row, col) {
  const colNum = typeof col === 'string' ? parseInt(col, 10) : col;
  const x = MARGIN_LEFT + (colNum - 1) * HOLE_SPACING_X;

  // Power rails
  if (row === '+' || row === '-') {
    const railOffset = row === '+' ? 0 : HOLE_SPACING_Y;
    return { x, y: POWER_RAIL_TOP_Y + railOffset };
  }

  const topIdx = SIGNAL_ROWS_TOP.indexOf(row);
  if (topIdx !== -1) {
    return { x, y: MARGIN_TOP + topIdx * HOLE_SPACING_Y };
  }

  const bottomIdx = SIGNAL_ROWS_BOTTOM.indexOf(row);
  if (bottomIdx !== -1) {
    return {
      x,
      y: MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y + GAP_HEIGHT + bottomIdx * HOLE_SPACING_Y,
    };
  }

  return { x: 0, y: 0 };
}

const BOARD_WIDTH = MARGIN_LEFT + COLS * HOLE_SPACING_X + 20;
const BOARD_HEIGHT =
  MARGIN_TOP +
  ALL_ROWS.length * HOLE_SPACING_Y +
  GAP_HEIGHT +
  POWER_RAIL_BOTTOM_OFFSET +
  40;

/**
 * Interactive SVG breadboard overlay.
 *
 * @param {Object} props
 * @param {Object|null} props.netlist — backend netlist: { wires: [{from, to, status}], components: [{id, pins}] }
 * @param {boolean} props.loading — show skeleton
 */
export default function SvgOverlay({ netlist, loading }) {
  // Pre-compute all hole positions
  const holes = useMemo(() => {
    const result = [];

    // Power rails (top)
    for (const row of POWER_ROWS) {
      for (let c = 1; c <= COLS; c++) {
        const pos = coordToSVG(row, c);
        result.push({ id: `${row}${c}`, ...pos, type: 'power', row });
      }
    }

    // Signal holes
    for (const row of ALL_ROWS) {
      for (let c = 1; c <= COLS; c++) {
        const pos = coordToSVG(row, c);
        result.push({ id: `${row}${c}`, ...pos, type: 'signal', row });
      }
    }

    return result;
  }, []);

  // Parse wires from netlist
  const wires = useMemo(() => {
    if (!netlist?.wires) return [];
    return netlist.wires.map((wire) => {
      const fromCoord = parseCoord(wire.from);
      const toCoord = parseCoord(wire.to);
      if (!fromCoord || !toCoord) return null;

      const fromSVG = coordToSVG(fromCoord.row, fromCoord.col);
      const toSVG = coordToSVG(toCoord.row, toCoord.col);
      const color = STATUS_COLORS[wire.status] || STATUS_COLORS.neutral;

      return { ...wire, fromSVG, toSVG, color };
    }).filter(Boolean);
  }, [netlist]);

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <CircuitBoard className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
            Breadboard Visualization
          </span>
        </div>
        <div className="skeleton w-full rounded-xl" style={{ height: '280px' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-1">
        <CircuitBoard className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
          Breadboard Visualization
        </span>
        {netlist && (
          <div className="flex items-center gap-3 ml-auto text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Correct
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Low Confidence
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Hazard
            </span>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-x-auto">
        <svg
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          className="w-full h-auto"
          style={{ minWidth: '520px' }}
        >
          {/* Board background */}
          <rect
            x="4"
            y="4"
            width={BOARD_WIDTH - 8}
            height={BOARD_HEIGHT - 8}
            rx="8"
            fill="#f8fafc"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Center gap */}
          <rect
            x="4"
            y={MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y - 2}
            width={BOARD_WIDTH - 8}
            height={GAP_HEIGHT + 4}
            fill="#f1f5f9"
            rx="2"
          />

          {/* Center divider line */}
          <line
            x1={MARGIN_LEFT - 10}
            y1={MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y + GAP_HEIGHT / 2}
            x2={MARGIN_LEFT + (COLS - 1) * HOLE_SPACING_X + 10}
            y2={MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y + GAP_HEIGHT / 2}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="4 3"
          />

          {/* Power rail labels */}
          <text x="12" y={POWER_RAIL_TOP_Y + 4} className="text-[9px]" fill="#ef4444" fontWeight="600">+</text>
          <text x="12" y={POWER_RAIL_TOP_Y + HOLE_SPACING_Y + 4} className="text-[9px]" fill="#3b82f6" fontWeight="600">−</text>

          {/* Row labels (left side) */}
          {ALL_ROWS.map((row) => {
            const pos = coordToSVG(row, 1);
            return (
              <text
                key={`label-${row}`}
                x={MARGIN_LEFT - 18}
                y={pos.y + 4}
                className="text-[9px]"
                fill="#94a3b8"
                fontWeight="500"
                textAnchor="middle"
              >
                {row}
              </text>
            );
          })}

          {/* Column numbers */}
          {Array.from({ length: COLS }, (_, i) => i + 1).map((col) => {
            if (col % 5 !== 0 && col !== 1) return null;
            return (
              <text
                key={`col-${col}`}
                x={MARGIN_LEFT + (col - 1) * HOLE_SPACING_X}
                y={BOARD_HEIGHT - 10}
                className="text-[8px]"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {col}
              </text>
            );
          })}

          {/* Holes */}
          {holes.map((hole) => (
            <circle
              key={hole.id}
              cx={hole.x}
              cy={hole.y}
              r={HOLE_R}
              fill={hole.type === 'power' && hole.row === '+' ? '#fecaca' : hole.type === 'power' && hole.row === '-' ? '#bfdbfe' : '#e2e8f0'}
              stroke={hole.type === 'power' && hole.row === '+' ? '#fca5a5' : hole.type === 'power' && hole.row === '-' ? '#93c5fd' : '#cbd5e1'}
              strokeWidth="0.75"
              className="hover:fill-indigo-200 transition-colors"
            >
              <title>{hole.id}</title>
            </circle>
          ))}

          {/* Wires from netlist */}
          {wires.map((wire, idx) => (
            <g key={idx}>
              <line
                x1={wire.fromSVG.x}
                y1={wire.fromSVG.y}
                x2={wire.toSVG.x}
                y2={wire.toSVG.y}
                stroke={wire.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Endpoint dots */}
              <circle cx={wire.fromSVG.x} cy={wire.fromSVG.y} r="3.5" fill={wire.color} opacity="0.9" />
              <circle cx={wire.toSVG.x} cy={wire.toSVG.y} r="3.5" fill={wire.color} opacity="0.9" />
            </g>
          ))}
        </svg>
      </div>

      {/* Empty state */}
      {!netlist && (
        <div className="text-center py-6 text-slate-400 text-sm">
          <CircuitBoard className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Upload a circuit image to see the wiring visualization
        </div>
      )}
    </div>
  );
}

/**
 * Parse a coordinate string like "a1", "j30", "+5" into { row, col }.
 */
function parseCoord(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/^([a-j+\-])(\d+)$/i);
  if (!match) return null;
  return { row: match[1].toLowerCase(), col: parseInt(match[2], 10) };
}
