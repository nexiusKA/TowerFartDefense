// ─────────────────────────────────────────────────────────────────────────────
// TOWER  (coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_FIRE_RATE_MS = 200;  // fastest any tower can shoot (ms between shots)
class Tower {
  constructor(type, padIndex, x, y) {
    this.type     = type;
    this.padIndex = padIndex;
    this.x = x; this.y = y;
    this.def      = TOWER_DEFS[type];
    this.level    = 1;
    this.range    = this.def.range;
    this.fireTimer = 0;
    this.cloudTimer = 0;
    this.selected  = false;
    this.flashTimer = 0;
    this.ringAnim  = 0;
  }

  get fireRate()    { return Math.max(MIN_FIRE_RATE_MS, this.def.fireRate + (this.level - 1) * this.def.upgradeFireRate); }
  get damage()      { return this.def.damage + (this.level - 1) * this.def.upgradeDmg; }
  get upgradeCost() { return this.def.upgradeCost * this.level; }
  get sellValue()   { return Math.floor(this.def.cost * this.def.sellRatio + (this.level - 1) * this.def.upgradeCost * 0.4); }
  canUpgrade()      { return this.level < 3; }

  update(dt) {
    this.ringAnim = (this.ringAnim + dt * 0.002) % (Math.PI * 2);
    if (this.flashTimer > 0) this.flashTimer -= dt;

    if (this.def.effect === 'cloud') {
      // Fogger: damage every enemy in range on a timer (no projectile)
      this.cloudTimer += dt;
      if (this.cloudTimer >= this.fireRate) {
        this.cloudTimer = 0;
        let hit = false;
        for (const e of game.enemies) {
          if (e.dead || e.reached) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range) {
            e.takeDamage(this.damage, 'cloud');
            hit = true;
          }
        }
        if (hit) {
          this.flashTimer = 350;
          playSound(this.def.sound);
          spawnFartCloud(this.x, this.y, this.def.color, 6);
        }
      }
    } else {
      this.fireTimer += dt;
      if (this.fireTimer >= this.fireRate) {
        const target = this.findTarget();
        if (target) {
          this.fireTimer = 0;
          this.flashTimer = 150;
          playSound(this.def.sound);
          game.projectiles.push(new Projectile(this.x, this.y, target, this.def, this.level));
          spawnFartCloud(this.x, this.y, this.def.color, 4);
        }
      }
    }
  }

  findTarget() {
    let best = null, bestDist = Infinity;
    for (const e of game.enemies) {
      if (e.dead || e.reached) continue;
      // Only honker (pierce) can target invisible stealth moles
      if (e.isStealthy && !e.stealthVisible && this.type !== 'honker') continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= this.range && d < bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  draw(ctx) {
    const s = 22;
    const x = this.x, y = this.y;

    // ── Range ring when selected ──────────────────────────────────────────
    if (this.selected) {
      ctx.save();
      ctx.shadowColor = this.def.color;
      ctx.shadowBlur  = 10;
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(x, y, this.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Fogger: permanent pulsing range aura ──────────────────────────────
    if (this.type === 'fogger') {
      const pulse = 0.5 + 0.5 * Math.sin(this.ringAnim * 3);
      ctx.save();
      const auraGrd = ctx.createRadialGradient(x, y, 0, x, y, this.range);
      auraGrd.addColorStop(0, this.def.color + '00');
      auraGrd.addColorStop(0.7, this.def.color + '18');
      auraGrd.addColorStop(1,   this.def.color + '00');
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.arc(x, y, this.range * (0.92 + 0.08 * pulse), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Flash ring when firing ────────────────────────────────────────────
    if (this.flashTimer > 0) {
      ctx.save();
      const prog = this.flashTimer / (this.type === 'fogger' ? 350 : 150);
      const flashGrd = ctx.createRadialGradient(x, y, s, x, y, s + 14 + (1 - prog) * 22);
      flashGrd.addColorStop(0, this.def.color2 + Math.min(255, Math.round(prog * 255)).toString(16).padStart(2, '0'));
      flashGrd.addColorStop(1, this.def.color2 + '00');
      ctx.fillStyle = flashGrd;
      ctx.beginPath();
      ctx.arc(x, y, s + 14 + (1 - prog) * 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();

    // ── Drop shadow ───────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + s * 0.86, s * 0.88, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Tower body by type ────────────────────────────────────────────────
    if (this.type === 'stinker') {
      // Bio-hazard gas tower — green cylinder
      const bodyGrd = ctx.createLinearGradient(x - s * 0.55, 0, x + s * 0.55, 0);
      bodyGrd.addColorStop(0, '#1a8a3e');
      bodyGrd.addColorStop(0.4, '#27ae60');
      bodyGrd.addColorStop(1, '#115530');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.55, y - s, s * 1.1, s * 1.8, 8);
      ctx.fill();
      // Highlight stripe
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.beginPath();
      ctx.roundRect(x - s * 0.4, y - s + 4, s * 0.28, s * 1.2, 4);
      ctx.fill();
      // Warning band
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(x - s * 0.55, y + s * 0.42, s * 1.1, s * 0.2);
      ctx.globalAlpha = 1;
      // Head nozzle (gradient sphere)
      const headGrd = ctx.createRadialGradient(x - s * 0.1, y - s - s * 0.1, 0, x, y - s, s * 0.44);
      headGrd.addColorStop(0, '#4cdd88');
      headGrd.addColorStop(1, '#1a7040');
      ctx.fillStyle = headGrd;
      ctx.beginPath();
      ctx.arc(x, y - s, s * 0.44, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlight on head
      ctx.fillStyle = 'rgba(180,255,180,0.45)';
      ctx.beginPath();
      ctx.arc(x - s * 0.12, y - s - s * 0.14, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      // Side gas nozzle pipe
      ctx.strokeStyle = '#115530';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.42, y - s * 0.38);
      ctx.lineTo(x + s * 0.78, y - s * 0.72);
      ctx.stroke();
      const nozzleGrd = ctx.createRadialGradient(x + s * 0.78, y - s * 0.72, 0, x + s * 0.78, y - s * 0.72, 5);
      nozzleGrd.addColorStop(0, '#4cdd88');
      nozzleGrd.addColorStop(1, '#1a7040');
      ctx.fillStyle = nozzleGrd;
      ctx.beginPath();
      ctx.arc(x + s * 0.78, y - s * 0.72, 5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'blaster') {
      // Explosive shell launcher — orange barrel
      const bodyGrd = ctx.createLinearGradient(x - s * 0.6, 0, x + s * 0.6, 0);
      bodyGrd.addColorStop(0, '#a84500');
      bodyGrd.addColorStop(0.4, '#e67e22');
      bodyGrd.addColorStop(1, '#7a3000');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 1.7, 7);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(x - s * 0.44, y - s * 0.8, s * 0.28, s * 1.1, 4);
      ctx.fill();
      // Danger stripes
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#e74c3c';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x - s * 0.6, y - s * 0.08 + i * s * 0.33, s * 1.2, s * 0.13);
      }
      ctx.globalAlpha = 1;
      // Barrel cap
      const capGrd = ctx.createRadialGradient(x - s * 0.1, y - s * 0.9 - s * 0.14, 0, x, y - s * 0.9, s * 0.54);
      capGrd.addColorStop(0, '#505050');
      capGrd.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = capGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.9, s * 0.54, 0, Math.PI * 2);
      ctx.fill();
      const innerGrd = ctx.createRadialGradient(x - s * 0.08, y - s * 0.9 - s * 0.08, 0, x, y - s * 0.9, s * 0.32);
      innerGrd.addColorStop(0, '#f39c12');
      innerGrd.addColorStop(1, '#d35400');
      ctx.fillStyle = innerGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.9, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // Fuse wire
      ctx.strokeStyle = '#8a4800';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.28, y - s * 0.58);
      ctx.bezierCurveTo(x + s * 0.52, y - s * 0.86, x + s * 0.66, y - s * 0.48, x + s * 0.56, y - s * 0.18);
      ctx.stroke();
      // Spark at fuse tip
      if (this.flashTimer > 0) {
        const sparkGrd = ctx.createRadialGradient(x + s * 0.56, y - s * 0.18, 0, x + s * 0.56, y - s * 0.18, 6);
        sparkGrd.addColorStop(0, '#fff');
        sparkGrd.addColorStop(0.4, '#f1c40f');
        sparkGrd.addColorStop(1, 'rgba(230,126,34,0)');
        ctx.fillStyle = sparkGrd;
        ctx.beginPath();
        ctx.arc(x + s * 0.56, y - s * 0.18, 6, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (this.type === 'honker') {
      // Long-range sniper horn tower — blue hexagonal
      const bodyGrd = ctx.createLinearGradient(x - s * 0.5, 0, x + s * 0.5, 0);
      bodyGrd.addColorStop(0, '#1a5a8e');
      bodyGrd.addColorStop(0.4, '#2980b9');
      bodyGrd.addColorStop(1, '#0e3a5a');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y + s * 0.8);
      ctx.lineTo(x + s * 0.35, y + s * 0.8);
      ctx.lineTo(x + s * 0.5,  y - s * 0.4);
      ctx.lineTo(x + s * 0.15, y - s * 1.12);
      ctx.lineTo(x - s * 0.15, y - s * 1.12);
      ctx.lineTo(x - s * 0.5,  y - s * 0.4);
      ctx.closePath();
      ctx.fill();
      // Highlight facet
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.22, y + s * 0.62);
      ctx.lineTo(x - s * 0.06, y + s * 0.62);
      ctx.lineTo(x - s * 0.22, y - s * 0.92);
      ctx.closePath();
      ctx.fill();
      // Scope sphere
      const scopeGrd = ctx.createRadialGradient(x - s * 0.1, y - s * 1.12 - s * 0.1, 0, x, y - s * 1.12, s * 0.32);
      scopeGrd.addColorStop(0, '#5ab8ff');
      scopeGrd.addColorStop(1, '#1a5a8e');
      ctx.fillStyle = scopeGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 1.12, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // Cross-hair lines on scope
      ctx.strokeStyle = '#a8d8ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, y - s * 1.12); ctx.lineTo(x + s * 0.24, y - s * 1.12);
      ctx.moveTo(x, y - s * 1.36);             ctx.lineTo(x, y - s * 0.88);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Barrel tube
      ctx.strokeStyle = '#0e3a5a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.44, y - s * 0.28);
      ctx.lineTo(x + s * 0.88, y - s * 0.64);
      ctx.stroke();
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.44, y - s * 0.28);
      ctx.lineTo(x + s * 0.88, y - s * 0.64);
      ctx.stroke();

    } else if (this.type === 'fogger') {
      // Gas canister — purple with tubes and vents
      const bodyGrd = ctx.createLinearGradient(x - s * 0.62, 0, x + s * 0.62, 0);
      bodyGrd.addColorStop(0, '#5a1a7e');
      bodyGrd.addColorStop(0.4, '#8e44ad');
      bodyGrd.addColorStop(1, '#3a0a5e');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.62, y - s * 0.85, s * 1.24, s * 1.65, 12);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.roundRect(x - s * 0.48, y - s * 0.75, s * 0.28, s * 1.1, 6);
      ctx.fill();
      // Glowing vents
      for (let i = 0; i < 3; i++) {
        const vy = y - s * 0.3 + i * s * 0.28;
        ctx.strokeStyle = this.def.color2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.44, vy);
        ctx.lineTo(x + s * 0.44, vy);
        ctx.stroke();
        const ventGrd = ctx.createLinearGradient(x - s * 0.44, 0, x + s * 0.44, 0);
        ventGrd.addColorStop(0, 'rgba(155,89,182,0)');
        ventGrd.addColorStop(0.5, 'rgba(155,89,182,0.28)');
        ventGrd.addColorStop(1, 'rgba(155,89,182,0)');
        ctx.fillStyle = ventGrd;
        ctx.fillRect(x - s * 0.44, vy - 2, s * 0.88, 4);
      }
      // Nozzle top
      const nozzleGrd = ctx.createRadialGradient(x - s * 0.08, y - s * 0.85 - s * 0.1, 0, x, y - s * 0.85, s * 0.37);
      nozzleGrd.addColorStop(0, '#c07ee0');
      nozzleGrd.addColorStop(1, '#5a1a7e');
      ctx.fillStyle = nozzleGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.85, s * 0.37, 0, Math.PI * 2);
      ctx.fill();
      // Gas tube coiling out
      ctx.strokeStyle = '#3a0a5e';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y - s * 0.2);
      ctx.bezierCurveTo(x - s * 0.95, y - s * 0.2, x - s * 0.95, y + s * 0.42, x - s * 0.62, y + s * 0.42);
      ctx.stroke();
      ctx.strokeStyle = '#7a3a9e';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y - s * 0.2);
      ctx.bezierCurveTo(x - s * 0.95, y - s * 0.2, x - s * 0.95, y + s * 0.42, x - s * 0.62, y + s * 0.42);
      ctx.stroke();
    }

    // ── Level pips (★ at L2, red ● at L3/max) ────────────────────────────
    for (let i = 0; i < this.level; i++) {
      const px = x - (this.level - 1) * 5 + i * 10;
      const py = y + s * 0.56;
      const pipColor = this.level === 3 ? '#e74c3c' : '#f1c40f';
      const pipGrd = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, 4.5);
      pipGrd.addColorStop(0, this.level === 3 ? '#ff8888' : '#fff8aa');
      pipGrd.addColorStop(1, pipColor);
      ctx.fillStyle = pipGrd;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
