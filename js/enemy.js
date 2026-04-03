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

    // Slow aura
    if (this.slowTimer > 0) {
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(x, y, s + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.72, s * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x - s * 0.22, y - s * 0.16, s * 0.19, s * 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.22, y - s * 0.16, s * 0.19, s * 0.19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(x - s * 0.19, y - s * 0.16, s * 0.10, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.25, y - s * 0.16, s * 0.10, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();

    // Ninja headband
    const bandColor = this.type === 'tank' ? '#aaa' : (this.type === 'boss' ? '#e74c3c' : '#c0392b');
    ctx.fillStyle = bandColor;
    ctx.fillRect(x - s * 0.74, y - s * 0.36, s * 1.48, s * 0.22);

    // Legs (walk anim)
    const legOff = (this.walkFrame % 2 === 0) ? 3 : -3;
    ctx.fillStyle = '#5D4037';
    ctx.beginPath(); ctx.ellipse(x - s * 0.42, y + s * 0.72 + legOff, s * 0.22, s * 0.26, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.42, y + s * 0.72 - legOff, s * 0.22, s * 0.26,  0.2, 0, Math.PI * 2); ctx.fill();

    // Tank armour plate
    if (this.type === 'tank') {
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - s * 0.56, y - s * 0.42, s * 1.12, s * 0.92);
    }

    // Boss crown
    if (this.type === 'boss') {
      ctx.fillStyle = '#f1c40f';
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
    }

    // Swarm antennas
    if (this.type === 'swarm') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.8);
      ctx.lineTo(x - s * 0.35, y - s * 1.3);
      ctx.moveTo(x + s * 0.2, y - s * 0.8);
      ctx.lineTo(x + s * 0.35, y - s * 1.3);
      ctx.stroke();
    }

    // HP bar
    ctx.globalAlpha = 1;
    const bw = s * 1.9, bh = 5;
    const bx = x - bw / 2, by = y - s - 16;
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, bw, bh);
    const pct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = pct > 0.5 ? '#2ecc71' : (pct > 0.25 ? '#f39c12' : '#e74c3c');
    ctx.fillRect(bx, by, bw * pct, bh);

    ctx.restore();
  }
}
