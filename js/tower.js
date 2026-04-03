// ─────────────────────────────────────────────────────────────────────────────
// TOWER  (coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_FIRE_RATE_MS  = 200;       // fastest any tower can shoot (ms between shots)
const CRUSHER_SLAM_MS   = 350;       // duration of the metal bar drop animation (ms)
const ATTACK_ANIM_MS    = 420;       // duration of per-tower attack animation (ms)
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
    this.attackAnim  = 0;   // 0 = idle, 1→0 = per-tower attack animation progress
  }

  get fireRate() {
    const base = soundDurations[this.def.sound] ?? this.def.fireRate;
    return Math.max(MIN_FIRE_RATE_MS, base + (this.level - 1) * this.def.upgradeFireRate);
  }
  get damage() {
    const dur = soundDurations[this.def.sound];
    const base = (dur != null && this.def.fireRate > 0)
      ? Math.round(this.def.damage * dur / this.def.fireRate)
      : this.def.damage;
    return base + (this.level - 1) * this.def.upgradeDmg;
  }
  get upgradeCost() { return this.def.upgradeCost * this.level; }
  get sellValue()   { return Math.floor(this.def.cost * this.def.sellRatio + (this.level - 1) * this.def.upgradeCost * 0.4); }
  canUpgrade()      { return this.level < 3; }

  update(dt) {
    this.ringAnim = (this.ringAnim + dt * 0.002) % (Math.PI * 2);
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.barDropAnim > 0) this.barDropAnim = Math.max(0, this.barDropAnim - dt / CRUSHER_SLAM_MS);
    if (this.attackAnim  > 0) this.attackAnim  = Math.max(0, this.attackAnim  - dt / ATTACK_ANIM_MS);

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
          this.attackAnim  = 1;
          playSound(this.def.sound);
          spawnFartCloudSlam(this.x, this.y, this.range);
        }
      }
    } else {
      this.fireTimer += dt;
      if (this.fireTimer >= this.fireRate) {
        const target = this.findTarget();
        if (target) {
          this.fireTimer = 0;
          this.flashTimer = 150;
          this.attackAnim = 1;
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

    // ── Fogger: toxic charge-up cloud (ring contracts before slam) ─────────
    if (this.type === 'fogger') {
      const chargeProgress = this.cloudTimer / this.fireRate;
      const pulse = 0.5 + 0.5 * Math.sin(this.ringAnim * 3);
      ctx.save();
      const auraRadius = this.range * (0.3 + 0.5 * chargeProgress);
      const auraGrd = ctx.createRadialGradient(x, y, 0, x, y, auraRadius);
      auraGrd.addColorStop(0, '#66cc0000');
      auraGrd.addColorStop(0.6, '#66cc00' + Math.round(chargeProgress * 0x30).toString(16).padStart(2, '0'));
      auraGrd.addColorStop(1,   '#aaff4400');
      ctx.globalAlpha = 0.5 + 0.3 * pulse * chargeProgress;
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.arc(x, y, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      if (chargeProgress > 0.5) {
        ctx.shadowColor = '#aaff44';
        ctx.shadowBlur  = 6;
        ctx.strokeStyle = '#66cc00';
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

    // ── Fart flash ring when firing (non-fogger towers) ─────────────────
    if (this.flashTimer > 0 && this.type !== 'fogger') {
      ctx.save();
      const prog = this.flashTimer / 150;
      // Each tower has a themed fart-burst color
      const flashCol = this.type === 'stinker' ? '#8dc829'
                     : this.type === 'blaster' ? '#c8a020'
                     : '#8B4513';  // toilet (brown poop burst)
      const flashGrd = ctx.createRadialGradient(x, y, s, x, y, s + 14 + (1 - prog) * 22);
      flashGrd.addColorStop(0, flashCol + Math.min(255, Math.round(prog * 220)).toString(16).padStart(2, '0'));
      flashGrd.addColorStop(1, flashCol + '00');
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
      // Stinky garbage-can tower — rusty olive green, dripping slime
      const bodyGrd = ctx.createLinearGradient(x - s * 0.55, 0, x + s * 0.55, 0);
      bodyGrd.addColorStop(0, '#2d5a0f');
      bodyGrd.addColorStop(0.4, '#4a7a1a');
      bodyGrd.addColorStop(1, '#1a3a08');
      ctx.fillStyle = bodyGrd;
      // Garbage-can shape: slightly wider at top
      ctx.beginPath();
      ctx.moveTo(x - s * 0.52, y + s * 0.82);
      ctx.lineTo(x - s * 0.58, y - s * 0.25);
      ctx.lineTo(x - s * 0.52, y - s * 0.88);
      ctx.lineTo(x + s * 0.52, y - s * 0.88);
      ctx.lineTo(x + s * 0.58, y - s * 0.25);
      ctx.lineTo(x + s * 0.52, y + s * 0.82);
      ctx.closePath();
      ctx.fill();
      // Rust patches
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#8a5010';
      ctx.beginPath(); ctx.ellipse(x - s * 0.18, y + s * 0.2, s * 0.18, s * 0.1, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + s * 0.24, y - s * 0.3, s * 0.13, s * 0.08, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Slime drip left
      ctx.fillStyle = '#6aaa1a';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.32, y - s * 0.5);
      ctx.bezierCurveTo(x - s * 0.46, y - s * 0.1, x - s * 0.5, y + s * 0.1, x - s * 0.42, y + s * 0.52);
      ctx.bezierCurveTo(x - s * 0.34, y + s * 0.68, x - s * 0.24, y + s * 0.6, x - s * 0.28, y + s * 0.28);
      ctx.bezierCurveTo(x - s * 0.2, y, x - s * 0.22, y - s * 0.3, x - s * 0.32, y - s * 0.5);
      ctx.fill();
      // Slime drip right
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y - s * 0.35);
      ctx.bezierCurveTo(x + s * 0.32, y, x + s * 0.4, y + s * 0.2, x + s * 0.35, y + s * 0.6);
      ctx.bezierCurveTo(x + s * 0.27, y + s * 0.75, x + s * 0.17, y + s * 0.65, x + s * 0.2, y + s * 0.35);
      ctx.bezierCurveTo(x + s * 0.14, y + s * 0.1, x + s * 0.12, y - s * 0.1, x + s * 0.2, y - s * 0.35);
      ctx.fill();
      // Lid
      const lidGrd = ctx.createLinearGradient(x - s * 0.6, y - s * 0.88, x + s * 0.6, y - s * 0.88);
      lidGrd.addColorStop(0, '#1a3a08');
      lidGrd.addColorStop(0.5, '#3a6010');
      lidGrd.addColorStop(1, '#1a3a08');
      ctx.fillStyle = lidGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.62, y - s * 1.02, s * 1.24, s * 0.2, 4);
      ctx.fill();
      // Lid slime seep
      ctx.fillStyle = '#8dc829';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) {
        const dx = [-0.22, 0.08, 0.34][i];
        const phase = this.ringAnim + i * 1.4;
        const dropLen = s * (0.12 + 0.08 * Math.abs(Math.sin(phase)));
        ctx.beginPath();
        ctx.moveTo(x + s * dx - 2, y - s * 0.82);
        ctx.bezierCurveTo(x + s * dx - 2, y - s * 0.82 + dropLen * 0.5,
                          x + s * dx + 2, y - s * 0.82 + dropLen * 0.5,
                          x + s * dx, y - s * 0.82 + dropLen);
        ctx.arc(x + s * dx, y - s * 0.82 + dropLen, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Biohazard symbol
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#cddc39';
      ctx.font = `bold ${s * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☣', x, y - s * 0.1);
      ctx.restore();
      // Bubbles rising from lid
      const bPhase = this.ringAnim * 1.5;
      const bubbleData = [[-0.2, -1.18, 3.5], [0.05, -1.28, 2.8], [0.25, -1.16, 4]];
      for (const [bx, by, br] of bubbleData) {
        const wobY = Math.sin(bPhase + bx * 8) * 0.07;
        const grd = ctx.createRadialGradient(x + s * bx - br * 0.3, y + s * (by + wobY) - br * 0.3, 0,
                                             x + s * bx, y + s * (by + wobY), br);
        grd.addColorStop(0, '#ccff44cc');
        grd.addColorStop(1, '#4a7a1a44');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x + s * bx, y + s * (by + wobY), br, 0, Math.PI * 2);
        ctx.fill();
      }
      // Attack animation: big stinky green burst
      if (this.attackAnim > 0) {
        const prog = this.attackAnim;
        const burstR = s * (1.5 + 2.5 * (1 - prog));
        const burstAlpha = prog * 0.75;
        ctx.save();
        const burstGrd = ctx.createRadialGradient(x, y - s * 0.5, 0, x, y - s * 0.5, burstR);
        burstGrd.addColorStop(0, `rgba(180,255,0,${burstAlpha})`);
        burstGrd.addColorStop(0.4, `rgba(100,200,0,${burstAlpha * 0.6})`);
        burstGrd.addColorStop(1, 'rgba(50,120,0,0)');
        ctx.fillStyle = burstGrd;
        ctx.beginPath();
        ctx.arc(x, y - s * 0.5, burstR, 0, Math.PI * 2);
        ctx.fill();
        // Stink rays
        ctx.strokeStyle = '#8dc829';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = prog * 0.6;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const r0 = s * 0.8, r1 = s * (1.6 + 1.4 * (1 - prog));
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(ang) * r0, y - s * 0.5 + Math.sin(ang) * r0);
          ctx.lineTo(x + Math.cos(ang) * r1, y - s * 0.5 + Math.sin(ang) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }

    } else if (this.type === 'blaster') {
      // Stink-bomb launcher — fat round brown/yellow bomb with smoking fuse
      const bodyGrd = ctx.createRadialGradient(x - s * 0.15, y - s * 0.25, 0, x, y - s * 0.1, s * 0.85);
      bodyGrd.addColorStop(0, '#c8a020');
      bodyGrd.addColorStop(0.5, '#7a5010');
      bodyGrd.addColorStop(1, '#3a2005');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.1, s * 0.82, 0, Math.PI * 2);
      ctx.fill();
      // Smelly cracks / veins
      ctx.strokeStyle = '#1a1000';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y - s * 0.5); ctx.bezierCurveTo(x - s * 0.1, y - s * 0.2, x + s * 0.1, y - s * 0.1, x + s * 0.4, y + s * 0.2);
      ctx.moveTo(x + s * 0.2, y - s * 0.6); ctx.bezierCurveTo(x + s * 0.3, y - s * 0.3, x + s * 0.5, y - s * 0.1, x + s * 0.6, y + s * 0.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Slime seep from cracks
      ctx.fillStyle = '#a0c820';
      ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.ellipse(x - s * 0.1, y + s * 0.55, s * 0.2, s * 0.06, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Smell lines (static arcs)
      ctx.strokeStyle = '#cddc39';
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 3; i++) {
        const r = s * (0.95 + i * 0.22);
        ctx.beginPath();
        ctx.arc(x, y - s * 0.1, r, -Math.PI * 0.7, -Math.PI * 0.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Skull label
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffeeaa';
      ctx.font = `bold ${s * 0.62}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💀', x, y - s * 0.1);
      ctx.restore();
      // Fuse wire (on top)
      ctx.strokeStyle = '#5a3a00';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.18, y - s * 0.88);
      ctx.bezierCurveTo(x + s * 0.42, y - s * 1.1, x + s * 0.6, y - s * 0.78, x + s * 0.52, y - s * 0.52);
      ctx.stroke();
      // Smoking fuse tip
      const fuseTipX = x + s * 0.52, fuseTipY = y - s * 0.52;
      const sparkGrd = ctx.createRadialGradient(fuseTipX, fuseTipY, 0, fuseTipX, fuseTipY, 7);
      sparkGrd.addColorStop(0, '#fff');
      sparkGrd.addColorStop(0.3, this.flashTimer > 0 ? '#ff6600' : '#ffcc00');
      sparkGrd.addColorStop(1, 'rgba(255,150,0,0)');
      ctx.fillStyle = sparkGrd;
      ctx.beginPath();
      ctx.arc(fuseTipX, fuseTipY, this.flashTimer > 0 ? 9 : 5, 0, Math.PI * 2);
      ctx.fill();
      // Attack animation: explosive stink cloud
      if (this.attackAnim > 0) {
        const prog = this.attackAnim;
        ctx.save();
        // Tower shake
        ctx.translate((Math.random() - 0.5) * prog * 4, (Math.random() - 0.5) * prog * 4);
        // Big brown/yellow blast rings
        for (let ring = 0; ring < 2; ring++) {
          const ringProg = Math.min(1, (1 - prog) * 1.8 + ring * 0.3);
          const ringR = s * (1.2 + 2.8 * ringProg);
          const ringAlpha = Math.max(0, prog - ring * 0.3) * 0.7;
          const blastGrd = ctx.createRadialGradient(x, y - s * 0.1, ringR * 0.3, x, y - s * 0.1, ringR);
          blastGrd.addColorStop(0, `rgba(200,160,0,${ringAlpha * 0.5})`);
          blastGrd.addColorStop(0.5, `rgba(120,70,0,${ringAlpha * 0.35})`);
          blastGrd.addColorStop(1, 'rgba(60,30,0,0)');
          ctx.fillStyle = blastGrd;
          ctx.beginPath();
          ctx.arc(x, y - s * 0.1, ringR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

    } else if (this.type === 'honker') {
      // ── Toilet tower – porcelain throne that shoots smelly poop ──────────

      // Water tank (back, upper part)
      const tankGrd = ctx.createLinearGradient(x - s * 0.38, y - s * 1.3, x + s * 0.38, y - s * 0.55);
      tankGrd.addColorStop(0, '#d4cfbe');
      tankGrd.addColorStop(0.4, '#edeade');
      tankGrd.addColorStop(1, '#b8b2a0');
      ctx.fillStyle = tankGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.38, y - s * 1.28, s * 0.76, s * 0.72, 6);
      ctx.fill();
      // Tank highlight sheen
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(x - s * 0.32, y - s * 1.22, s * 0.2, s * 0.6, 4);
      ctx.fill();
      // Tank lid
      const lidGrd = ctx.createLinearGradient(x - s * 0.42, y - s * 1.28, x + s * 0.42, y - s * 1.28);
      lidGrd.addColorStop(0, '#c8c3b2');
      lidGrd.addColorStop(0.5, '#f0ece0');
      lidGrd.addColorStop(1, '#c8c3b2');
      ctx.fillStyle = lidGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.42, y - s * 1.34, s * 0.84, s * 0.12, 5);
      ctx.fill();
      // Flush handle
      ctx.fillStyle = '#a8a090';
      ctx.beginPath();
      ctx.roundRect(x + s * 0.3, y - s * 1.1, s * 0.14, s * 0.08, 2);
      ctx.fill();
      ctx.fillStyle = '#ccb820'; // gold handle
      ctx.beginPath();
      ctx.arc(x + s * 0.44, y - s * 1.06, s * 0.06, 0, Math.PI * 2);
      ctx.fill();

      // Toilet bowl body
      const bowlGrd = ctx.createLinearGradient(x - s * 0.52, y - s * 0.55, x + s * 0.52, y + s * 0.75);
      bowlGrd.addColorStop(0, '#dedad0');
      bowlGrd.addColorStop(0.35, '#f0ece0');
      bowlGrd.addColorStop(1, '#c0bba8');
      ctx.fillStyle = bowlGrd;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.52);
      ctx.lineTo(x - s * 0.52, y + s * 0.38);
      ctx.bezierCurveTo(x - s * 0.52, y + s * 0.78, x + s * 0.52, y + s * 0.78, x + s * 0.52, y + s * 0.38);
      ctx.lineTo(x + s * 0.5, y - s * 0.52);
      ctx.closePath();
      ctx.fill();
      // Bowl inner sheen
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.38, y - s * 0.44);
      ctx.lineTo(x - s * 0.2, y - s * 0.44);
      ctx.lineTo(x - s * 0.26, y + s * 0.32);
      ctx.closePath();
      ctx.fill();

      // Toilet seat (oval rim, open facing us)
      ctx.strokeStyle = '#b8b2a0';
      ctx.lineWidth = s * 0.08;
      ctx.fillStyle = '#e8e4d4';
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.15, s * 0.44, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c8c3b2';
      ctx.lineWidth = s * 0.05;
      ctx.stroke();

      // Brown poop water inside bowl
      const waterGrd = ctx.createRadialGradient(x, y - s * 0.12, 0, x, y - s * 0.12, s * 0.35);
      waterGrd.addColorStop(0, '#5a2a10');
      waterGrd.addColorStop(0.6, '#4a1e08');
      waterGrd.addColorStop(1, '#2a0e04');
      ctx.fillStyle = waterGrd;
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.12, s * 0.3, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Poop surface bubbles
      ctx.globalAlpha = 0.55;
      const bubblePhase = this.ringAnim;
      for (let i = 0; i < 3; i++) {
        const bx2 = x + Math.cos(bubblePhase + i * 2.1) * s * 0.13;
        const by2 = y - s * 0.12 + Math.sin(bubblePhase * 0.7 + i * 1.4) * s * 0.06;
        ctx.fillStyle = '#7a3a18';
        ctx.beginPath();
        ctx.arc(bx2, by2, s * (0.04 + i * 0.02), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Pedestal base
      const pedGrd = ctx.createLinearGradient(x - s * 0.3, y + s * 0.6, x + s * 0.3, y + s * 0.85);
      pedGrd.addColorStop(0, '#d4cfbe');
      pedGrd.addColorStop(1, '#b0aa98');
      ctx.fillStyle = pedGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.28, y + s * 0.6, s * 0.56, s * 0.22, 4);
      ctx.fill();

      // Brown stink wisps rising from bowl
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < 2; i++) {
        const wx = x + (i === 0 ? -s * 0.1 : s * 0.08);
        const wy = y - s * 0.38;
        const wGrd = ctx.createRadialGradient(wx, wy, 0, wx, wy, s * 0.22);
        wGrd.addColorStop(0, '#8B4513aa');
        wGrd.addColorStop(1, 'rgba(80,30,5,0)');
        ctx.fillStyle = wGrd;
        ctx.beginPath();
        ctx.arc(wx, wy, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Attack animation: brown poop blob shoots from bowl
      if (this.attackAnim > 0) {
        const prog = this.attackAnim;
        const beamLen = s * (3 + 2.5 * (1 - prog));
        // Aim direction: upward-right from bowl
        const dirX = Math.cos(-0.7), dirY = Math.sin(-0.7);
        const bx0 = x + s * 0.3, by0 = y - s * 0.2;
        ctx.save();
        // Poop streak
        const poopGrd = ctx.createLinearGradient(bx0, by0, bx0 + dirX * beamLen, by0 + dirY * beamLen);
        poopGrd.addColorStop(0, `rgba(139,69,19,${prog * 0.95})`);
        poopGrd.addColorStop(0.4, `rgba(100,45,10,${prog * 0.7})`);
        poopGrd.addColorStop(1, 'rgba(60,20,5,0)');
        ctx.strokeStyle = poopGrd;
        ctx.lineWidth = s * 0.36 * prog;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx0, by0);
        ctx.lineTo(bx0 + dirX * beamLen, by0 + dirY * beamLen);
        ctx.stroke();
        // Poop splatter puffs along beam
        for (let i = 0; i < 4; i++) {
          const t2 = (i + 0.5) / 4;
          const px2 = bx0 + dirX * beamLen * t2;
          const py2 = by0 + dirY * beamLen * t2;
          const pr2 = s * 0.28 * prog * (1 - t2 * 0.5);
          const pGrd = ctx.createRadialGradient(px2, py2, 0, px2, py2, pr2);
          pGrd.addColorStop(0, `rgba(160,80,20,${prog * 0.6})`);
          pGrd.addColorStop(1, 'rgba(60,20,5,0)');
          ctx.fillStyle = pGrd;
          ctx.beginPath();
          ctx.arc(px2, py2, pr2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

    } else if (this.type === 'fogger') {
      // ── Stinky gas compressor — rusty purple/green leaky tank ─────────────
      // Main rusty barrel body
      const frameGrd = ctx.createLinearGradient(x - s * 0.7, 0, x + s * 0.7, 0);
      frameGrd.addColorStop(0, '#2a1a3e');
      frameGrd.addColorStop(0.35, '#4a2a6e');
      frameGrd.addColorStop(0.65, '#5a3a78');
      frameGrd.addColorStop(1, '#2a1a3e');
      ctx.fillStyle = frameGrd;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.7, y - s * 0.6, s * 1.4, s * 1.5, 6);
      ctx.fill();
      // Rust / stain patches
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#5a2a00';
      ctx.beginPath(); ctx.ellipse(x - s * 0.3, y + s * 0.3, s * 0.25, s * 0.12, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + s * 0.35, y - s * 0.15, s * 0.18, s * 0.09, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Green gas leaking from sides (always visible)
      const leak = 0.5 + 0.5 * Math.sin(this.ringAnim * 2.2);
      ctx.globalAlpha = 0.3 + 0.15 * leak;
      const leftLeakGrd = ctx.createRadialGradient(x - s * 0.78, y + s * 0.1, 0, x - s * 0.78, y + s * 0.1, s * 0.5);
      leftLeakGrd.addColorStop(0, '#80ff4466');
      leftLeakGrd.addColorStop(1, 'rgba(80,180,0,0)');
      ctx.fillStyle = leftLeakGrd;
      ctx.beginPath();
      ctx.arc(x - s * 0.78, y + s * 0.1, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      const rightLeakGrd = ctx.createRadialGradient(x + s * 0.78, y - s * 0.05, 0, x + s * 0.78, y - s * 0.05, s * 0.4);
      rightLeakGrd.addColorStop(0, '#ccff4466');
      rightLeakGrd.addColorStop(1, 'rgba(100,200,0,0)');
      ctx.fillStyle = rightLeakGrd;
      ctx.beginPath();
      ctx.arc(x + s * 0.78, y - s * 0.05, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Piston shafts on sides (now look like cracked pipes)
      const pistonGrd = ctx.createLinearGradient(x - s * 0.82, 0, x - s * 0.66, 0);
      pistonGrd.addColorStop(0, '#1a0e2e');
      pistonGrd.addColorStop(0.5, '#3a2a58');
      pistonGrd.addColorStop(1, '#1a0e2e');
      ctx.fillStyle = pistonGrd;
      ctx.beginPath(); ctx.roundRect(x - s * 0.82, y - s * 0.9, s * 0.16, s * 1.8, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x + s * 0.66, y - s * 0.9, s * 0.16, s * 1.8, 3); ctx.fill();
      // Crack on left pipe
      ctx.strokeStyle = '#80ff44';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.76, y + s * 0.05);
      ctx.lineTo(x - s * 0.72, y + s * 0.15);
      ctx.lineTo(x - s * 0.76, y + s * 0.25);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Bolt details
      ctx.fillStyle = '#5a3a7a';
      const boltPositions = [[-0.46, -0.42], [0.46, -0.42], [-0.46, 0.52], [0.46, 0.52]];
      for (const [boltX, boltY] of boltPositions) {
        ctx.beginPath();
        ctx.arc(x + s * boltX, y + s * boltY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9a6aaa';
        ctx.beginPath();
        ctx.arc(x + s * boltX - 1, y + s * boltY - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a3a7a';
      }
      // Pressure gauge top cap (glowing toxic green)
      const capGrd = ctx.createRadialGradient(x - s * 0.08, y - s * 0.6 - s * 0.1, 0, x, y - s * 0.6, s * 0.44);
      capGrd.addColorStop(0, '#aaff44');
      capGrd.addColorStop(0.5, '#336622');
      capGrd.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = capGrd;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6, s * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = '#88ff00';
      ctx.shadowBlur  = 10;
      ctx.strokeStyle = '#66cc22';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6, s * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Skull/biohazard on cap
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ccff44';
      ctx.font = `bold ${s * 0.38}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☣', x, y - s * 0.6);
      ctx.restore();
    }

    // ── Gas slam animation (Fogger only) ─────────────────────────────────
    if (this.type === 'fogger' && this.barDropAnim > 0) {
      ctx.save();
      const prog      = this.barDropAnim;           // 1→0 as animation plays
      const dropPhase  = Math.min(1, (1 - prog) * 2);
      const flashPhase = Math.max(0, (1 - prog) * 2 - 1);
      const cloudY    = y - this.range * (1 - dropPhase);
      // Descending fart cloud wave instead of metal bar
      const cloudAlpha = prog * 0.85;
      const cloudW     = this.range * (0.7 + 0.6 * dropPhase);
      for (let i = 0; i < 5; i++) {
        const cx2 = x + (i - 2) * cloudW * 0.45;
        const cr  = cloudW * (0.25 + Math.abs(i - 2) * 0.04);
        const cGrd = ctx.createRadialGradient(cx2, cloudY, 0, cx2, cloudY, cr);
        cGrd.addColorStop(0, `rgba(160,255,0,${cloudAlpha * 0.8})`);
        cGrd.addColorStop(0.5, `rgba(80,180,0,${cloudAlpha * 0.5})`);
        cGrd.addColorStop(1, 'rgba(40,100,0,0)');
        ctx.fillStyle = cGrd;
        ctx.beginPath();
        ctx.arc(cx2, cloudY, cr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Impact shockwave ring
      if (dropPhase >= 1) {
        const ringAlpha = 0.75 * (1 - flashPhase);
        const ringR     = this.range * (0.5 + 0.8 * flashPhase);
        ctx.globalAlpha = ringAlpha;
        ctx.shadowColor = '#80ff00';
        ctx.shadowBlur  = 18;
        ctx.strokeStyle = '#aaff44';
        ctx.lineWidth   = 3 * (1 - flashPhase) + 0.5;
        ctx.beginPath();
        ctx.ellipse(x, y, ringR, ringR * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Attack animation: toxic cloud around tower
      if (this.attackAnim > 0) {
        const ap = this.attackAnim;
        const aR = this.range * (0.4 + 0.8 * (1 - ap));
        ctx.globalAlpha = ap * 0.5;
        const aGrd = ctx.createRadialGradient(x, y, 0, x, y, aR);
        aGrd.addColorStop(0, `rgba(150,255,0,${ap * 0.5})`);
        aGrd.addColorStop(0.6, `rgba(80,200,0,${ap * 0.25})`);
        aGrd.addColorStop(1, 'rgba(40,120,0,0)');
        ctx.fillStyle = aGrd;
        ctx.beginPath();
        ctx.arc(x, y, aR, 0, Math.PI * 2);
        ctx.fill();
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
