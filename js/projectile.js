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

    // Trail particles
    this._trailTimer = (this._trailTimer || 0) + dt;
    if (this._trailTimer > 45) {
      this._trailTimer = 0;
      if (this.def.effect === 'slow') {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 4,
          this.y + (Math.random() - 0.5) * 4,
          '#27ae60',
          (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4,
          220, 3, 'gas'
        ));
      } else if (this.def.effect === 'aoe') {
        particles.push(new Particle(
          this.x, this.y,
          '#f39c12',
          (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6,
          180, 2.5, 'spark'
        ));
      } else if (this.def.effect === 'pierce') {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 3,
          this.y + (Math.random() - 0.5) * 3,
          '#3498db',
          (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3,
          150, 2, 'gas'
        ));
      }
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
      // Glowing green gas ball
      const grd = ctx.createRadialGradient(this.x - 2, this.y - 2, 0, this.x, this.y, 15);
      grd.addColorStop(0, '#ccffcc');
      grd.addColorStop(0.35, '#27ae60');
      grd.addColorStop(1, 'rgba(39,174,96,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = '#e8ffe8';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.def.effect === 'aoe') {
      // Glowing orange explosive shell
      const outerGrd = ctx.createRadialGradient(this.x - 2, this.y - 2, 0, this.x, this.y, 15);
      outerGrd.addColorStop(0, 'rgba(255,220,100,0.4)');
      outerGrd.addColorStop(0.5, 'rgba(230,126,34,0.25)');
      outerGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = outerGrd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
      ctx.fill();
      // Shell body
      const shellGrd = ctx.createRadialGradient(this.x - 2.5, this.y - 2.5, 0, this.x, this.y, 9);
      shellGrd.addColorStop(0, '#f5d060');
      shellGrd.addColorStop(0.45, '#e67e22');
      shellGrd.addColorStop(1, '#a84500');
      ctx.fillStyle = shellGrd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (this.def.effect === 'pierce') {
      // Glowing blue elongated bolt
      const glowGrd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 14);
      glowGrd.addColorStop(0, 'rgba(120,210,255,0.45)');
      glowGrd.addColorStop(1, 'rgba(52,152,219,0)');
      ctx.fillStyle = glowGrd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 14, 0, Math.PI * 2);
      ctx.fill();

      if (this.dir) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.dir.y, this.dir.x));
        // Diamond bolt shape
        const boltGrd = ctx.createLinearGradient(-14, 0, 14, 0);
        boltGrd.addColorStop(0, '#1a5a8e');
        boltGrd.addColorStop(0.5, '#3498db');
        boltGrd.addColorStop(1, '#1a5a8e');
        ctx.fillStyle = boltGrd;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-5, -3.5);
        ctx.lineTo(14, 0);
        ctx.lineTo(-5, 3.5);
        ctx.closePath();
        ctx.fill();
        // Bright core streak
        ctx.fillStyle = '#b8e8ff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
