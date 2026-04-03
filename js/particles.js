// ─────────────────────────────────────────────────────────────────────────────
// PARTICLES  (all coordinates in logical space)
// ─────────────────────────────────────────────────────────────────────────────
let particles = [];

class Particle {
  constructor(x, y, color, vx, vy, life, size) {
    this.x = x; this.y = y;
    this.color = color;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size;
  }

  update(dt) {
    this.x += this.vx * dt / 16;
    this.y += this.vy * dt / 16;
    this.life -= dt;
    this.vy += 0.04 * dt / 16;   // gentle gravity
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha + 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  get dead() { return this.life <= 0; }
}

function spawnFartCloud(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.5;
    particles.push(new Particle(
      x, y, color,
      Math.cos(angle) * speed, Math.sin(angle) * speed,
      350 + Math.random() * 400,
      3 + Math.random() * 6
    ));
  }
}

function spawnExplosion(x, y) {
  const colors = ['#f39c12', '#e74c3c', '#f1c40f', '#fff', '#e67e22'];
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 5;
    particles.push(new Particle(
      x, y, colors[Math.floor(Math.random() * colors.length)],
      Math.cos(angle) * speed, Math.sin(angle) * speed,
      450 + Math.random() * 350,
      2.5 + Math.random() * 5
    ));
  }
}

function spawnDeathBurst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 3;
    particles.push(new Particle(
      x, y, color,
      Math.cos(angle) * speed, Math.sin(angle) * speed,
      300 + Math.random() * 300,
      3 + Math.random() * 5
    ));
  }
}

function spawnDustTrail(x, y) {
  particles.push(new Particle(
    x + (Math.random() - 0.5) * 8, y + 10,
    '#c8a96e',
    (Math.random() - 0.5) * 0.6, -0.4,
    200, 2.5
  ));
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
