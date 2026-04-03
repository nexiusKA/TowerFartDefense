// ─────────────────────────────────────────────────────────────────────────────
// PARTICLES  (all coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
let particles = [];

// ── Screen shake (read by Game._render) ───────────────────────────────────
let screenShake = 0;
function addScreenShake(amt) { screenShake = Math.max(screenShake, amt); }

// ── Base particle ─────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, color, vx, vy, life, size, type = 'circle') {
    this.x = x; this.y = y;
    this.color  = color;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size  = size;
    this.type  = type;
    this.wobble      = Math.random() * Math.PI * 2;
    this.wobbleSpeed = (Math.random() - 0.5) * 0.09;
    this.rotation    = Math.random() * Math.PI * 2;
    this.rotSpeed    = (Math.random() - 0.5) * 0.07;
  }

  update(dt) {
    this.x += this.vx * dt / 16;
    this.y += this.vy * dt / 16;
    this.life -= dt;

    if (this.type === 'gas') {
      this.vy   -= 0.015 * dt / 16;           // gas rises
      this.vx   += Math.sin(this.wobble) * 0.018;
      this.wobble += this.wobbleSpeed * dt / 16;
    } else if (this.type === 'smoke') {
      this.vy -= 0.018 * dt / 16;
      this.vx *= Math.pow(0.992, dt / 16);
    } else {
      this.vy += 0.04 * dt / 16;              // gentle gravity
    }
    this.rotation += this.rotSpeed * dt / 16;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === 'gas') {
      const r = this.size * alpha + 1;
      const grd = ctx.createRadialGradient(this.x - r * 0.2, this.y - r * 0.2, 0, this.x, this.y, r * 1.4);
      grd.addColorStop(0, this.color + 'cc');
      grd.addColorStop(0.5, this.color + '66');
      grd.addColorStop(1,   this.color + '00');
      ctx.fillStyle = grd;
      const wAmt = Math.sin(this.wobble) * 0.28;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(1 + wAmt * 0.3, 1 - wAmt * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else if (this.type === 'smoke') {
      const r = this.size * (2 - alpha) * 0.65 + 2;
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
      grd.addColorStop(0, `rgba(160,160,160,${alpha * 0.28})`);
      grd.addColorStop(1, 'rgba(80,80,80,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'spark') {
      ctx.fillStyle = this.color;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.vy, this.vx));
      const len = this.size * 3.2 * alpha;
      ctx.fillRect(-len, -1.5, len * 2, 3);
      ctx.restore();

    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  get dead() { return this.life <= 0; }
}

// ── Rising stink squiggle ─────────────────────────────────────────────────
class StinkLine {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    this.color   = color;
    this.life    = 700 + Math.random() * 550;
    this.maxLife = this.life;
    this.vy      = -(0.28 + Math.random() * 0.45);
    this.phase   = Math.random() * Math.PI * 2;
    this.amp     = 2.5 + Math.random() * 3.5;
    this.len     = 9 + Math.random() * 10;
  }

  update(dt) {
    this.y    += this.vy * dt / 16;
    this.life -= dt;
    this.phase += 0.003 * dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife) * 0.65;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    for (let i = 0; i <= this.len; i++) {
      const px = this.x + Math.sin(this.phase + i * 0.55) * this.amp;
      const py = this.y - i;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  get dead() { return this.life <= 0; }
}

// ── Spawn helpers ──────────────────────────────────────────────────────────

function spawnFartCloud(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 2.0;
    particles.push(new Particle(
      x + (Math.random() - 0.5) * 8,
      y + (Math.random() - 0.5) * 8,
      color,
      Math.cos(angle) * speed * 0.6,
      Math.sin(angle) * speed - 0.5,
      500 + Math.random() * 600,
      4 + Math.random() * 9,
      'gas'
    ));
  }
  // stink squiggles
  const squigCount = Math.max(1, Math.floor(count / 4));
  for (let i = 0; i < squigCount; i++) {
    particles.push(new StinkLine(x + (Math.random() - 0.5) * 18, y, color));
  }
}

function spawnExplosion(x, y) {
  addScreenShake(8);
  const colors = ['#c8a020', '#8a5010', '#cddc39', '#8dc829', '#aacc00', '#ffee44'];
  // Gas burst puffs — large stink cloud
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 3.5;
    particles.push(new Particle(
      x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 16,
      colors[Math.floor(Math.random() * colors.length)],
      Math.cos(angle) * speed, Math.sin(angle) * speed - 0.4,
      500 + Math.random() * 500, 5 + Math.random() * 9, 'gas'
    ));
  }
  // Stink smoke
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(
      x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 24,
      '#888',
      Math.cos(angle) * 0.4, Math.sin(angle) * 0.4 - 0.7,
      700 + Math.random() * 400, 7 + Math.random() * 8, 'smoke'
    ));
  }
  // Stink lines burst
  for (let i = 0; i < 6; i++) {
    particles.push(new StinkLine(
      x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20,
      colors[Math.floor(Math.random() * colors.length)]
    ));
  }
}

function spawnDeathBurst(x, y, color) {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 3.2;
    particles.push(new Particle(
      x, y, color,
      Math.cos(angle) * speed, Math.sin(angle) * speed,
      320 + Math.random() * 360,
      3 + Math.random() * 6,
      i % 3 === 0 ? 'gas' : 'circle'
    ));
  }
  for (let i = 0; i < 4; i++) {
    particles.push(new StinkLine(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, color));
  }
}

function spawnMetalImpact(x, y, range) {
  addScreenShake(5);
  const gasColors = ['#aaff44', '#80cc00', '#cddc39', '#8dc829', '#66ff00'];
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 3.5;
    particles.push(new Particle(
      x + (Math.random() - 0.5) * range * 0.7,
      y + (Math.random() - 0.5) * 12,
      gasColors[Math.floor(Math.random() * gasColors.length)],
      Math.cos(angle) * speed, Math.sin(angle) * speed - 0.6,
      350 + Math.random() * 300, 3 + Math.random() * 5, 'gas'
    ));
  }
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(
      x + (Math.random() - 0.5) * range * 0.5, y,
      '#88cc44',
      Math.cos(angle) * 0.5, Math.sin(angle) * 0.5,
      400 + Math.random() * 250, 4 + Math.random() * 5, 'circle'
    ));
  }
}

// Spawns a toxic green fart cloud slam effect for the Fogger tower's area attack.
// Replaces the old spawnMetalImpact with an organic gas cloud ring + stink lines.
function spawnFartCloudSlam(x, y, range) {
  addScreenShake(6);
  const cloudColors = ['#aaff44', '#80cc00', '#cddc39', '#8dc829', '#66ee22', '#bbff00'];
  // Big expanding fart cloud ring
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 1.0 + Math.random() * 3.0;
    const dist  = range * (0.3 + Math.random() * 0.7);
    particles.push(new Particle(
      x + Math.cos(angle) * dist * 0.4, y + Math.sin(angle) * dist * 0.12,
      cloudColors[Math.floor(Math.random() * cloudColors.length)],
      Math.cos(angle) * speed, Math.sin(angle) * speed * 0.3 - 0.5,
      500 + Math.random() * 500, 5 + Math.random() * 10, 'gas'
    ));
  }
  // Stink lines
  for (let i = 0; i < 8; i++) {
    particles.push(new StinkLine(
      x + (Math.random() - 0.5) * range,
      y + (Math.random() - 0.5) * range * 0.3,
      cloudColors[Math.floor(Math.random() * cloudColors.length)]
    ));
  }
}

function spawnDustTrail(x, y) {
  particles.push(new Particle(
    x + (Math.random() - 0.5) * 10, y + 10,
    '#c8a96e',
    (Math.random() - 0.5) * 0.5, -0.3,
    260, 2.5, 'smoke'
  ));
}

function spawnAmbientWisp(x, y, color) {
  particles.push(new Particle(
    x + (Math.random() - 0.5) * 22, y,
    color,
    (Math.random() - 0.5) * 0.3, -(0.18 + Math.random() * 0.38),
    900 + Math.random() * 650,
    2 + Math.random() * 4.5,
    'gas'
  ));
  if (Math.random() < 0.35) {
    particles.push(new StinkLine(x + (Math.random() - 0.5) * 12, y, color));
  }
}

function spawnStinkLines(x, y, color, count = 4) {
  for (let i = 0; i < count; i++) {
    particles.push(new StinkLine(
      x + (Math.random() - 0.5) * 22,
      y + (Math.random() - 0.5) * 10,
      color
    ));
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (particles[i].dead) particles.splice(i, 1);
  }
}

function drawParticles(ctx) {
  for (const p of particles) p.draw(ctx);
}
