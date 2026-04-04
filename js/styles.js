// ─────────────────────────────────────────────────────────────────────────────
// STYLE DEFINITIONS
// Centralises all theme-sensitive colours so that every canvas draw call and
// CSS override can reference STYLE.* rather than hard-coded values.
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = {
  // ── ⚡ NEON STINK EDITION (default) ────────────────────────────────────────
  neon: {
    id: 'neon',
    name: '⚡ Neon Stink',
    sub: 'Current Edition',
    previewGrad: 'linear-gradient(135deg, #e8902a 0%, #c05020 50%, #08081e 100%)',

    // Sky
    sky1: '#e8902a', sky2: '#d46828', sky3: '#c05020',

    // Background silhouette
    silhouette: '#7a3818', silhouetteWindow: '#f0d080',

    // Tile base fills
    building: '#9b6b52',
    road:     '#5a5048',
    sidewalk: '#b8a888',
    grass:    '#8a7040',

    // Building overlay gradient
    brickGrad1: 'rgba(200,110,60,0.18)', brickGrad2: 'rgba(100,45,15,0.22)',
    mortar: '#5a3018',

    // Road
    roadSheen1: 'rgba(80,50,20,0.08)', roadSheen2: 'rgba(40,20,5,0.08)',
    roadLane:   '#d4a82099',

    // Sidewalk
    sidewalkGrid:  '#7a5830',
    sidewalkCrack: '#5a3818',

    // Manhole
    manholeGlow1:  'rgba(220,140,40,0.28)', manholeGlow2: 'rgba(120,60,10,0)',
    manholePlate:  '#2e2018',
    manholeBorder: '#c87830',
    manholeInner1: 'rgba(240,160,40,0.25)',
    manholeText:   '#d49040',

    // Build pad & path
    buildPad: '#f5a623',
    pathLine: '#e8a030',

    // Clouds
    cloud1: '#ffe8d8', cloud2: '#f8d8c8', cloudStroke: '#c89870',

    // Atmospheric haze
    haze1: 'rgba(200,90,20,0.10)', haze2: 'rgba(160,60,10,0)', haze3: 'rgba(200,90,20,0.10)',

    // Map frame
    frameShadow: '#d47830', frameColor: 'rgba(212,120,48,0.30)',

    // Tile grid lines
    tileGrid: 'rgba(60,25,8,0.14)',

    // HUD & markers
    waveHud:    '#00ffee', bossHud:   '#ff3344',
    entryColor: '#00ffee', exitColor: '#ff3344',
  },

  // ── 🌿 CLASSIC GARDEN (retro / "older" style) ──────────────────────────────
  classic: {
    id: 'classic',
    name: '🌿 Classic Garden',
    sub: 'Retro Style',
    previewGrad: 'linear-gradient(135deg, #87ceeb 0%, #4a9c30 50%, #1a2810 100%)',

    sky1: '#87ceeb', sky2: '#5ba0d0', sky3: '#4080b8',

    silhouette: '#607050', silhouetteWindow: '#e8e890',

    building: '#8a8070',
    road:     '#606060',
    sidewalk: '#c8c0a8',
    grass:    '#4a9c30',

    brickGrad1: 'rgba(160,150,120,0.15)', brickGrad2: 'rgba(80,70,50,0.20)',
    mortar: '#706050',

    roadSheen1: 'rgba(60,60,60,0.08)', roadSheen2: 'rgba(30,30,30,0.08)',
    roadLane:   '#cccc4499',

    sidewalkGrid:  '#908070',
    sidewalkCrack: '#706050',

    manholeGlow1:  'rgba(100,140,60,0.25)', manholeGlow2: 'rgba(50,80,20,0)',
    manholePlate:  '#2a3020',
    manholeBorder: '#708840',
    manholeInner1: 'rgba(120,160,40,0.22)',
    manholeText:   '#88aa50',

    buildPad: '#ffcc00',
    pathLine: '#aabb00',

    cloud1: '#ffffff', cloud2: '#eeeeff', cloudStroke: '#8899aa',

    haze1: 'rgba(100,150,200,0.06)', haze2: 'rgba(80,120,160,0)', haze3: 'rgba(100,150,200,0.06)',

    frameShadow: '#4080b8', frameColor: 'rgba(64,128,184,0.25)',

    tileGrid: 'rgba(60,50,30,0.12)',

    waveHud:    '#4488ee', bossHud:   '#cc2222',
    entryColor: '#22aa22', exitColor: '#cc2222',
  },

  // ── ☢️ TOXIC WASTELAND (new third style) ──────────────────────────────────
  toxic: {
    id: 'toxic',
    name: '☢️ Toxic Wasteland',
    sub: 'New Dimension',
    previewGrad: 'linear-gradient(135deg, #0d1400 0%, #2a1848 50%, #0a0020 100%)',

    sky1: '#0d1400', sky2: '#181c00', sky3: '#0a0e00',

    silhouette: '#1a0830', silhouetteWindow: '#c0ff40',

    building: '#2a1848',
    road:     '#1a0c30',
    sidewalk: '#221830',
    grass:    '#1a3008',

    brickGrad1: 'rgba(100,40,160,0.18)', brickGrad2: 'rgba(40,10,80,0.22)',
    mortar: '#3a1860',

    roadSheen1: 'rgba(40,80,10,0.10)', roadSheen2: 'rgba(20,40,5,0.10)',
    roadLane:   '#80ff4099',

    sidewalkGrid:  '#4a2870',
    sidewalkCrack: '#3a1858',

    manholeGlow1:  'rgba(80,200,20,0.30)', manholeGlow2: 'rgba(40,120,10,0)',
    manholePlate:  '#100820',
    manholeBorder: '#80ff40',
    manholeInner1: 'rgba(100,220,20,0.25)',
    manholeText:   '#80ff40',

    buildPad: '#ff8800',
    pathLine: '#80ff40',

    cloud1: '#60ff4030', cloud2: '#40ff2020', cloudStroke: '#80ff4040',

    haze1: 'rgba(60,180,10,0.08)', haze2: 'rgba(40,120,5,0)', haze3: 'rgba(60,180,10,0.08)',

    frameShadow: '#80ff40', frameColor: 'rgba(128,255,64,0.25)',

    tileGrid: 'rgba(80,0,160,0.18)',

    waveHud:    '#80ff40', bossHud:   '#ff4000',
    entryColor: '#80ff40', exitColor: '#ff4000',
  },
};

// Active style — starts as neon, updated by setStyle()
let STYLE = STYLES.neon;

// ── Apply a style by id ────────────────────────────────────────────────────────
function setStyle(id) {
  STYLE = STYLES[id] || STYLES.neon;
  document.body.dataset.style = STYLE.id;
}

// Initialise the DOM attribute immediately (scripts load after body content)
document.body.dataset.style = STYLE.id;
