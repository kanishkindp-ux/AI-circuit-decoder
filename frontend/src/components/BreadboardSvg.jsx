import React, { useMemo } from 'react';

const COLS = 30;
const SIGNAL_ROWS_TOP = ['a', 'b', 'c', 'd', 'e'];
const SIGNAL_ROWS_BOTTOM = ['f', 'g', 'h', 'i', 'j'];
const ALL_ROWS = [...SIGNAL_ROWS_TOP, ...SIGNAL_ROWS_BOTTOM];
const POWER_ROWS = ['+', '-'];

const HOLE_R = 3;
const HOLE_SPACING_X = 16;
const HOLE_SPACING_Y = 16;
const MARGIN_LEFT = 50;
const MARGIN_TOP = 50;
const POWER_RAIL_TOP_Y = 12;
const POWER_RAIL_BOTTOM_OFFSET = 20;
const GAP_HEIGHT = 24;

function coordToSVG(row, col) {
  const colNum = typeof col === 'string' ? parseInt(col, 10) : col;
  const x = MARGIN_LEFT + (colNum - 1) * HOLE_SPACING_X;

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

export default function BreadboardSvg({ style }) {
  const holes = useMemo(() => {
    const result = [];
    for (const row of POWER_ROWS) {
      for (let c = 1; c <= COLS; c++) {
        const pos = coordToSVG(row, c);
        result.push({ id: `${row}${c}-top`, ...pos, type: 'power', row });
      }
    }
    for (const row of ALL_ROWS) {
      for (let c = 1; c <= COLS; c++) {
        const pos = coordToSVG(row, c);
        result.push({ id: `${row}${c}`, ...pos, type: 'signal', row });
      }
    }
    for (const row of POWER_ROWS) {
      for (let c = 1; c <= COLS; c++) {
        const pos = coordToSVG(row, c);
        // Shift bottom power rail down
        result.push({ 
          id: `${row}${c}-bot`, 
          x: pos.x, 
          y: pos.y + BOARD_HEIGHT - 48, 
          type: 'power', 
          row 
        });
      }
    }
    return result;
  }, []);

  return (
    <div style={{ ...style, width: BOARD_HEIGHT, height: BOARD_WIDTH }}>
      <svg
        viewBox={`0 0 ${BOARD_HEIGHT} ${BOARD_WIDTH}`}
        width={BOARD_HEIGHT}
        height={BOARD_WIDTH}
      >
        <g transform={`translate(${BOARD_HEIGHT}, 0) rotate(90)`}>
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
        <rect
          x="4"
          y={MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y - 2}
          width={BOARD_WIDTH - 8}
          height={GAP_HEIGHT + 4}
          fill="#f1f5f9"
          rx="2"
        />
        <line
          x1={MARGIN_LEFT - 10}
          y1={MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y + GAP_HEIGHT / 2}
          x2={MARGIN_LEFT + (COLS - 1) * HOLE_SPACING_X + 10}
          y2={MARGIN_TOP + SIGNAL_ROWS_TOP.length * HOLE_SPACING_Y + GAP_HEIGHT / 2}
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        {holes.map((hole) => (
          <circle
            key={hole.id}
            cx={hole.x}
            cy={hole.y}
            r={HOLE_R}
            fill={hole.type === 'power' && hole.row === '+' ? '#fecaca' : hole.type === 'power' && hole.row === '-' ? '#bfdbfe' : '#e2e8f0'}
            stroke={hole.type === 'power' && hole.row === '+' ? '#fca5a5' : hole.type === 'power' && hole.row === '-' ? '#93c5fd' : '#cbd5e1'}
            strokeWidth="0.75"
          />
        ))}
        </g>
      </svg>
    </div>
  );
}
