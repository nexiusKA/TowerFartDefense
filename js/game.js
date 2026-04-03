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
    this.uiTimer      = 0;   // throttle DOM updates

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

    // Periodic UI refresh for wave progress bar
    this.uiTimer += dt;
    if (this.uiTimer > UI_UPDATE_INTERVAL_MS) {
      this.uiTimer = 0;
      this.updateUI();
    }

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

    // Wave HUD overlay (drawn in canvas pixel space for crisp readability)
    this._drawWaveHUD(ctx);
  }

  _drawWaveHUD(ctx) {
    const wm = this.waveManager;
    if (wm.waveNum === 0) return;

    const cw = this.canvas.width;
    const isBossWave = wm.waveNum % 5 === 0;
    const waveColor  = isBossWave ? '#ff3344' : '#00ffee';
    const t_now      = performance.now() * 0.003;

    ctx.save();

    // ── Wave number banner ─────────────────────────────────────────────────
    const alpha = isBossWave ? 0.7 + 0.3 * Math.sin(t_now * 4) : 1;
    ctx.globalAlpha = alpha;
    ctx.font         = 'bold 16px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = waveColor;
    ctx.shadowColor  = waveColor;
    ctx.shadowBlur   = 12;
    const label = isBossWave
      ? `💀 BOSS WAVE ${wm.waveNum} 💀`
      : `🌊 Wave ${wm.waveNum}`;
    ctx.fillText(label, cw / 2, 6);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // ── Progress bar ───────────────────────────────────────────────────────
    if (wm.totalInWave > 0) {
      const alive  = this.enemies.filter(e => !e.dead && !e.reached).length;
      const killed = Math.max(0, wm.totalInWave - wm.totalQueued - alive);
      const pct    = killed / wm.totalInWave;

      const barW = Math.min(240, cw * 0.3);
      const barH = 6;
      const bx   = (cw - barW) / 2;
      const by   = 26;

      // Track
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, barH, 3);
      ctx.fill();

      // Fill
      if (pct > 0) {
        ctx.fillStyle = isBossWave ? '#ff3344' : '#00ffee';
        ctx.shadowColor = waveColor;
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.roundRect(bx, by, barW * pct, barH, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Border
      ctx.strokeStyle = waveColor + '55';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, barH, 3);
      ctx.stroke();

      // Label
      ctx.font         = '10px monospace';
      ctx.fillStyle    = '#ffffffaa';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${killed}/${wm.totalInWave} eliminated`, cw / 2, by + barH + 3);
    }

    ctx.restore();
  }

  _drawMap(ctx) {
    // ── Warm sunset sky gradient behind everything ─────────────────────────
    const skyGrd = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    skyGrd.addColorStop(0,    '#e8902a');
    skyGrd.addColorStop(0.45, '#d46828');
    skyGrd.addColorStop(1,    '#c05020');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // ── Distant city silhouette in background ────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#7a3818';
    const skylineHeights = [55,70,45,80,60,90,50,75,65,55,85,45,70,60,50,80,65,45,75,60,
                            55,90,50,70,80,45,60,75,55,65];
    for (let i = 0; i < COLS; i++) {
      const sh = skylineHeights[i % skylineHeights.length];
      ctx.fillRect(i * TILE, LOGICAL_H - sh, TILE - 1, sh);
      // Simple window dots on silhouette
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#f0d080';
      for (let wy = LOGICAL_H - sh + 6; wy < LOGICAL_H - 6; wy += 10) {
        for (let wx = i * TILE + 4; wx < (i + 1) * TILE - 4; wx += 8) {
          if ((i * 3 + Math.floor(wy / 10)) % 3 !== 0) ctx.fillRect(wx, wy, 4, 5);
        }
      }
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#7a3818';
    }
    ctx.restore();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE, y = r * TILE;
        const t = MAP_GRID[r][c];

        // ── Base fill ──────────────────────────────────────────────────────
        switch (t) {
          case T_BUILDING: ctx.fillStyle = '#9b6b52'; break;
          case T_ROAD:     ctx.fillStyle = '#5a5048'; break;
          case T_SIDEWALK: ctx.fillStyle = '#b8a888'; break;
          case T_GRASS:    ctx.fillStyle = '#8a7040'; break;
          case T_PAD:      ctx.fillStyle = '#b8a888'; break;
          case T_MANHOLE:  ctx.fillStyle = '#5a5048'; break;
        }
        ctx.fillRect(x, y, TILE, TILE);

        // ── Building details ───────────────────────────────────────────────
        if (t === T_BUILDING) {
          // Warm brick face gradient
          const brickGrd = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
          brickGrd.addColorStop(0, 'rgba(200,110,60,0.18)');
          brickGrd.addColorStop(1, 'rgba(100,45,15,0.22)');
          ctx.fillStyle = brickGrd;
          ctx.fillRect(x, y, TILE, TILE);

          // Horizontal brick mortar lines
          ctx.globalAlpha = 0.18;
          ctx.strokeStyle = '#5a3018';
          ctx.lineWidth = 0.8;
          for (let by = 5; by < TILE; by += 8) {
            ctx.beginPath();
            ctx.moveTo(x, y + by);
            ctx.lineTo(x + TILE, y + by);
            ctx.stroke();
          }
          // Vertical brick joints (offset per row)
          for (let brow = 0; brow < Math.ceil(TILE / 8); brow++) {
            const offset = (brow % 2 === 0) ? 0 : TILE * 0.5;
            ctx.beginPath();
            ctx.moveTo(x + offset, y + brow * 8);
            ctx.lineTo(x + offset, y + brow * 8 + 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + offset + TILE * 0.5, y + brow * 8);
            ctx.lineTo(x + offset + TILE * 0.5, y + brow * 8 + 8);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          // Windows — cartoon urban palette (pink, blue, amber)
          for (let wy = 5; wy < TILE - 5; wy += 14) {
            for (let wx = 5; wx < TILE - 5; wx += 14) {
              const litType = (c * 3 + r * 7 + Math.floor(wx / 14) * 2 + Math.floor(wy / 14)) % 7;
              ctx.globalAlpha = 0.88;
              if      (litType === 0) ctx.fillStyle = '#1a0e08';  // dark/off
              else if (litType === 1) ctx.fillStyle = '#2a1408';  // dim amber
              else if (litType === 2) ctx.fillStyle = '#f0b4c8';  // pink lit
              else if (litType === 3) ctx.fillStyle = '#90d0e8';  // blue lit
              else if (litType === 4) ctx.fillStyle = '#f0d060';  // warm yellow
              else if (litType === 5) ctx.fillStyle = '#e8904040'; // orange tint
              else                    ctx.fillStyle = '#c8e0f040'; // light blue tint
              ctx.fillRect(x + wx, y + wy, 9, 9);
              // Window frame
              ctx.globalAlpha = 0.55;
              ctx.strokeStyle = '#3a2010';
              ctx.lineWidth = 0.8;
              ctx.strokeRect(x + wx, y + wy, 9, 9);
              // Window cross divider on lit windows
              if (litType >= 2) {
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = '#3a2010';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(x + wx + 4.5, y + wy);
                ctx.lineTo(x + wx + 4.5, y + wy + 9);
                ctx.moveTo(x + wx, y + wy + 4.5);
                ctx.lineTo(x + wx + 9, y + wy + 4.5);
                ctx.stroke();
                // Warm light gleam on window
                ctx.globalAlpha = 0.22;
                ctx.fillStyle = '#fff8e8';
                ctx.fillRect(x + wx + 1, y + wy + 1, 3, 2);
              }
              ctx.globalAlpha = 1;
            }
          }

          // TV antenna on rooftop (top-row buildings)
          if (r === 0 && c % 3 === 0) {
            ctx.save();
            ctx.strokeStyle = '#2a1808';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            // Vertical mast
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.65, y + TILE * 0.08);
            ctx.lineTo(x + TILE * 0.65, y + TILE * 0.55);
            ctx.stroke();
            // Horizontal cross-bars
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.48, y + TILE * 0.16);
            ctx.lineTo(x + TILE * 0.82, y + TILE * 0.16);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.52, y + TILE * 0.24);
            ctx.lineTo(x + TILE * 0.78, y + TILE * 0.24);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.56, y + TILE * 0.32);
            ctx.lineTo(x + TILE * 0.74, y + TILE * 0.32);
            ctx.stroke();
            ctx.restore();
          }

          // Water tower on rooftop (bottom-row buildings, occasional)
          if (r === ROWS - 1 && c % 5 === 2) {
            ctx.save();
            ctx.globalAlpha = 0.75;
            const wtX = x + TILE * 0.5, wtY = y + TILE * 0.28;
            // Tank body (rounded cylinder top-down view as ellipse)
            const wtGrd = ctx.createRadialGradient(wtX - 3, wtY - 3, 0, wtX, wtY, 11);
            wtGrd.addColorStop(0, '#8a6040');
            wtGrd.addColorStop(1, '#4a2810');
            ctx.fillStyle = wtGrd;
            ctx.beginPath();
            ctx.ellipse(wtX, wtY, 11, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            // Support legs
            ctx.strokeStyle = '#3a2010';
            ctx.lineWidth = 1.5;
            const legOffsets = [[-8,-6],[8,-6],[0,8]];
            for (const [lx, ly] of legOffsets) {
              ctx.beginPath();
              ctx.moveTo(wtX + lx * 0.5, wtY + ly * 0.5);
              ctx.lineTo(wtX + lx, wtY + ly + 8);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Fire escape staircase on some building facades
          if ((c * 5 + r * 3) % 6 === 1) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#2a1808';
            ctx.fillStyle   = '#3a2010';
            ctx.lineWidth   = 1.2;
            const feX = x + TILE * 0.06;
            const feY = y + TILE * 0.25;
            // Outer landing platform
            ctx.fillRect(feX, feY, TILE * 0.28, 3);
            // Railing posts
            for (let pi = 0; pi <= 2; pi++) {
              ctx.beginPath();
              ctx.moveTo(feX + pi * (TILE * 0.14), feY);
              ctx.lineTo(feX + pi * (TILE * 0.14), feY - 5);
              ctx.stroke();
            }
            // Top railing
            ctx.beginPath();
            ctx.moveTo(feX, feY - 5);
            ctx.lineTo(feX + TILE * 0.28, feY - 5);
            ctx.stroke();
            // Zigzag stair going down to lower platform
            const feY2 = y + TILE * 0.72;
            ctx.beginPath();
            ctx.moveTo(feX + TILE * 0.28, feY + 3);
            ctx.lineTo(feX + TILE * 0.1,  feY2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(feX + TILE * 0.18, feY + 3);
            ctx.lineTo(feX,              feY2);
            ctx.stroke();
            // Lower platform
            ctx.fillRect(feX, feY2, TILE * 0.28, 3);
            ctx.restore();
          }

          // Urban billboard on some top-row buildings
          if (r === 0 && c % 5 === 3) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            const signPalette = ['#d46828', '#c84838', '#e8a030', '#b83828'];
            ctx.strokeStyle = signPalette[c % signPalette.length];
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + TILE * 0.12, y + TILE * 0.2, TILE * 0.76, TILE * 0.42);
            ctx.fillStyle = signPalette[c % signPalette.length];
            ctx.font = `bold ${TILE * 0.16}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labels = [['APT','4B'], ['FOR','RENT'], ['PIZZA','KING'], ['BODEGA','NYC']];
            const lbl = labels[c % labels.length];
            ctx.fillText(lbl[0], x + TILE * 0.5, y + TILE * 0.32);
            ctx.fillText(lbl[1], x + TILE * 0.5, y + TILE * 0.50);
            ctx.restore();
          }
        }

        // ── Road details ───────────────────────────────────────────────────
        if (t === T_ROAD) {
          // Warm asphalt surface sheen
          const roadSheen = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
          roadSheen.addColorStop(0, 'rgba(80,50,20,0.08)');
          roadSheen.addColorStop(1, 'rgba(40,20,5,0.08)');
          ctx.fillStyle = roadSheen;
          ctx.fillRect(x, y, TILE, TILE);

          // Yellow centre lane dashes
          if (r % 2 === 0) {
            ctx.shadowColor = '#d4a820';
            ctx.shadowBlur  = 2;
            ctx.strokeStyle = '#d4a82099';
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
          // Warm puddle / oil slick (occasional)
          if ((c * 5 + r * 7) % 9 === 0) {
            const oilGrd = ctx.createRadialGradient(
              x + TILE * 0.4, y + TILE * 0.6, 0,
              x + TILE * 0.4, y + TILE * 0.6, TILE * 0.24
            );
            oilGrd.addColorStop(0,   'rgba(180,100,40,0.22)');
            oilGrd.addColorStop(0.4, 'rgba(120,60,20,0.12)');
            oilGrd.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = oilGrd;
            ctx.beginPath();
            ctx.ellipse(x + TILE * 0.4, y + TILE * 0.6, TILE * 0.21, TILE * 0.13, 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // ── Sidewalk / plaza urban detail ──────────────────────────────────
        if (t === T_SIDEWALK || t === T_PAD) {
          // Warm concrete slab grid
          ctx.globalAlpha = 0.14;
          ctx.strokeStyle = '#7a5830';
          ctx.lineWidth = 0.6;
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
            ctx.globalAlpha = 0.16;
            ctx.strokeStyle = '#5a3818';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + TILE * 0.2, y + TILE * 0.55);
            ctx.lineTo(x + TILE * 0.6, y + TILE * 0.72);
            ctx.lineTo(x + TILE * 0.72, y + TILE * 0.88);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          // Fire hydrant (occasional, only sidewalk)
          if (t === T_SIDEWALK && (c * 7 + r * 11) % 17 === 3) {
            ctx.save();
            ctx.globalAlpha = 0.72;
            const hyX = x + TILE * 0.22, hyY = y + TILE * 0.52;
            // Hydrant body
            ctx.fillStyle = '#c83020';
            ctx.beginPath();
            ctx.roundRect(hyX - 4, hyY - 6, 9, 12, 2);
            ctx.fill();
            // Hydrant cap
            ctx.fillStyle = '#e84030';
            ctx.beginPath();
            ctx.arc(hyX, hyY - 6, 4.5, 0, Math.PI * 2);
            ctx.fill();
            // Side nozzles
            ctx.fillStyle = '#c83020';
            ctx.fillRect(hyX - 7, hyY - 3, 3, 4);
            ctx.fillRect(hyX + 5, hyY - 3, 3, 4);
            ctx.restore();
          }

          // Trash bags on sidewalk
          if (t === T_SIDEWALK && (c * 7 + r * 11) % 13 === 3) {
            ctx.save();
            ctx.globalAlpha = 0.65;
            const bagX = x + TILE * 0.72, bagY = y + TILE * 0.58;
            const bagGrd = ctx.createRadialGradient(bagX - 2, bagY - 3, 0, bagX, bagY, 9);
            bagGrd.addColorStop(0, '#3a3020');
            bagGrd.addColorStop(1, '#1e180e');
            ctx.fillStyle = bagGrd;
            ctx.beginPath();
            ctx.ellipse(bagX, bagY, 7, 10, 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a4028';
            ctx.beginPath();
            ctx.ellipse(bagX, bagY - 9, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Dumpster (rare, only sidewalk)
          if (t === T_SIDEWALK && (c * 13 + r * 7) % 19 === 5) {
            ctx.save();
            ctx.globalAlpha = 0.68;
            const binX = x + TILE * 0.18, binY = y + TILE * 0.48;
            ctx.fillStyle = '#3a5830';
            ctx.beginPath();
            ctx.roundRect(binX, binY, 15, 16, 2);
            ctx.fill();
            ctx.fillStyle = '#2e4226';
            ctx.beginPath();
            ctx.roundRect(binX - 1, binY - 4, 17, 6, 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // ── Manhole with warm sewer glow ─────────────────────────────────
        if (t === T_MANHOLE) {
          const mx = x + TILE / 2, my = y + TILE / 2;
          // Ground glow — warm amber steam
          const groundGrd = ctx.createRadialGradient(mx, my, 0, mx, my, TILE * 0.56);
          groundGrd.addColorStop(0, 'rgba(220,140,40,0.28)');
          groundGrd.addColorStop(1, 'rgba(120,60,10,0)');
          ctx.fillStyle = groundGrd;
          ctx.fillRect(x, y, TILE, TILE);
          // Cover plate — warm dark iron
          ctx.fillStyle = '#2e2018';
          ctx.beginPath();
          ctx.arc(mx, my, TILE * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#c87830';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
          ctx.globalAlpha = 1;
          // Inner amber glow
          const innerGrd = ctx.createRadialGradient(mx, my, 0, mx, my, TILE * 0.34);
          innerGrd.addColorStop(0, 'rgba(240,160,40,0.25)');
          innerGrd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = innerGrd;
          ctx.beginPath();
          ctx.arc(mx, my, TILE * 0.34, 0, Math.PI * 2);
          ctx.fill();
          // Cross grooves
          ctx.strokeStyle = '#c87830';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.40;
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.15, my); ctx.lineTo(x + TILE * 0.85, my);
          ctx.moveTo(mx, y + TILE * 0.15); ctx.lineTo(mx, y + TILE * 0.85);
          ctx.stroke();
          ctx.globalAlpha = 0.22;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.27, y + TILE * 0.27); ctx.lineTo(x + TILE * 0.73, y + TILE * 0.73);
          ctx.moveTo(x + TILE * 0.73, y + TILE * 0.27); ctx.lineTo(x + TILE * 0.27, y + TILE * 0.73);
          ctx.stroke();
          ctx.globalAlpha = 1;
          // "SEWER" warning text
          ctx.save();
          ctx.globalAlpha = 0.30;
          ctx.fillStyle = '#d49040';
          ctx.font = `bold ${TILE * 0.14}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('SEWER', mx, my + TILE * 0.5);
          ctx.restore();
        }

        // ── Build pad highlight ────────────────────────────────────────────
        if (t === T_PAD) {
          const pad = this.buildPads.find(p => p.c === c && p.r === r);
          if (pad && !pad.occupied) {
            ctx.globalAlpha = 0.15;
            ctx.fillStyle   = '#f5a623';
            ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
            ctx.shadowColor = '#f5a623';
            ctx.shadowBlur  = 8;
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#f5a623';
            ctx.lineWidth   = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
            ctx.setLineDash([]);
            ctx.shadowBlur  = 0;
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

        // ── Subtle tile grid lines ─────────────────────────────────────────
        ctx.strokeStyle = 'rgba(60,25,8,0.14)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(x, y, TILE, TILE);
      }
    }

    // ── Animated fluffy clouds drifting across the sky ─────────────────────
    const t_now = performance.now() * 0.001;
    // Clouds float across the top and bottom building rows
    const cloudBands = [TILE * 0.9, TILE * 1.5, LOGICAL_H - TILE * 1.0, LOGICAL_H - TILE * 0.45];
    for (let i = 0; i < 6; i++) {
      const speed  = 12 + i * 8;
      const cx     = ((i * 210 + t_now * speed) % (LOGICAL_W + 120)) - 60;
      const cy     = cloudBands[i % cloudBands.length];
      const scale  = 0.7 + (i % 3) * 0.3;
      const alpha  = 0.55 + 0.12 * Math.sin(t_now * 0.5 + i);
      ctx.save();
      ctx.globalAlpha = alpha;
      // Cloud puffs (warm pink-white)
      const cloudColor = (i % 2 === 0) ? '#ffe8d8' : '#f8d8c8';
      ctx.fillStyle = cloudColor;
      const puffs = [[0,0,18],[20,-8,14],[38,0,16],[-16,4,12],[54,4,12]]; // [x_offset, y_offset, radius]
      for (const [px, py, pr] of puffs) {
        ctx.beginPath();
        ctx.arc(cx + px * scale, cy + py * scale, pr * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      // Soft outline
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = '#c89870';
      ctx.lineWidth = 1;
      for (const [px, py, pr] of puffs) {
        ctx.beginPath();
        ctx.arc(cx + px * scale, cy + py * scale, pr * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Warm amber atmospheric haze overlay ──────────────────────────────
    const hazeOverlay = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    hazeOverlay.addColorStop(0,   'rgba(200,90,20,0.10)');
    hazeOverlay.addColorStop(0.5, 'rgba(160,60,10,0)');
    hazeOverlay.addColorStop(1,   'rgba(200,90,20,0.10)');
    ctx.fillStyle = hazeOverlay;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // ── Warm border frame around entire map ───────────────────────────────
    ctx.save();
    ctx.shadowColor = '#d47830';
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = 'rgba(212,120,48,0.30)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, LOGICAL_W - 2, LOGICAL_H - 2);
    ctx.shadowBlur  = 0;
    ctx.restore();

    // ── Dashed path preview line ───────────────────────────────────────────
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#e8a030';
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
      if (Math.hypot(lx - t.x, ly - t.y) < 20) { found = t; break; }
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

    const alive  = this.enemies.filter(e => !e.dead && !e.reached).length;
    const queued = this.waveManager.totalQueued;
    document.getElementById('statEnemies').textContent = alive + queued;

    // ── Wave detail panel ──────────────────────────────────────────────────
    const wm = this.waveManager;
    const isBossWave = wm.waveNum > 0 && wm.waveNum % 5 === 0;

    if (wm.waveNum > 0 && wm.totalInWave > 0) {
      const killed = Math.max(0, wm.totalInWave - queued - alive);
      const pct    = Math.round((killed / wm.totalInWave) * 100);
      document.getElementById('waveProgress').style.width = pct + '%';
      document.getElementById('waveProgressWrap').style.display = 'block';

      // Composition breakdown
      const typeEmoji = { basic: '🐾', fast: '⚡', tank: '🛡️', stealth: '👤', swarm: '🦟', boss: '💀' };
      const parts = Object.entries(wm.waveComposition)
        .map(([t, c]) => `${typeEmoji[t] || '❓'}×${c}`);
      document.getElementById('waveComposition').textContent = parts.join('  ');
      document.getElementById('waveComposition').style.display = 'block';
    } else {
      document.getElementById('waveProgressWrap').style.display = 'none';
      document.getElementById('waveComposition').style.display  = 'none';
    }

    // Boss alert
    document.getElementById('bossAlert').style.display = isBossWave ? 'block' : 'none';

    // Next boss info
    if (wm.waveNum > 0) {
      const nextBoss = Math.ceil((wm.waveNum + 1) / 5) * 5;
      document.getElementById('nextBossInfo').textContent = `Next boss: Wave ${nextBoss}`;
      document.getElementById('nextBossInfo').style.display = 'block';
    } else {
      document.getElementById('nextBossInfo').style.display = 'none';
    }
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
