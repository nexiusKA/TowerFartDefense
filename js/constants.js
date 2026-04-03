// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS – all game objects use logical (tile-space) coordinates.
// The canvas is scaled once per frame in Game.render() so everything just
// works in 0..LOGICAL_W × 0..LOGICAL_H space.
// ─────────────────────────────────────────────────────────────────────────────
const TILE      = 60;
const COLS      = 16;
const ROWS      = 10;
const LOGICAL_W = COLS * TILE;   // 960
const LOGICAL_H = ROWS * TILE;   // 600

// Tile types
const T_GRASS    = 0;
const T_ROAD     = 1;
const T_SIDEWALK = 2;
const T_BUILDING = 3;
const T_PAD      = 4;   // tower build pad
const T_MANHOLE  = 5;   // enemy spawn point

// Map grid  (16 cols × 10 rows)
const MAP_GRID = [
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [2,4,4,2,2,4,4,2,2,4,4,2,2,4,4,2],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [2,4,4,2,5,4,4,2,5,4,4,2,5,4,4,2],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [2,4,4,2,2,4,4,2,2,4,4,2,2,4,4,2],
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
];

// Enemy path waypoints in logical (tile-space) pixel coordinates.
// Enemies enter from the right (col 15, row 4) and snake to exit left (col 0, row 7).
const RAW_PATH = [
  { c: 15, r: 4 },
  { c:  1, r: 4 },
  { c:  1, r: 6 },
  { c: 14, r: 6 },
  { c: 14, r: 7 },
  { c:  0, r: 7 },   // exit: off left edge
];

let PATH_POINTS = [];
function buildPathPoints() {
  PATH_POINTS = RAW_PATH.map(p => ({
    x: p.c * TILE + TILE / 2,
    y: p.r * TILE + TILE / 2,
  }));
}
buildPathPoints();
