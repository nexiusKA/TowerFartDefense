// ─────────────────────────────────────────────────────────────────────────────
// PROJECTILE  (coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
class Projectile {
  constructor(x, y, target, towerDef, level) {
    this.x = x; this.y = y;
    this.target   = target;
    this.def      = towerDef;
    this.level    = level;
    this.speed    = 6;
    this.dead     = false;
    this.pierceHit = new Set();
    this.dir       = null;
  }

  get effectiveDamage() {
    return this.def.damage + (this.level - 1) * this.def.upgradeDmg;
  }

  update(dt) {
    if (this.def.effect === 'pierce') {
      this._movePierce(dt);
    } else {
      this._moveTracking(dt);
    }
  }

  _movePierce(dt) {
    // Lock direction on first frame
    if (!this.dir) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      this.dir = { x: dx / d, y: dy / d };
    }
    this.x += this.dir.x * this.speed * dt / 16;
    this.y += this.dir.y * this.speed * dt / 16;

    // Damage any enemy we pass through
    for (const e of game.enemies) {
      if (this.pierceHit.has(e) || e.dead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) < 20) {
        this.pierceHit.add(e);
        e.takeDamage(this.effectiveDamage, 'pierce');
      }
    }

    // Kill projectile once off screen
    if (this.x < -30 || this.x > LOGICAL_W + 30 ||
        this.y < -30 || this.y > LOGICAL_H + 30) {
      this.dead = true;
    }
  }

  _moveTracking(dt) {
    if (!this.target || this.target.dead) { this.dead = true; return; }

    const dx   = this.target.x - this.x;
    const dy   = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < this.speed * dt / 16 + 5) {
      this._hit();
    } else {
      this.x += (dx / dist) * this.speed * dt / 16;
      this.y += (dy / dist) * this.speed * dt / 16;
    }
  }

  _hit() {
    this.dead = true;
    if (this.def.effect === 'aoe') {
      spawnExplosion(this.x, this.y);
      const radius = 72;
      for (const e of game.enemies) {
        if (Math.hypot(e.x - this.x, e.y - this.y) < radius) {
          e.takeDamage(this.effectiveDamage, 'aoe');
        }
      }
    } else {
      if (this.target && !this.target.dead) {
        this.target.takeDamage(this.effectiveDamage, this.def.effect);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    if (this.def.effect === 'slow') {
      // Green fart ball with wisp
      ctx.fillStyle = '#27ae60';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#a8f0a8';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.def.effect === 'aoe') {
      // Orange shell
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.def.effect === 'pierce') {
      // Blue elongated bolt
      ctx.fillStyle = '#3498db';
      if (this.dir) {
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.dir.y, this.dir.x));
        ctx.fillRect(-12, -3, 24, 6);
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
