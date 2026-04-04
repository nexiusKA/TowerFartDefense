// ─────────────────────────────────────────────────────────────────────────────
// WAVE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// Rotating stinky wave-start messages
const WAVE_START_MSGS = [
  (n, total) => `💨 Wave ${n} — ${total} stinky moles incoming!`,
  (n, total) => `🤢 Sniff that? Wave ${n}: ${total} moles on the move!`,
  (n, total) => `👃 YIKES — Wave ${n}! ${total} moles breaching the sewers!`,
  (n, total) => `💩 Wave ${n} — ${total} moles raring to stink up your base!`,
  (n, total) => `☠️ The sewers bubble… Wave ${n} is here! ${total} enemies!`,
  (n, total) => `🌊 Wave ${n} incoming! Hold your nose — ${total} moles!`,
];

const BOSS_WAVE_MSGS = [
  (n) => `💀 BOSS WAVE ${n}! The Grand Stench Lord himself approaches! 💀`,
  (n) => `💀 BOSS WAVE ${n}! Maximum stink inbound — brace yourselves! 💀`,
  (n) => `☠️ BOSS WAVE ${n}! Absolutely rancid power incoming! ☠️`,
];


// hp scale grows 8 % per wave so enemies get progressively tougher.
function buildWave(w) {
  const hpScale   = Math.pow(1.08, w - 1);
  const entries   = [];

  // Boss every 5 waves; extra boss per 10 waves for extra chaos
  if (w % 5 === 0 && w > 0) {
    const bossCount = 1 + Math.floor(w / 10);
    entries.push({ type: 'boss', count: bossCount, interval: 2000, hpScale });
  }

  // Increased enemy counts to fill the bigger map
  const basic   = 5 + w * 3;
  const fast    = w >= 2 ? 2 + Math.floor(w * 1.3) : 0;
  const tank    = w >= 3 ? Math.floor(w * 0.7)      : 0;
  const stealth = w >= 4 ? Math.floor(w * 0.6)      : 0;
  const swarm   = w >= 5 ? Math.floor((w - 4) * 2.5) : 0;

  entries.push({ type: 'basic', count: basic, interval: Math.max(500, 1100 - w * 25), hpScale });
  if (fast)    entries.push({ type: 'fast',    count: fast,    interval: Math.max(300, 850 - w * 18), hpScale });
  if (tank)    entries.push({ type: 'tank',    count: tank,    interval: Math.max(700, 1600 - w * 35), hpScale });
  if (stealth) entries.push({ type: 'stealth', count: stealth, interval: Math.max(400, 950 - w * 22), hpScale });
  if (swarm)   entries.push({ type: 'swarm',   count: swarm,   interval: Math.max(100, 300 - w * 12), hpScale: 1 }); // swarms stay fragile by design

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
    this.waveNum      = 0;
    this.spawnQueue   = [];
    this.spawnTimer   = 0;
    this.active       = false;
    this.bonusGiven   = false;
    this.totalInWave  = 0;       // total enemies spawned at wave start
    this.waveComposition = {};   // { type: count } breakdown for UI
  }

  get totalQueued() { return this.spawnQueue.length; }

  startWave() {
    this.waveNum++;
    this.spawnQueue = buildWave(this.waveNum);
    this.totalInWave = this.spawnQueue.length;

    // Compute composition breakdown for the wave info HUD
    this.waveComposition = {};
    for (const e of this.spawnQueue) {
      this.waveComposition[e.type] = (this.waveComposition[e.type] || 0) + 1;
    }

    this.spawnTimer = 0;
    this.active     = true;
    this.bonusGiven = false;
    document.getElementById('btnNextWave').disabled = true;
    const isBossWave = this.waveNum % 5 === 0 && this.waveNum > 0;
    if (isBossWave) {
      const bossMsgs = BOSS_WAVE_MSGS;
      showMessage(bossMsgs[Math.floor(this.waveNum / 5 - 1) % bossMsgs.length](this.waveNum));
    } else {
      const msgs = WAVE_START_MSGS;
      showMessage(msgs[(this.waveNum - 1) % msgs.length](this.waveNum, this.totalInWave));
    }
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
