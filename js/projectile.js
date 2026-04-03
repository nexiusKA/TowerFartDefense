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
    this.wobblePhase = Math.random() * Math.PI * 2;  // for organic cloud animation
  }

  get effectiveDamage() {
    return this.def.damage + (this.level - 1) * this.def.upgradeDmg;
  }

  update(dt) {
    this.wobblePhase += dt * 0.007;
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
          Math.random() < 0.5 ? '#8dc829' : '#cddc39',
          (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4 - 0.3,
          280, 3.5 + Math.random() * 4, 'gas'
        ));
      } else if (this.def.effect === 'aoe') {
        particles.push(new Particle(
          this.x, this.y,
          Math.random() < 0.5 ? '#c8a020' : '#8a5010',
          (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5 - 0.2,
          220, 3 + Math.random() * 4, 'gas'
        ));
      } else if (this.def.effect === 'pierce') {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 3,
          this.y + (Math.random() - 0.5) * 3,
          Math.random() < 0.5 ? '#8B4513' : '#6b3010',
          (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3,
          180, 2.5 + Math.random() * 2.5, 'gas'
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
    const wp = this.wobblePhase;

    if (this.def.effect === 'slow') {
      // ── Stinker: wobbly yellow-green fart cloud puff ──────────────────
      // Outer haze
      const hazeGrd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 20);
      hazeGrd.addColorStop(0, 'rgba(180,255,0,0.18)');
      hazeGrd.addColorStop(1, 'rgba(80,150,0,0)');
      ctx.fillStyle = hazeGrd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
      ctx.fill();
      // 3 overlapping wobbly cloud lobes
      const lobes = [
        [0, 0, 9 + Math.sin(wp) * 1.5],
        [Math.cos(wp + 1.2) * 5, Math.sin(wp + 1.2) * 4, 7 + Math.cos(wp * 1.3) * 1.2],
        [Math.cos(wp + 3.8) * 6, Math.sin(wp + 3.8) * 5, 7.5 + Math.sin(wp * 0.9) * 1.4],
      ];
      for (const [lx, ly, lr] of lobes) {
        const grd = ctx.createRadialGradient(this.x + lx - lr * 0.2, this.y + ly - lr * 0.2, 0,
                                             this.x + lx, this.y + ly, lr);
        grd.addColorStop(0, '#ccff44cc');
        grd.addColorStop(0.5, '#8dc82988');
        grd.addColorStop(1, '#4a7a1a00');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x + lx, this.y + ly, lr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Small stink bubbles trailing
      for (let i = 0; i < 2; i++) {
        const bx = this.x + Math.cos(wp * 0.8 + i * 2.5) * 11;
        const by = this.y + Math.sin(wp * 0.8 + i * 2.5) * 9;
        ctx.fillStyle = 'rgba(180,255,60,0.4)';
        ctx.beginPath();
        ctx.arc(bx, by, 2.5 + i, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (this.def.effect === 'aoe') {
      // ── Blaster: big brown/yellow stink bomb blob ─────────────────────
      const outerGrd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 18);
      outerGrd.addColorStop(0, 'rgba(200,160,0,0.22)');
      outerGrd.addColorStop(0.6, 'rgba(120,70,0,0.12)');
      outerGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = outerGrd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 18, 0, Math.PI * 2);
      ctx.fill();
      // 4 lobes for stinky blob shape
      const bLobes = [
        [0, 0, 8 + Math.sin(wp * 1.1) * 1.2],
        [Math.cos(wp * 0.9) * 5, Math.sin(wp * 0.9) * 4, 6.5 + Math.cos(wp) * 1],
        [Math.cos(wp + 2.1) * 6, Math.sin(wp + 2.1) * 5, 6 + Math.sin(wp * 1.2) * 1.1],
        [Math.cos(wp + 4.4) * 5, Math.sin(wp + 4.4) * 4, 5.5 + Math.cos(wp * 0.8) * 0.9],
      ];
      const bColors = ['#c8a020dd', '#8a5010aa', '#c8a02088', '#a06010aa'];
      for (let i = 0; i < bLobes.length; i++) {
        const [lx, ly, lr] = bLobes[i];
        const grd = ctx.createRadialGradient(this.x + lx - lr * 0.15, this.y + ly - lr * 0.15, 0,
                                             this.x + lx, this.y + ly, lr);
        grd.addColorStop(0, '#f5d060cc');
        grd.addColorStop(0.6, bColors[i]);
        grd.addColorStop(1, '#3a200500');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x + lx, this.y + ly, lr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Brown slime outline stroke
      ctx.strokeStyle = 'rgba(160,100,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 7 + Math.sin(wp) * 0.8, 0, Math.PI * 2);
      ctx.stroke();

    } else if (this.def.effect === 'pierce') {
      // ── Toilet: brown poop blob streak ───────────────────────────────────
      const glowGrd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 16);
      glowGrd.addColorStop(0, 'rgba(139,69,19,0.38)');
      glowGrd.addColorStop(1, 'rgba(60,20,5,0)');
      ctx.fillStyle = glowGrd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 16, 0, Math.PI * 2);
      ctx.fill();

      if (this.dir) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.dir.y, this.dir.x));
        // Elongated poop blob along travel direction
        const puffData = [
          [11, 0, 6.5 + Math.sin(wp) * 1.2],
          [0, Math.sin(wp * 0.9) * 1.5, 6 + Math.cos(wp * 1.1) * 0.9],
          [-9, Math.sin(wp * 1.1) * 1.8, 5 + Math.sin(wp * 0.8) * 0.8],
          [-17, Math.sin(wp * 0.8) * 2, 3.5 + Math.cos(wp) * 0.6],
        ];
        const puffCols = [
          'rgba(139,69,19,0.85)',
          'rgba(110,50,12,0.75)',
          'rgba(90,38,8,0.65)',
          'rgba(70,28,5,0.45)',
        ];
        for (let i = 0; i < 4; i++) {
          const [puffX, puffY, puffRadius] = puffData[i];
          const grd = ctx.createRadialGradient(puffX - puffRadius * 0.15, puffY - puffRadius * 0.15, 0, puffX, puffY, puffRadius);
          grd.addColorStop(0, '#c07840');
          grd.addColorStop(0.5, puffCols[i]);
          grd.addColorStop(1, 'rgba(40,10,2,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(puffX, puffY, puffRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        // Central brown streak
        const streakGrd = ctx.createLinearGradient(-17, 0, 13, 0);
        streakGrd.addColorStop(0, 'rgba(60,20,5,0)');
        streakGrd.addColorStop(0.5, 'rgba(139,69,19,0.55)');
        streakGrd.addColorStop(1, '#c07840aa');
        ctx.fillStyle = streakGrd;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 7);
        grd.addColorStop(0, '#c07840cc');
        grd.addColorStop(1, '#8B451300');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
