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

    // Range ring when selected
    if (this.selected) {
      ctx.save();
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(x, y, this.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Fogger: permanent pulsing cloud aura
    if (this.type === 'fogger') {
      const pulse = 0.5 + 0.5 * Math.sin(this.ringAnim * 3);
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.05 * pulse;
      ctx.fillStyle   = this.def.color;
      ctx.beginPath();
      ctx.arc(x, y, this.range * (0.92 + 0.08 * pulse), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flash ring when firing
    if (this.flashTimer > 0) {
      ctx.save();
      const prog = this.flashTimer / (this.type === 'fogger' ? 350 : 150);
      ctx.globalAlpha = prog * 0.55;
      ctx.fillStyle   = this.def.color2;
      ctx.beginPath();
      ctx.arc(x, y, s + 14 + (1 - prog) * 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.82, s * 0.9, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.def.color;

    if (this.type === 'stinker') {
      ctx.beginPath();
      ctx.roundRect(x - s * 0.55, y - s, s * 1.1, s * 1.8, 8);
      ctx.fill();
      ctx.fillStyle = this.def.color2;
      ctx.beginPath();
      ctx.arc(x, y - s, s * 0.42, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'blaster') {
      ctx.beginPath();
      ctx.roundRect(x - s * 0.6, y - s * 0.9, s * 1.2, s * 1.7, 6);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x, y - s * 0.9, s * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.def.color2;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.9, s * 0.3, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'honker') {
      // Tall horn
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y + s * 0.8);
      ctx.lineTo(x + s * 0.35, y + s * 0.8);
      ctx.lineTo(x + s * 0.5,  y - s * 0.4);
      ctx.lineTo(x + s * 0.15, y - s * 1.12);
      ctx.lineTo(x - s * 0.15, y - s * 1.12);
      ctx.lineTo(x - s * 0.5,  y - s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.def.color2;
      ctx.beginPath();
      ctx.arc(x, y - s * 1.12, s * 0.3, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'fogger') {
      // Chunky rounded canister
      ctx.beginPath();
      ctx.roundRect(x - s * 0.62, y - s * 0.85, s * 1.24, s * 1.65, 12);
      ctx.fill();
      // Vents
      ctx.strokeStyle = this.def.color2;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.45, y - s * 0.3 + i * s * 0.28);
        ctx.lineTo(x + s * 0.45, y - s * 0.3 + i * s * 0.28);
        ctx.stroke();
      }
      // Nozzle top
      ctx.fillStyle = this.def.color2;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.85, s * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Level pips
    for (let i = 0; i < this.level; i++) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x - (this.level - 1) * 5 + i * 10, y + s * 0.52, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
