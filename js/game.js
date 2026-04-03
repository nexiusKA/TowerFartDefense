// ─────────────────────────────────────────────────────────────────────────────
// GAME  – uses a unified logical (tile-space) coordinate system.
//
// All game objects live in 0..LOGICAL_W × 0..LOGICAL_H space (1200 × 780).
// Before rendering, one ctx.scale(scaleX, scaleY) is applied so everything
// draws correctly at any canvas size without per-object scaling arithmetic.
// Mouse events convert canvas-px → logical-px via canvasToLogical().
// ─────────────────────────────────────────────────────────────────────────────

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this.gold      = 150;
    this.baseHp    = 20;
    this.kills     = 0;
    this.score     = 0;
    this.towers      = [];
    this.enemies     = [];
    this.projectiles = [];

    this.selectedTowerType = null;
    this.selectedTower     = null;
    this.hoverPad          = null;
    this.paused  = false;
    this.over    = false;
    this.started = false;
    this.speed   = 1;   // 1 = normal, 2 = fast

    this.waveManager = new WaveManager();
    this.buildPads   = this._computeBuildPads();
    this.manholePositions = this._computeManholePositions();
    this.lastTime    = 0;
    this.ambientTimer = 0;   // throttle ambient gas spawns

    this._resize();
    this.updateUI();
    this._bindEvents();
  }

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  get scaleX() { return this.canvas.width  / LOGICAL_W; }
  get scaleY() { return this.canvas.height / LOGICAL_H; }

  canvasToLogical(cx, cy) {
    return { x: cx / this.scaleX, y: cy / this.scaleY };
  }

  _resize() {
    const uiW = document.getElementById('ui').offsetWidth || 210;
    this.canvas.width  = Math.max(window.innerWidth  - uiW, 300);
    this.canvas.height = Math.max(window.innerHeight, 300);
  }

  regenerateMap() {
    generateMap();
    this.buildPads        = this._computeBuildPads();
    this.manholePositions = this._computeManholePositions();
    this._render();
  }

  _computeManholePositions() {
    const positions = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAP_GRID[r][c] === T_MANHOLE) {
          positions.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
        }
      }
    }
    return positions;
  }

  _computeBuildPads() {
    const pads = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAP_GRID[r][c] === T_PAD) {
          pads.push({
            c, r,
            x: c * TILE + TILE / 2,
            y: r * TILE + TILE / 2,
            occupied: false,
          });
        }
      }
    }
    return pads;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    this.started = true;
    document.getElementById('overlay').style.display = 'none';
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(ts) {
    if (this.over) return;
    const rawDt = Math.min(ts - this.lastTime, 100);
    this.lastTime = ts;

    if (!this.paused) {
      // Each step simulates a full rawDt so 2× speed truly doubles simulation time per frame
      for (let i = 0; i < this.speed; i++) this._update(rawDt);
    }
    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    this.waveManager.update(dt);

    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e => !e.dead && !e.reached);

    for (const t of this.towers) t.update(dt);

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    updateParticles(dt);

    // Ambient manhole gas wisps
    this.ambientTimer += dt;
    if (this.ambientTimer > 220) {
      this.ambientTimer = 0;
      for (const pos of this.manholePositions) {
        if (Math.random() < 0.5) {
          spawnAmbientWisp(pos.x, pos.y - 12, '#33ee22');
        }
      }
    }

    // Wave complete: re-enable Next Wave button and award bonus gold
    if (this.started && this.waveManager.waveNum > 0 &&
        this.waveManager.waveComplete && !this.waveManager.bonusGiven) {
      this.waveManager.bonusGiven = true;
      const bonus = 50 + this.waveManager.waveNum * 5;
      this.gold += bonus;
      document.getElementById('btnNextWave').disabled = false;
      showMessage(`✅ Wave ${this.waveManager.waveNum} cleared! +${bonus}g bonus!`);
      this.updateUI();
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();

    // Screen shake
    if (screenShake > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * screenShake,
        (Math.random() - 0.5) * screenShake
      );
      screenShake *= 0.82;
    }

    // Apply one unified scale: everything inside uses logical coords
    ctx.scale(this.scaleX, this.scaleY);

    this._drawMap(ctx);

    // Hover ghost tower + range preview
    if (this.selectedTowerType && this.hoverPad) {
      const def = TOWER_DEFS[this.selectedTowerType];
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle   = def.color;
      ctx.beginPath();
      ctx.arc(this.hoverPad.x, this.hoverPad.y, def.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      const ghost = new Tower(this.selectedTowerType, -1, this.hoverPad.x, this.hoverPad.y);
      ghost.draw(ctx);
      ctx.restore();
    }

    drawParticles(ctx);
    for (const t of this.towers)      t.draw(ctx);
    for (const e of this.enemies)     e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);

    // Entrance / exit markers
    this._drawEntryExit(ctx);

    ctx.restore();
  }

  _drawMap(ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE, y = r * TILE;
        const t = MAP_GRID[r][c];

        // ── Base fill ──────────────────────────────────────────────────────
        switch (t) {
          case T_BUILDING: ctx.fillStyle = '#07080e'; break;
          case T_ROAD:     ctx.fillStyle = '#0c0e0a'; break;
          case T_SIDEWALK: ctx.fillStyle = '#10130e'; break;
          case T_GRASS:    ctx.fillStyle = '#0b0e06'; break;
          case T_PAD:      ctx.fillStyle = '#10130e'; break;
          case T_MANHOLE:  ctx.fillStyle = '#0c0e0a'; break;
        }
        ctx.fillRect(x, y, TILE, TILE);

        // ── Building details ───────────────────────────────────────────────
        if (t === T_BUILDING) {
          // Gritty brown-green sheen on building face
          const fogGrd = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
          fogGrd.addColorStop(0, 'rgba(20,30,0,0.12)');
          fogGrd.addColorStop(1, 'rgba(10,20,0,0.14)');
          ctx.fillStyle = fogGrd;
          ctx.fillRect(x, y, TILE, TILE);

          // Stain/grime streaks on building face
          if ((c * 7 + r * 3) % 5 === 0) {
            ctx.globalAlpha = 0.10;
            ctx.fillStyle = '#446600';
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.3, y + TILE * 0.05);
            ctx.bezierCurveTo(x + TILE * 0.28, y + TILE * 0.4, x + TILE * 0.32, y + TILE * 0.7, x + TILE * 0.3, y + TILE);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#446600';
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          // Windows — grimy urban palette (yellows, greens, some dark)
          ctx.globalAlpha = 0.7;
          for (let wy = 7; wy < TILE - 7; wy += 14) {
            for (let wx = 7; wx < TILE - 7; wx += 14) {
              const litType = (c * 3 + r * 7 + Math.floor(wx / 14) * 2 + Math.floor(wy / 14)) % 8;
              if      (litType === 0)  ctx.fillStyle = '#080808';        // dark / off
              else if (litType === 1)  ctx.fillStyle = '#1a1a00';        // very dark yellow
              else if (litType === 2)  ctx.fillStyle = '#aacc0066';      // yellow-green glow
              else if (litType === 3)  ctx.fillStyle = '#88aa0055';      // olive glow
              else if (litType === 4)  ctx.fillStyle = '#cc880044';      // amber
              else                     ctx.fillStyle = '#446600aa';      // murky green
              ctx.fillRect(x + wx, y + wy, 8, 8);
              if (litType >= 2) {
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = '#ffffaa';
                ctx.fillRect(x + wx, y + wy, 8, 2);
                ctx.globalAlpha = 0.7;
              }
            }
          }
          ctx.globalAlpha = 1;

          // Urban billboard / graffiti sign on some buildings
          if (r === 0 && c % 4 === 1) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            const signColors = ['#aacc00', '#cc8800', '#88aa00', '#ccaa00'];
            ctx.strokeStyle = signColors[c % signColors.length];
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + TILE * 0.12, y + TILE * 0.18, TILE * 0.76, TILE * 0.44);
            ctx.fillStyle = signColors[c % signColors.length];
            ctx.font = `bold ${TILE * 0.17}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labels = ['RAT\nBAIT', 'DUMP\nCO', 'STINK\nINC', 'SEWER\nGAS'];
            ctx.fillText(labels[c % labels.length].split('\n')[0], x + TILE * 0.5, y + TILE * 0.31);
            ctx.fillText(labels[c % labels.length].split('\n')[1], x + TILE * 0.5, y + TILE * 0.50);
            ctx.restore();
          }

          // Roof vent / drain pipe (every 4th building in top row)
          if (r === 0 && c % 4 === 2) {
            ctx.fillStyle = '#2a2a1e';
            ctx.fillRect(x + TILE * 0.68, y + TILE * 0.62, 7, TILE * 0.38);
            ctx.fillStyle = '#1a1a10';
            ctx.beginPath();
            ctx.arc(x + TILE * 0.715, y + TILE * 0.62, 5.5, Math.PI, 0);
            ctx.fill();
            // Green gas vent glow
            const ventGrd = ctx.createRadialGradient(
              x + TILE * 0.715, y + TILE * 0.58, 0,
              x + TILE * 0.715, y + TILE * 0.58, 10
            );
            ventGrd.addColorStop(0, 'rgba(100,220,0,0.40)');
            ventGrd.addColorStop(1, 'rgba(60,150,0,0)');
            ctx.fillStyle = ventGrd;
            ctx.beginPath();
            ctx.arc(x + TILE * 0.715, y + TILE * 0.58, 10, 0, Math.PI * 2);
            ctx.fill();
          }

          // Graffiti / hazard symbol on some buildings
          if (r === 0 && c % 5 === 0) {
            ctx.save();
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = '#aacc00';
            ctx.font = `bold ${TILE * 0.42}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('☣', x + TILE * 0.5, y + TILE * 0.5);
            ctx.restore();
          }
          if (r === ROWS - 1 && c % 5 === 3) {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#88aa00';
            ctx.font = `bold ${TILE * 0.42}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🐀', x + TILE * 0.5, y + TILE * 0.5);
            ctx.restore();
          }
        }

        // ── Road details ───────────────────────────────────────────────────
        if (t === T_ROAD) {
          // Gritty road surface texture
          const roadSheen = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
          roadSheen.addColorStop(0, 'rgba(10,20,0,0.06)');
          roadSheen.addColorStop(1, 'rgba(5,10,0,0.06)');
          ctx.fillStyle = roadSheen;
          ctx.fillRect(x, y, TILE, TILE);

          const isHoriz = (t === T_ROAD);
          if (isHoriz && r % 2 === 0) {
            // Yellow-green lane dash (stinky road markings)
            ctx.shadowColor = '#aacc00';
            ctx.shadowBlur  = 3;
            ctx.strokeStyle = '#aacc0099';
            ctx.lineWidth   = 1.5;
            ctx.globalAlpha = 0.55;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(x, y + TILE / 2);
            ctx.lineTo(x + TILE, y + TILE / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
          }
          // Green sewage puddle (occasional)
          if ((c * 5 + r * 7) % 9 === 0) {
            const oilGrd = ctx.createRadialGradient(
              x + TILE * 0.4, y + TILE * 0.6, 0,
              x + TILE * 0.4, y + TILE * 0.6, TILE * 0.24
            );
            oilGrd.addColorStop(0,   'rgba(80,160,0,0.28)');
            oilGrd.addColorStop(0.4, 'rgba(40,100,0,0.16)');
            oilGrd.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = oilGrd;
            ctx.beginPath();
            ctx.ellipse(x + TILE * 0.4, y + TILE * 0.6, TILE * 0.21, TILE * 0.13, 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
          // Rat silhouette (occasional, only on road tiles)
          if ((c * 11 + r * 13) % 17 === 4) {
            const rx = x + TILE * 0.25, ry = y + TILE * 0.68;
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = '#1a1a08';
            // Rat body
            ctx.beginPath();
            ctx.ellipse(rx, ry, 7, 4, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Rat head
            ctx.beginPath();
            ctx.ellipse(rx + 6, ry - 1, 3.5, 2.8, 0.4, 0, Math.PI * 2);
            ctx.fill();
            // Rat snout
            ctx.beginPath();
            ctx.ellipse(rx + 9, ry - 0.5, 1.8, 1.4, 0.4, 0, Math.PI * 2);
            ctx.fill();
            // Rat tail (curved line)
            ctx.strokeStyle = '#1a1a08';
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(rx - 7, ry + 1);
            ctx.bezierCurveTo(rx - 10, ry + 4, rx - 14, ry + 2, rx - 12, ry - 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        // ── Sidewalk / plaza urban detail ──────────────────────────────────
        if (t === T_SIDEWALK || t === T_PAD) {
          ctx.globalAlpha = 0.10;
          ctx.strokeStyle = '#446600';
          ctx.lineWidth = 0.5;
          for (let gx = 0; gx <= TILE; gx += 20) {
            ctx.beginPath();
            ctx.moveTo(x + gx, y);
            ctx.lineTo(x + gx, y + TILE);
            ctx.stroke();
          }
          for (let gy = 0; gy <= TILE; gy += 20) {
            ctx.beginPath();
            ctx.moveTo(x, y + gy);
            ctx.lineTo(x + TILE, y + gy);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          // Crack lines on sidewalk
          if ((c * 5 + r * 9) % 7 === 2) {
            ctx.globalAlpha = 0.14;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.2, y + TILE * 0.6);
            ctx.lineTo(x + TILE * 0.6, y + TILE * 0.75);
            ctx.lineTo(x + TILE * 0.7, y + TILE * 0.9);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          // Trash bag (occasional, only sidewalk)
          if (t === T_SIDEWALK && (c * 7 + r * 11) % 13 === 3) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            const bagX = x + TILE * 0.68, bagY = y + TILE * 0.55;
            // Bag body
            const bagGrd = ctx.createRadialGradient(bagX - 2, bagY - 2, 0, bagX, bagY, 8);
            bagGrd.addColorStop(0, '#334422');
            bagGrd.addColorStop(1, '#1a2210');
            ctx.fillStyle = bagGrd;
            ctx.beginPath();
            ctx.ellipse(bagX, bagY, 7, 10, 0.1, 0, Math.PI * 2);
            ctx.fill();
            // Bag tie at top
            ctx.fillStyle = '#556633';
            ctx.beginPath();
            ctx.ellipse(bagX, bagY - 9, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Green slime seep
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#66aa00';
            ctx.beginPath();
            ctx.ellipse(bagX, bagY + 10, 5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          // Trash bin/dumpster (rare, only sidewalk)
          if (t === T_SIDEWALK && (c * 13 + r * 7) % 19 === 5) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            const binX = x + TILE * 0.18, binY = y + TILE * 0.45;
            // Bin body
            ctx.fillStyle = '#2a3820';
            ctx.beginPath();
            ctx.roundRect(binX, binY, 14, 18, 2);
            ctx.fill();
            // Bin lid
            ctx.fillStyle = '#1e2a16';
            ctx.beginPath();
            ctx.roundRect(binX - 1, binY - 3, 16, 5, 2);
            ctx.fill();
            // Green stink glow from bin
            const binGrd = ctx.createRadialGradient(binX + 7, binY - 3, 0, binX + 7, binY - 3, 14);
            binGrd.addColorStop(0, 'rgba(80,160,0,0.22)');
            binGrd.addColorStop(1, 'rgba(40,80,0,0)');
            ctx.fillStyle = binGrd;
            ctx.beginPath();
            ctx.arc(binX + 7, binY - 3, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // ── Manhole with green sewer gas glow ─────────────────────────────
        if (t === T_MANHOLE) {
          const mx = x + TILE / 2, my = y + TILE / 2;
          // Ground glow — toxic green
          const groundGrd = ctx.createRadialGradient(mx, my, 0, mx, my, TILE * 0.56);
          groundGrd.addColorStop(0, 'rgba(80,200,0,0.25)');
          groundGrd.addColorStop(1, 'rgba(40,100,0,0)');
          ctx.fillStyle = groundGrd;
          ctx.fillRect(x, y, TILE, TILE);
          // Cover plate
          ctx.fillStyle = '#1c1e10';
          ctx.beginPath();
          ctx.arc(mx, my, TILE * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#88cc00';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
          ctx.globalAlpha = 1;
          // Inner toxic gas glow
          const innerGrd = ctx.createRadialGradient(mx, my, 0, mx, my, TILE * 0.34);
          innerGrd.addColorStop(0, 'rgba(120,230,0,0.22)');
          innerGrd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = innerGrd;
          ctx.beginPath();
          ctx.arc(mx, my, TILE * 0.34, 0, Math.PI * 2);
          ctx.fill();
          // Cross grooves
          ctx.strokeStyle = '#88cc00';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.38;
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.15, my); ctx.lineTo(x + TILE * 0.85, my);
          ctx.moveTo(mx, y + TILE * 0.15); ctx.lineTo(mx, y + TILE * 0.85);
          ctx.stroke();
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.27, y + TILE * 0.27); ctx.lineTo(x + TILE * 0.73, y + TILE * 0.73);
          ctx.moveTo(x + TILE * 0.73, y + TILE * 0.27); ctx.lineTo(x + TILE * 0.27, y + TILE * 0.73);
          ctx.stroke();
          ctx.globalAlpha = 1;
          // "SEWAGE" warning text
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#88cc00';
          ctx.font = `bold ${TILE * 0.14}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('SEWAGE', mx, my + TILE * 0.5);
          ctx.restore();
        }

        // ── Build pad highlight ────────────────────────────────────────────
        if (t === T_PAD) {
          const pad = this.buildPads.find(p => p.c === c && p.r === r);
          if (pad && !pad.occupied) {
            // Neon amber glow fill
            ctx.globalAlpha = 0.15;
            ctx.fillStyle   = '#f5a623';
            ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
            // Glowing border
            ctx.shadowColor = '#f5a623';
            ctx.shadowBlur  = 8;
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#f5a623';
            ctx.lineWidth   = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
            ctx.setLineDash([]);
            ctx.shadowBlur  = 0;
            // Corner nubs
            ctx.globalAlpha = 0.65;
            ctx.fillStyle   = '#f5a623';
            const cs = 4;
            ctx.fillRect(x + 4,               y + 4,              cs, cs);
            ctx.fillRect(x + TILE - 4 - cs,   y + 4,              cs, cs);
            ctx.fillRect(x + 4,               y + TILE - 4 - cs,  cs, cs);
            ctx.fillRect(x + TILE - 4 - cs,   y + TILE - 4 - cs,  cs, cs);
            ctx.globalAlpha = 1;
          }
        }

        // ── Subtle grid lines ──────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(0,20,60,0.18)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(x, y, TILE, TILE);
      }
    }

    // ── Atmospheric green gas haze overlay ───────────────────────────────
    const fogOverlay = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    fogOverlay.addColorStop(0,   'rgba(20,30,0,0.16)');
    fogOverlay.addColorStop(0.5, 'rgba(5,8,0,0)');
    fogOverlay.addColorStop(1,   'rgba(20,30,0,0.16)');
    ctx.fillStyle = fogOverlay;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Floating green smelly dust clouds across the map
    const t_now = performance.now() * 0.001;
    for (let i = 0; i < 8; i++) {
      const cx = ((i * 137.5 + t_now * (8 + i * 3)) % LOGICAL_W);
      const cy = 60 + (i * 73) % (LOGICAL_H - 120);
      const cr = 30 + (i * 23) % 50;
      const alpha = 0.04 + 0.03 * Math.sin(t_now * 0.7 + i);
      const dustGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      dustGrd.addColorStop(0, `rgba(80,160,0,${alpha * 1.5})`);
      dustGrd.addColorStop(0.5, `rgba(60,120,0,${alpha})`);
      dustGrd.addColorStop(1, 'rgba(30,60,0,0)');
      ctx.fillStyle = dustGrd;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Grimy green border frame around entire map ────────────────────────
    ctx.save();
    ctx.shadowColor = '#88cc00';
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = '#88cc0033';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, LOGICAL_W - 2, LOGICAL_H - 2);
    ctx.shadowBlur  = 0;
    ctx.restore();

    // ── Dashed path preview line ───────────────────────────────────────────
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = '#88cc00';
    ctx.lineWidth   = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) {
      ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  _drawEntryExit(ctx) {
    const ep = PATH_POINTS[0];
    ctx.save();
    // ENTER arrow (glowing cyan)
    ctx.shadowColor  = '#00ffee';
    ctx.shadowBlur   = 10;
    ctx.fillStyle    = '#00ffee';
    ctx.globalAlpha  = 0.9;
    ctx.font         = 'bold 13px monospace';
    ctx.textAlign    = 'right';
    ctx.fillText('▶ ENTER', ep.x - 5, ep.y + 5);

    // BASE arrow (glowing red)
    const xp = PATH_POINTS[PATH_POINTS.length - 1];
    ctx.shadowColor = '#ff3344';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#ff3344';
    ctx.textAlign   = 'left';
    ctx.fillText('BASE ◀', xp.x + 5, xp.y + 5);
    ctx.restore();
  }

  // ── Build pads ─────────────────────────────────────────────────────────────

  _padAt(lx, ly) {
    const gc = Math.floor(lx / TILE);
    const gr = Math.floor(ly / TILE);
    return this.buildPads.find(p => p.c === gc && p.r === gr && !p.occupied) || null;
  }

  // ── Tower placement & selection ────────────────────────────────────────────

  _tryPlaceTower(lx, ly) {
    const pad = this._padAt(lx, ly);
    if (!pad) { showMessage('Place on a 🟡 yellow build pad!'); return; }
    const def = TOWER_DEFS[this.selectedTowerType];
    if (this.gold < def.cost) { showMessage('Not enough gold! 💰'); return; }
    this.gold -= def.cost;
    pad.occupied = true;
    const idx    = this.buildPads.indexOf(pad);
    this.towers.push(new Tower(this.selectedTowerType, idx, pad.x, pad.y));
    this.selectedTowerType = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    this.updateUI();
    showMessage(`${def.name} placed!`);
  }

  _trySelectTower(lx, ly) {
    let found = null;
    for (const t of this.towers) {
      if (Math.hypot(lx - t.x, ly - t.y) < 28) { found = t; break; }
    }
    found ? this._selectTower(found) : this._deselectTower();
  }

  _selectTower(t) {
    if (this.selectedTower) this.selectedTower.selected = false;
    this.selectedTower = t;
    t.selected = true;
    this._updateSelectedInfo();
  }

  _deselectTower() {
    if (this.selectedTower) this.selectedTower.selected = false;
    this.selectedTower = null;
    document.getElementById('selectedInfo').style.display  = 'none';
    document.getElementById('sellBtn').style.display      = 'none';
    document.getElementById('upgradeBtn').style.display   = 'none';
  }

  _updateSelectedInfo() {
    const t = this.selectedTower;
    if (!t) return;
    const lvlStr = t.canUpgrade() ? `Upgrade: ${t.upgradeCost}g` : '★ MAX LEVEL';
    document.getElementById('selectedInfo').innerHTML =
      `<strong>${t.def.name}</strong> Lv${t.level}<br>` +
      `DMG: ${t.damage} · RNG: ${t.range} · Rate: ${(1000 / t.fireRate).toFixed(1)}/s<br>` +
      `${t.def.desc}<br>` +
      `<span style="color:#9b59b6">${lvlStr}</span>`;
    document.getElementById('selectedInfo').style.display = 'block';
    document.getElementById('sellBtn').style.display      = 'block';
    document.getElementById('sellBtn').textContent        = `💸 Sell (+${t.sellValue}g)`;
    document.getElementById('upgradeBtn').style.display   = t.canUpgrade() ? 'block' : 'none';
    document.getElementById('upgradeBtn').textContent     = `⬆ Upgrade (${t.upgradeCost}g)`;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  updateUI() {
    document.getElementById('statHealth').textContent = this.baseHp;
    document.getElementById('statGold').textContent   = this.gold;
    document.getElementById('statWave').textContent   = this.waveManager.waveNum;
    document.getElementById('statKills').textContent  = this.kills;

    const alive = this.enemies.filter(e => !e.dead && !e.reached).length;
    const queued = this.waveManager.totalQueued;
    document.getElementById('statEnemies').textContent = alive + queued;
  }

  gameOver() {
    this.over = true;
    const ov  = document.getElementById('overlay');
    ov.innerHTML =
      `<h1>💀 Game Over</h1>` +
      `<p>Survived <strong>${this.waveManager.waveNum}</strong> wave${this.waveManager.waveNum !== 1 ? 's' : ''}</p>` +
      `<p>Kills: <strong>${this.kills}</strong> · Gold earned: <strong>${this.gold}</strong>g</p>` +
      `<button onclick="location.reload()">🔄 Try Again</button>`;
    ov.style.display = 'flex';
  }

  _debugMode() {
    if (!this.started) {
      getAudioCtx();
      this.start();
    }
    if (this.over) return;

    // Give plenty of gold
    this.gold = 9999;

    // Place one tower of each type on every empty build pad (cycling through types)
    const types = Object.keys(TOWER_DEFS);
    let typeIdx = 0;
    for (const pad of this.buildPads) {
      if (!pad.occupied) {
        const type = types[typeIdx % types.length];
        typeIdx++;
        pad.occupied = true;
        const idx = this.buildPads.indexOf(pad);
        this.towers.push(new Tower(type, idx, pad.x, pad.y));
      }
    }

    // Skip ahead to wave 6 (set counter to 5 so startWave increments to 6)
    const DEBUG_TARGET_WAVE = 6;
    if (this.waveManager.waveNum < DEBUG_TARGET_WAVE - 1) {
      this.waveManager.waveNum = DEBUG_TARGET_WAVE - 1;
    }
    if (!this.waveManager.active) {
      this.waveManager.startWave();
    }

    this.updateUI();
    showMessage('🐛 Debug: all towers placed, wave 6!');
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  _bindEvents() {
    // Tower selection buttons
    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        if (this.selectedTowerType === t) {
          this.selectedTowerType = null;
          btn.classList.remove('selected');
        } else {
          document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
          this.selectedTowerType = t;
          btn.classList.add('selected');
          this._deselectTower();
        }
      });
    });

    // Canvas click
    this.canvas.addEventListener('click', e => {
      if (!this.started || this.over) return;
      const rect = this.canvas.getBoundingClientRect();
      const { x, y } = this.canvasToLogical(e.clientX - rect.left, e.clientY - rect.top);
      this.selectedTowerType ? this._tryPlaceTower(x, y) : this._trySelectTower(x, y);
    });

    // Hover for ghost preview
    this.canvas.addEventListener('mousemove', e => {
      if (!this.selectedTowerType) { this.hoverPad = null; return; }
      const rect = this.canvas.getBoundingClientRect();
      const { x, y } = this.canvasToLogical(e.clientX - rect.left, e.clientY - rect.top);
      this.hoverPad = this._padAt(x, y);
    });

    // Right-click or mouse-leave → cancel selection
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.selectedTowerType = null;
      document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
      this._deselectTower();
    });

    // Buttons
    document.getElementById('btnNextWave').addEventListener('click', () => {
      if (!this.over) this.waveManager.startWave();
    });

    document.getElementById('btnPause').addEventListener('click', () => {
      this.paused = !this.paused;
      document.getElementById('btnPause').textContent = this.paused ? '▶ Resume' : '⏸ Pause';
    });

    document.getElementById('btnSpeed').addEventListener('click', () => {
      this.speed = this.speed === 1 ? 2 : 1;
      const btn  = document.getElementById('btnSpeed');
      btn.textContent = this.speed === 2 ? '⏩ Speed: 2×' : '⏩ Speed: 1×';
      btn.classList.toggle('fast', this.speed === 2);
    });

    document.getElementById('btnRestart').addEventListener('click', () => location.reload());

    document.getElementById('btnDebug').addEventListener('click', () => this._debugMode());

    document.getElementById('btnStartGame').addEventListener('click', () => {
      getAudioCtx();   // unlock audio on first gesture
      this.start();
    });

    document.getElementById('upgradeBtn').addEventListener('click', () => {
      const t = this.selectedTower;
      if (!t) return;
      if (!t.canUpgrade()) { showMessage('Already at max level!'); return; }
      if (this.gold < t.upgradeCost) { showMessage('Not enough gold! 💰'); return; }
      this.gold -= t.upgradeCost;
      t.level++;
      t.range = t.def.range + (t.level - 1) * t.def.upgradeRange;
      this.updateUI();
      this._updateSelectedInfo();
      showMessage(`${t.def.name} upgraded to level ${t.level}!`);
    });

    document.getElementById('sellBtn').addEventListener('click', () => {
      const t = this.selectedTower;
      if (!t) return;
      const gain = t.sellValue;
      this.gold += gain;
      if (t.padIndex >= 0 && t.padIndex < this.buildPads.length) {
        this.buildPads[t.padIndex].occupied = false;
      }
      this.towers = this.towers.filter(tw => tw !== t);
      this._deselectTower();
      this.updateUI();
      showMessage(`Sold for ${gain}g`);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !document.getElementById('btnNextWave').disabled) {
        e.preventDefault();
        if (!this.over && this.started) this.waveManager.startWave();
      }
      if (e.code === 'Escape') {
        this.selectedTowerType = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        this._deselectTower();
      }
      // Number keys 1-4 to select tower types
      const towerKeys = ['1', '2', '3', '4'];
      const towerTypes = Object.keys(TOWER_DEFS);
      const idx = towerKeys.indexOf(e.key);
      if (idx !== -1 && towerTypes[idx]) {
        const type = towerTypes[idx];
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        if (this.selectedTowerType === type) {
          this.selectedTowerType = null;
        } else {
          this.selectedTowerType = type;
          document.querySelector(`.tower-btn[data-type="${type}"]`)?.classList.add('selected');
          this._deselectTower();
        }
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      this._resize();
      // Re-compute pads keeping occupancy state
      const occupied = new Set(this.buildPads.filter(p => p.occupied).map(p => p.c + ',' + p.r));
      this.buildPads = this._computeBuildPads();
      this.buildPads.forEach(p => {
        if (occupied.has(p.c + ',' + p.r)) p.occupied = true;
      });
      // Re-position existing towers
      for (const t of this.towers) {
        const pad = this.buildPads[t.padIndex];
        if (pad) { t.x = pad.x; t.y = pad.y; }
      }
    });
  }
}
