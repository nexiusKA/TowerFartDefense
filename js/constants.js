// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS – all game objects use logical (tile-space) coordinates.
// The canvas is scaled once per frame in Game.render() so everything just
// works in 0..LOGICAL_W × 0..LOGICAL_H space.
// ─────────────────────────────────────────────────────────────────────────────
const TILE      = 40;
const COLS      = 30;
const ROWS      = 20;
const LOGICAL_W = COLS * TILE;   // 1200
const LOGICAL_H = ROWS * TILE;   // 800

const UI_UPDATE_INTERVAL_MS = 200; // how often the DOM stat panel refreshes during a wave
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
 * Grid is COLS × ROWS (30 × 20).
 *   Buildings  : rows 0-1 and rows 18-19
 *   Road bands : rows 3-4 · 6-7 · 9-10 · 12-13 · 15-16  (5 bands)
 *   Sidewalk / pad rows : 2 · 5 · 8 · 11 · 14 · 17       (6 rows)
 * The snake path and manhole positions are randomised each call.
 */
function generateMap() {
  // ── Initialise grid to buildings ─────────────────────────────────────────
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid[r] = new Array(COLS).fill(T_BUILDING);

  // ── Road bands (5 bands for a longer snake path) ──────────────────────────
  const ROAD_BANDS = [[3, 4], [6, 7], [9, 10], [12, 13], [15, 16]];
  for (const [r1, r2] of ROAD_BANDS) {
    for (let c = 0; c < COLS; c++) {
      grid[r1][c] = T_ROAD;
      grid[r2][c] = T_ROAD;
    }
  }

  // ── Sidewalk / pad rows (pads at c%4 === 1 or 2) ─────────────────────────
  const PAD_ROWS = [2, 5, 8, 11, 14, 17];
  for (const r of PAD_ROWS) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = (c % 4 === 1 || c % 4 === 2) ? T_PAD : T_SIDEWALK;
    }
  }

  // ── Manholes: random pads in middle pad rows ──────────────────────────────
  for (const mr of [5, 8, 11]) {
    const padCols = [];
    for (let c = 0; c < COLS; c++) if (grid[mr][c] === T_PAD) padCols.push(c);
    // Fisher-Yates shuffle
    for (let i = padCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [padCols[i], padCols[j]] = [padCols[j], padCols[i]];
    }
    const count = 3 + Math.floor(Math.random() * 4); // 3-6 manholes; more spread across the wider 30-col grid
    for (let i = 0; i < Math.min(count, padCols.length); i++) {
      grid[mr][padCols[i]] = T_MANHOLE;
    }
  }

  // ── Five-band snake path ──────────────────────────────────────────────────
  // Picks one row from each band, alternates left/right turns
  const pick = pair => pair[Math.floor(Math.random() * 2)];
  const rowA = pick(ROAD_BANDS[0]);
  const rowB = pick(ROAD_BANDS[1]);
  const rowC = pick(ROAD_BANDS[2]);
  const rowD = pick(ROAD_BANDS[3]);
  const rowE = pick(ROAD_BANDS[4]);

  // Turn columns: left turns near col 1-5, right turns near right edge
  const lT1 = 1 + Math.floor(Math.random() * 5);
  const lT2 = 1 + Math.floor(Math.random() * 5);
  const rT1 = COLS - 6 + Math.floor(Math.random() * 4);
  const rT2 = COLS - 6 + Math.floor(Math.random() * 4);

  const rawPath = [
    { c: COLS - 1, r: rowA },   // enter from right edge (band A)
    { c: lT1,      r: rowA },   // travel left → first left turn
    { c: lT1,      r: rowB },   // drop to band B
    { c: rT1,      r: rowB },   // travel right → right turn
    { c: rT1,      r: rowC },   // drop to band C
    { c: lT2,      r: rowC },   // travel left → left turn
    { c: lT2,      r: rowD },   // drop to band D
    { c: rT2,      r: rowD },   // travel right → right turn
    { c: rT2,      r: rowE },   // drop to band E
    { c: 0,        r: rowE },   // exit left (base)
  ];

  MAP_GRID    = grid;
  PATH_POINTS = rawPath.map(p => ({
    x: p.c * TILE + TILE / 2,
    y: p.r * TILE + TILE / 2,
  }));
}

// Initialise with a starting map
generateMap();
