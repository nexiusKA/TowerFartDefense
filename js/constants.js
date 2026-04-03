// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS – all game objects use logical (tile-space) coordinates.
// The canvas is scaled once per frame in Game.render() so everything just
// works in 0..LOGICAL_W × 0..LOGICAL_H space.
// ─────────────────────────────────────────────────────────────────────────────
const TILE      = 60;
const COLS      = 20;
const ROWS      = 13;
const LOGICAL_W = COLS * TILE;   // 1200
const LOGICAL_H = ROWS * TILE;   // 780

// Tile types
const T_GRASS    = 0;
const T_ROAD     = 1;
const T_SIDEWALK = 2;
const T_BUILDING = 3;
const T_PAD      = 4;   // tower build pad
const T_MANHOLE  = 5;   // enemy spawn point

// Live map grid and path – randomised by generateMap()
let MAP_GRID    = [];
let PATH_POINTS = [];

/**
 * Build a fresh randomised map.
 * Grid is COLS × ROWS (20 × 13).
 *   Buildings  : rows 0-1 and row 12
 *   Road bands : rows 3-4 · 6-7 · 9-10
 *   Sidewalk / pad rows : 2 · 5 · 8 · 11
 * The snake path waypoints and manhole positions are randomised each call.
 */
function generateMap() {
  // ── Initialise grid to buildings ─────────────────────────────────────────
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid[r] = new Array(COLS).fill(T_BUILDING);

  // ── Road bands ───────────────────────────────────────────────────────────
  for (const r of [3, 4, 6, 7, 9, 10]) {
    for (let c = 0; c < COLS; c++) grid[r][c] = T_ROAD;
  }

  // ── Sidewalk / pad rows (pads at c%4 === 1 or 2) ─────────────────────────
  for (const r of [2, 5, 8, 11]) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = (c % 4 === 1 || c % 4 === 2) ? T_PAD : T_SIDEWALK;
    }
  }

  // ── Manholes: random pads in rows 5 & 8 ──────────────────────────────────
  for (const mr of [5, 8]) {
    const padCols = [];
    for (let c = 0; c < COLS; c++) if (grid[mr][c] === T_PAD) padCols.push(c);
    // Fisher-Yates shuffle
    for (let i = padCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [padCols[i], padCols[j]] = [padCols[j], padCols[i]];
    }
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < Math.min(count, padCols.length); i++) {
      grid[mr][padCols[i]] = T_MANHOLE;
    }
  }

  // ── Random three-band snake path ─────────────────────────────────────────
  // Entry row (top band: 3 or 4), middle row, exit row (bottom band: 9 or 10)
  const entryRow = Math.random() < 0.5 ? 3 : 4;
  const midRow   = Math.random() < 0.5 ? 6 : 7;
  const exitRow  = Math.random() < 0.5 ? 9 : 10;

  // Left turn cols (near left edge : 1-5) and right turn col (near right edge : COLS-5 to COLS-2)
  const leftTurn1 = 1 + Math.floor(Math.random() * 5);
  const leftTurn2 = 1 + Math.floor(Math.random() * 5);
  const rightTurn = COLS - 5 + Math.floor(Math.random() * 4);

  const rawPath = [
    { c: COLS - 1, r: entryRow },   // enter from right edge
    { c: leftTurn1, r: entryRow },  // travel left → first left turn
    { c: leftTurn1, r: midRow   },  // drop to middle band
    { c: rightTurn, r: midRow   },  // travel right → right turn
    { c: rightTurn, r: exitRow  },  // drop to exit band
    { c: leftTurn2, r: exitRow  },  // travel left → final left turn
    { c: 0,         r: exitRow  },  // exit left (off screen / base)
  ];

  MAP_GRID    = grid;
  PATH_POINTS = rawPath.map(p => ({
    x: p.c * TILE + TILE / 2,
    y: p.r * TILE + TILE / 2,
  }));
}

// Initialise with a starting map
generateMap();
