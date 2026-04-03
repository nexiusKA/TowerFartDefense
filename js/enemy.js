// ─────────────────────────────────────────────────────────────────────────────
// ENEMY  (coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
const STEALTH_CYCLE_MS = 2000;  // ms each stealth phase lasts (visible / invisible)
class Enemy {
  constructor(type, hpScale = 1) {
    const def = ENEMY_DEFS[type];
    this.type  = type;
    this.name  = def.name;
    this.hp    = Math.ceil(def.hp * hpScale);
    this.maxHp = this.hp;
    this.speed     = def.speed;
    this.baseSpeed = def.speed;
    this.reward = def.reward;
    this.color  = def.color;
    this.size   = def.size;
    this.armor  = def.armor;
    this.dead    = false;
    this.reached = false;

    // Path following
    this.pathIndex = 0;
    this.x = PATH_POINTS[0].x;
    this.y = PATH_POINTS[0].y;

    // Status effects
    this.slowTimer   = 0;
    this.poisonTimer = 0;
    this.poisonDmg   = 0;

    // Stealth cycling (visible 2 s, invisible 2 s)
    this.isStealthy     = type === 'stealth';
    this.stealthCycle   = 0;
    this.stealthVisible = type !== 'stealth';

    // Animation
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.dustTimer = 0;
  }

  takeDamage(dmg, effectType) {
    const reduced = Math.max(1, dmg - this.armor);
    this.hp -= reduced;

    if (effectType === 'slow' || effectType === 'cloud') {
      this.slowTimer   = effectType === 'cloud' ? 1200 : 2200;
      this.poisonTimer = 3200;
      this.poisonDmg   = 2;
    }

    if (this.hp <= 0) this._die();
  }

  _die() {
    this.hp   = 0;
    this.dead = true;
    game.gold  += this.reward;
    game.kills += 1;
    spawnDeathBurst(this.x, this.y, this.color);
    game.updateUI();
  }

  update(dt) {
    if (this.dead || this.reached) return;

    // Stealth cycling
    if (this.isStealthy) {
      this.stealthCycle  += dt;
      this.stealthVisible = Math.floor(this.stealthCycle / STEALTH_CYCLE_MS) % 2 === 0;
    }

    // Poison damage
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      this.hp -= this.poisonDmg * dt / 1000;
      if (this.hp <= 0) { this._die(); return; }
    }

    // Speed (slowed or normal)
    const curSpeed = this.slowTimer > 0 ? this.baseSpeed * 0.4 : this.baseSpeed;
    this.slowTimer = Math.max(0, this.slowTimer - dt);

    // Reached last waypoint → damages base
    if (this.pathIndex >= PATH_POINTS.length - 1) {
      this.reached = true;
      this.dead    = true;
      game.baseHp -= (this.type === 'boss' ? 5 : 1);
      game.updateUI();
      if (game.baseHp <= 0) game.gameOver();
      return;
    }

    // Move toward next waypoint
    const target = PATH_POINTS[this.pathIndex + 1];
    const dx   = target.x - this.x;
    const dy   = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = curSpeed * dt / 16;

    if (dist <= step) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }

    // Dust trail for fast / swarm types
    if (this.type === 'fast' || this.type === 'swarm') {
      this.dustTimer += dt;
      if (this.dustTimer > 80) { spawnDustTrail(this.x, this.y); this.dustTimer = 0; }
    }

    // Walk animation
    this.walkTimer += dt;
    if (this.walkTimer > 180) { this.walkFrame = (this.walkFrame + 1) % 4; this.walkTimer = 0; }
  }

  draw(ctx) {
    if (this.dead) return;

    const alpha = (this.isStealthy && !this.stealthVisible) ? 0.18 : 1.0;
    ctx.save();
    ctx.globalAlpha = alpha;

    const s = this.size;
    const x = this.x, y = this.y;

    // ── Slow/poison aura ──────────────────────────────────────────────────
    if (this.slowTimer > 0) {
      const auraGrd = ctx.createRadialGradient(x, y, s * 0.4, x, y, s + 9);
      auraGrd.addColorStop(0, 'rgba(39,174,96,0)');
      auraGrd.addColorStop(1, 'rgba(39,174,96,0.50)');
      ctx.globalAlpha = alpha * 0.65;
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.arc(x, y, s + 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // ── Body (gradient) ───────────────────────────────────────────────────
    const bodyGrd = ctx.createRadialGradient(x - s * 0.22, y - s * 0.22, 0, x, y, s);
    bodyGrd.addColorStop(0, this._lightenColor(this.color, 45));
    bodyGrd.addColorStop(1, this._darkenColor(this.color, 35));
    ctx.fillStyle = bodyGrd;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.72, s * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = this._darkenColor(this.color, 55);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Fur texture strokes ───────────────────────────────────────────────
    ctx.globalAlpha = alpha * 0.18;
    ctx.strokeStyle = this._darkenColor(this.color, 25);
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    for (let fi = 0; fi < 4; fi++) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5 + fi * s * 0.32, y - s * 0.58);
      ctx.lineTo(x - s * 0.54 + fi * s * 0.32, y + s * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;

    // ── Snout / nose ──────────────────────────────────────────────────────
    ctx.fillStyle = this._darkenColor(this.color, 18);
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.2, s * 0.32, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c85858';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.3, s * 0.15, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#882020';
    ctx.beginPath(); ctx.arc(x - s * 0.07, y + s * 0.32, s * 0.038, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.07, y + s * 0.32, s * 0.038, 0, Math.PI * 2); ctx.fill();

    // ── Eyes ──────────────────────────────────────────────────────────────
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x - s * 0.22, y - s * 0.16, s * 0.19, s * 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.22, y - s * 0.16, s * 0.19, s * 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(x - s * 0.19, y - s * 0.16, s * 0.10, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.25, y - s * 0.16, s * 0.10, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.22, s * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.19, y - s * 0.22, s * 0.055, 0, Math.PI * 2); ctx.fill();

    // ── Ninja headband ────────────────────────────────────────────────────
    const bandBase = this.type === 'tank' ? '#7a7a7a' : (this.type === 'boss' ? '#c0392b' : '#8B0000');
    const bandGrd  = ctx.createLinearGradient(x - s * 0.74, y - s * 0.36, x - s * 0.74, y - s * 0.14);
    bandGrd.addColorStop(0, bandBase);
    bandGrd.addColorStop(0.45, this._lightenColor(bandBase, 28));
    bandGrd.addColorStop(1, bandBase);
    ctx.fillStyle = bandGrd;
    ctx.fillRect(x - s * 0.74, y - s * 0.36, s * 1.48, s * 0.22);
    // Knot tails
    ctx.fillStyle = bandBase;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.74, y - s * 0.3);
    ctx.lineTo(x + s * 0.96, y - s * 0.48);
    ctx.lineTo(x + s * 0.96, y - s * 0.14);
    ctx.closePath();
    ctx.fill();

    // ── Legs (walk anim) ──────────────────────────────────────────────────
    const legOff = (this.walkFrame % 2 === 0) ? 3 : -3;
    ['left', 'right'].forEach((side, si) => {
      const lx = x + (si === 0 ? -s * 0.42 : s * 0.42);
      const ly = y + s * 0.72 + (si === 0 ? legOff : -legOff);
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.28);
      lg.addColorStop(0, '#7a5a47');
      lg.addColorStop(1, '#3a2820');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(lx, ly, s * 0.22, s * 0.26, si === 0 ? -0.2 : 0.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Tank armour plate ─────────────────────────────────────────────────
    if (this.type === 'tank') {
      ctx.strokeStyle = '#b0b0b0';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - s * 0.56, y - s * 0.42, s * 1.12, s * 0.92);
      // Rivets
      ctx.fillStyle = '#909090';
      for (const [rx, ry] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) {
        ctx.beginPath();
        ctx.arc(x + s * rx * 0.93, y + s * ry * 0.84, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Boss crown ────────────────────────────────────────────────────────
    if (this.type === 'boss') {
      const crownGrd = ctx.createLinearGradient(0, y - s * 1.32, 0, y - s * 0.82);
      crownGrd.addColorStop(0, '#f1c40f');
      crownGrd.addColorStop(0.5, '#e8b800');
      crownGrd.addColorStop(1, '#c89800');
      ctx.fillStyle = crownGrd;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5,  y - s * 0.82);
      ctx.lineTo(x - s * 0.5,  y - s * 1.22);
      ctx.lineTo(x - s * 0.2,  y - s * 0.96);
      ctx.lineTo(x,             y - s * 1.32);
      ctx.lineTo(x + s * 0.2,  y - s * 0.96);
      ctx.lineTo(x + s * 0.5,  y - s * 1.22);
      ctx.lineTo(x + s * 0.5,  y - s * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d4a000';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Crown ruby
      const rubyGrd = ctx.createRadialGradient(x - s * 0.04, y - s * 1.28 - s * 0.03, 0, x, y - s * 1.28, s * 0.11);
      rubyGrd.addColorStop(0, '#ff8888');
      rubyGrd.addColorStop(1, '#c0392b');
      ctx.fillStyle = rubyGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 1.28, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Swarm antennas ────────────────────────────────────────────────────
    if (this.type === 'swarm') {
      ctx.strokeStyle = this._lightenColor(this.color, 22);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.8);
      ctx.lineTo(x - s * 0.36, y - s * 1.32);
      ctx.moveTo(x + s * 0.2, y - s * 0.8);
      ctx.lineTo(x + s * 0.36, y - s * 1.32);
      ctx.stroke();
      ctx.fillStyle = this._lightenColor(this.color, 40);
      ctx.beginPath(); ctx.arc(x - s * 0.36, y - s * 1.32, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s * 0.36, y - s * 1.32, 2.8, 0, Math.PI * 2); ctx.fill();
    }

    // ── Stealth shimmer ───────────────────────────────────────────────────
    if (this.isStealthy) {
      ctx.globalAlpha = alpha * 0.32;
      ctx.strokeStyle = '#cc77ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.82, s * 0.98, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // ── HP bar (gradient) ─────────────────────────────────────────────────
    ctx.globalAlpha = 1;
    const bw = s * 1.9, bh = 5;
    const bx = x - bw / 2, by = y - s - 16;
    ctx.fillStyle = '#111';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    const pct = Math.max(0, this.hp / this.maxHp);
    const barBase = pct > 0.5 ? '#2ecc71' : (pct > 0.25 ? '#f39c12' : '#e74c3c');
    const barGrd = ctx.createLinearGradient(bx, by, bx, by + bh);
    barGrd.addColorStop(0, barBase);
    barGrd.addColorStop(1, this._darkenColor(barBase, 35));
    ctx.fillStyle = '#282828';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = barGrd;
    ctx.fillRect(bx, by, bw * pct, bh);
    // Bar shine
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(bx, by, bw * pct, bh / 2);

    ctx.restore();
  }

  _lightenColor(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 0xFF) + amt);
    const b = Math.min(255, (n & 0xFF) + amt);
    return `rgb(${r},${g},${b})`;
  }

  _darkenColor(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xFF) - amt);
    const b = Math.max(0, (n & 0xFF) - amt);
    return `rgb(${r},${g},${b})`;
  }
}
