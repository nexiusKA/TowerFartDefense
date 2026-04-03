// ─────────────────────────────────────────────────────────────────────────────
// WAVE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Build a flat spawn queue for wave number w.
// hp scale grows 8 % per wave so enemies get progressively tougher.
function buildWave(w) {
  const hpScale   = Math.pow(1.08, w - 1);
  const entries   = [];

  // Boss every 5 waves
  if (w % 5 === 0 && w > 0) {
    entries.push({ type: 'boss', count: 1, interval: 2000, hpScale });
  }

  const basic   = 3 + w * 2;
  const fast    = w >= 2 ? 1 + Math.floor(w * 0.9) : 0;
  const tank    = w >= 3 ? Math.floor(w * 0.5)      : 0;
  const stealth = w >= 4 ? Math.floor(w * 0.4)      : 0;
  const swarm   = w >= 5 ? Math.floor((w - 4) * 1.8): 0;

  entries.push({ type: 'basic', count: basic, interval: Math.max(550, 1200 - w * 30), hpScale });
  if (fast)    entries.push({ type: 'fast',    count: fast,    interval: Math.max(350, 900 - w * 20), hpScale });
  if (tank)    entries.push({ type: 'tank',    count: tank,    interval: Math.max(750, 1800 - w * 40), hpScale });
  if (stealth) entries.push({ type: 'stealth', count: stealth, interval: Math.max(450, 1000 - w * 25), hpScale });
  if (swarm)   entries.push({ type: 'swarm',   count: swarm,   interval: Math.max(120, 350 - w * 15), hpScale: 1 });

  // Flatten into individual spawn entries
  const queue = [];
  for (const group of entries) {
    for (let i = 0; i < group.count; i++) {
      queue.push({ type: group.type, delay: group.interval, hpScale: group.hpScale });
    }
  }
  return queue;
}

class WaveManager {
  constructor() {
    this.waveNum   = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.active     = false;
    this.bonusGiven = false;
  }

  get totalQueued() { return this.spawnQueue.length; }

  startWave() {
    this.waveNum++;
    this.spawnQueue = buildWave(this.waveNum);
    this.spawnTimer = 0;
    this.active     = true;
    this.bonusGiven = false;
    document.getElementById('btnNextWave').disabled = true;
    showMessage(`🌊 Wave ${this.waveNum} incoming!`);
    game.updateUI();
  }

  update(dt) {
    if (!this.active || this.spawnQueue.length === 0) return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnQueue[0].delay) {
      this.spawnTimer = 0;
      const entry = this.spawnQueue.shift();
      game.enemies.push(new Enemy(entry.type, entry.hpScale));
      if (this.spawnQueue.length === 0) this.active = false;
    }
  }

  // True when spawning finished AND all enemies are gone
  get waveComplete() {
    return !this.active && game.enemies.every(e => e.dead || e.reached);
  }
}
