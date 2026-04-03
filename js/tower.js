// ─────────────────────────────────────────────────────────────────────────────
// TOWER  (coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_FIRE_RATE_MS = 200;       // fastest any tower can shoot (ms between shots)
const CRUSHER_SLAM_MS  = 350;       // duration of the metal bar drop animation (ms)
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
    this.barDropAnim = 0;   // 0 = idle, 1→0 = bar dropping animation progress
  }

  get fireRate()    { return Math.max(MIN_FIRE_RATE_MS, this.def.fireRate + (this.level - 1) * this.def.upgradeFireRate); }
  get damage()      { return this.def.damage + (this.level - 1) * this.def.upgradeDmg; }
  get upgradeCost() { return this.def.upgradeCost * this.level; }
  get sellValue()   { return Math.floor(this.def.cost * this.def.sellRatio + (this.level - 1) * this.def.upgradeCost * 0.4); }
  canUpgrade()      { return this.level < 3; }

  update(dt) {
    this.ringAnim = (this.ringAnim + dt * 0.002) % (Math.PI * 2);
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.barDropAnim > 0) this.barDropAnim = Math.max(0, this.barDropAnim - dt / CRUSHER_SLAM_MS);

    if (this.def.effect === 'cloud') {
      // Crusher: damage every enemy in range on a timer (no projectile)
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
          this.flashTimer = CRUSHER_SLAM_MS;
          this.barDropAnim = 1;
          playSound(this.def.sound);
          spawnMetalImpact(this.x, this.y, this.range);
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

    // ── Crusher: charge-up pulsing indicator (ring contracts before slam) ────
    if (this.type === 'fogger') {
      const chargeProgress = this.cloudTimer / this.fireRate;  // 0→1 between slams
      const pulse = 0.5 + 0.5 * Math.sin(this.ringAnim * 3);
      ctx.save();
      // Charge aura grows as next slam approaches
      const auraRadius = this.range * (0.3 + 0.5 * chargeProgress);
      const auraGrd = ctx.createRadialGradient(x, y, 0, x, y, auraRadius);
      auraGrd.addColorStop(0, '#5588cc00');
      auraGrd.addColorStop(0.6, '#5588cc' + Math.round(chargeProgress * 0x30).toString(16).padStart(2, '0'));
      auraGrd.addColorStop(1,   '#88bbff00');
      ctx.globalAlpha = 0.5 + 0.3 * pulse * chargeProgress;
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.arc(x, y, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      // Dashed charge ring
      if (chargeProgress > 0.5) {
        ctx.shadowColor = '#88bbff';
        ctx.shadowBlur  = 6;
        ctx.strokeStyle = '#5588cc';
        ctx.lineWidth   = 1.2;
        ctx.globalAlpha = (chargeProgress - 0.5) * 2 * 0.7;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(x, y, this.range * chargeProgress, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur  = 0;
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ── Flash ring when firing (non-crusher towers) ───────────────────────
    if (this.flashTimer > 0 && this.type !== 'fogger') {
      ctx.save();
      const prog = this.flashTimer / 150;
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

    // ── Glowing tech platform base ────────────────────────────────────────
    {
      const pulse = 0.5 + 0.5 * Math.sin(this.ringAnim * 2.5);
      const baseGrd = ctx.createRadialGradient(x, y + s * 0.78, 0, x, y + s * 0.78, s * 1.5);
      baseGrd.addColorStop(0, this.def.color + '44');
      baseGrd.addColorStop(0.5, this.def.color + '18');
      baseGrd.addColorStop(1,   this.def.color + '00');
      ctx.globalAlpha = 0.5 + 0.2 * pulse;
      ctx.fillStyle = baseGrd;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.78, s * 1.48, s * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      // Outer platform ring
      ctx.shadowColor = this.def.color;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.45 + 0.25 * pulse;
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.78, s * 1.1, s * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Inner dashed circuit ring
      ctx.strokeStyle = this.def.color2;
      ctx.lineWidth   = 0.8;
      ctx.globalAlpha = 0.28;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.78, s * 0.72, s * 0.21, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }

    // ── Drop shadow ───────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
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
      // ── Crusher tower — hydraulic metal press ─────────────────────────
      // Heavy base frame
      const frameGrd = ctx.createLinearGradient(x - s * 0.7, 0, x + s * 0.7, 0);
      frameGrd.addColorStop(0, '#1a2a3e');
      frameGrd.addColorStop(0.35, '#2a4a6e');
      frameGrd.addColorStop(0.65, '#3a5a88');
      frameGrd.addColorStop(1, '#1a2a3e');
      ctx.fillStyle = frameGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.7, y - s * 0.6, s * 1.4, s * 1.5, 6);
      ctx.fill();
      // Metal highlight stripe
      ctx.fillStyle = 'rgba(180,220,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(x - s * 0.55, y - s * 0.5, s * 0.3, s * 1.1, 4);
      ctx.fill();
      // Hydraulic piston shafts on sides
      const pistonGrd = ctx.createLinearGradient(x - s * 0.82, 0, x - s * 0.66, 0);
      pistonGrd.addColorStop(0, '#0e1a2e');
      pistonGrd.addColorStop(0.5, '#3a5a88');
      pistonGrd.addColorStop(1, '#0e1a2e');
      ctx.fillStyle = pistonGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.82, y - s * 0.9, s * 0.16, s * 1.8, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + s * 0.66, y - s * 0.9, s * 0.16, s * 1.8, 3);
      ctx.fill();
      // Piston highlight
      ctx.fillStyle = 'rgba(136,187,255,0.3)';
      ctx.fillRect(x - s * 0.8, y - s * 0.88, 3, s * 1.6);
      ctx.fillRect(x + s * 0.67, y - s * 0.88, 3, s * 1.6);
      // Cross-bolt details
      ctx.fillStyle = '#4a6a9a';
      const boltPositions = [[-0.46, -0.42], [0.46, -0.42], [-0.46, 0.52], [0.46, 0.52]];
      for (const [bx, by] of boltPositions) {
        ctx.beginPath();
        ctx.arc(x + s * bx, y + s * by, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#88aacc';
        ctx.beginPath();
        ctx.arc(x + s * bx - 1, y + s * by - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a6a9a';
      }
      // Glowing top cap — where bar launches from
      const capGrd = ctx.createRadialGradient(x - s * 0.08, y - s * 0.6 - s * 0.1, 0, x, y - s * 0.6, s * 0.44);
      capGrd.addColorStop(0, '#88bbff');
      capGrd.addColorStop(0.5, '#3366aa');
      capGrd.addColorStop(1, '#1a2a4e');
      ctx.fillStyle = capGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6, s * 0.44, 0, Math.PI * 2);
      ctx.fill();
      // Cap ring glow
      ctx.shadowColor = '#88bbff';
      ctx.shadowBlur  = 10;
      ctx.strokeStyle = '#5599dd';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6, s * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Crosshair on cap
      ctx.strokeStyle = 'rgba(136,187,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y - s * 0.6); ctx.lineTo(x + s * 0.3, y - s * 0.6);
      ctx.moveTo(x, y - s * 0.9);           ctx.lineTo(x, y - s * 0.3);
      ctx.stroke();
    }

    // ── Bar drop animation (Crusher only) ────────────────────────────────
    if (this.type === 'fogger' && this.barDropAnim > 0) {
      ctx.save();
      const prog    = this.barDropAnim;           // 1→0 as animation plays
      // Phase: 0→0.5 = bar drops from above, 0.5→1 = impact flash fade
      const dropPhase   = Math.min(1, (1 - prog) * 2);        // 0=top, 1=impact
      const flashPhase  = Math.max(0, (1 - prog) * 2 - 1);    // 0→1 after impact
      const barY        = y - this.range * (1 - dropPhase);   // from above down to y
      const barRadius   = this.range;                          // bar spans full diameter
      const barH        = 8 + 4 * (1 - dropPhase);
      // Bar gradient — bright steel with neon edge
      const barGrd = ctx.createLinearGradient(x - barRadius, barY, x - barRadius, barY + barH);
      barGrd.addColorStop(0,   'rgba(136,187,255,0.95)');
      barGrd.addColorStop(0.3, 'rgba(200,230,255,1.0)');
      barGrd.addColorStop(0.7, 'rgba(100,160,220,0.9)');
      barGrd.addColorStop(1,   'rgba(50,100,180,0.5)');
      ctx.shadowColor = '#88bbff';
      ctx.shadowBlur  = 16;
      ctx.fillStyle   = barGrd;
      ctx.fillRect(x - barRadius, barY - barH / 2, barRadius * 2, barH);
      // Impact shockwave ring at the bottom of the bar when it hits
      if (dropPhase >= 1) {
        const ringAlpha = 0.7 * (1 - flashPhase);
        const ringR = this.range * (0.5 + 0.8 * flashPhase);
        ctx.globalAlpha = ringAlpha;
        ctx.shadowColor = '#88bbff';
        ctx.shadowBlur  = 18;
        ctx.strokeStyle = '#88bbff';
        ctx.lineWidth   = 3 * (1 - flashPhase) + 0.5;
        ctx.beginPath();
        ctx.ellipse(x, y, ringR, ringR * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
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
