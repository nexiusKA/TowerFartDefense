// ─────────────────────────────────────────────────────────────────────────────
// GAME  – uses a unified logical (tile-space) coordinate system.
//
// All game objects live in 0..LOGICAL_W × 0..LOGICAL_H space (960 × 600).
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
    this.lastTime    = 0;

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

    // Apply one unified scale: everything inside uses logical coords
    ctx.save();
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

        // Tile fill color
        switch (t) {
          case T_BUILDING: ctx.fillStyle = '#192a42'; break;
          case T_ROAD:     ctx.fillStyle = '#3a3a3a'; break;
          case T_SIDEWALK: ctx.fillStyle = '#a09080'; break;
          case T_GRASS:    ctx.fillStyle = '#294f1a'; break;
          case T_PAD:      ctx.fillStyle = '#a09080'; break;
          case T_MANHOLE:  ctx.fillStyle = '#3a3a3a'; break;
        }
        ctx.fillRect(x, y, TILE, TILE);

        // Building windows
        if (t === T_BUILDING) {
          ctx.globalAlpha = 0.55;
          for (let wy = 8; wy < TILE - 8; wy += 14) {
            for (let wx = 8; wx < TILE - 8; wx += 14) {
              const lit = (c + r + Math.floor(wx / 14) + Math.floor(wy / 14)) % 3 !== 0;
              ctx.fillStyle = lit ? '#f1c40f' : '#0a1a2f';
              ctx.fillRect(x + wx, y + wy, 8, 8);
            }
          }
          ctx.globalAlpha = 1;
        }

        // Road centre-line dashes
        if (t === T_ROAD) {
          const isHoriz = (r === 3 || r === 4 || r === 6 || r === 7);
          if (isHoriz && r % 2 === 0) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth   = 2;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(x, y + TILE / 2);
            ctx.lineTo(x + TILE, y + TILE / 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Manhole cover
        if (t === T_MANHOLE) {
          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#777';
          ctx.lineWidth   = 2;
          ctx.stroke();
          ctx.strokeStyle = '#444';
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + TILE * 0.15, y + TILE / 2); ctx.lineTo(x + TILE * 0.85, y + TILE / 2);
          ctx.moveTo(x + TILE / 2, y + TILE * 0.15); ctx.lineTo(x + TILE / 2, y + TILE * 0.85);
          ctx.stroke();
        }

        // Build pad highlight
        if (t === T_PAD) {
          const pad = this.buildPads.find(p => p.c === c && p.r === r);
          if (pad && !pad.occupied) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle   = '#f5a623';
            ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#f5a623';
            ctx.lineWidth   = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
            ctx.setLineDash([]);
          }
        }

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.07)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(x, y, TILE, TILE);
      }
    }

    // Dashed path preview line (all in logical coords — no extra scaling needed)
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 4;
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
    // Green "ENTER" arrow on right edge at row 4
    const ep = PATH_POINTS[0];
    ctx.save();
    ctx.fillStyle   = '#2ecc71';
    ctx.globalAlpha = 0.7;
    ctx.font        = 'bold 13px Segoe UI';
    ctx.textAlign   = 'right';
    ctx.fillText('▶ ENTER', ep.x - 5, ep.y + 5);

    // Red "BASE" arrow at exit (left edge row 7)
    const xp = PATH_POINTS[PATH_POINTS.length - 1];
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'left';
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
