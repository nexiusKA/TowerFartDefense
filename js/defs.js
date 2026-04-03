// ─────────────────────────────────────────────────────────────────────────────
// TOWER & ENEMY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const TOWER_DEFS = {
  stinker: {
    name: 'Stench Lord', cost: 75, sellRatio: 0.6,
    color: '#27ae60', color2: '#2ecc71',
    range: 75, damage: 6, fireRate: 1200,
    sound: 'stinker',
    upgradeCost: 60,
    upgradeDmg: 4, upgradeRange: 10, upgradeFireRate: -150,
    desc: 'Slows + poisons on hit',
    effect: 'slow',
  },
  blaster: {
    name: 'Fart Bomb', cost: 100, sellRatio: 0.6,
    color: '#e67e22', color2: '#f39c12',
    range: 57, damage: 28, fireRate: 2000,
    sound: 'blaster',
    upgradeCost: 80,
    upgradeDmg: 14, upgradeRange: 7, upgradeFireRate: -300,
    desc: 'AoE explosion on impact',
    effect: 'aoe',
  },
  honker: {
    name: 'Toilet', cost: 125, sellRatio: 0.6,
    color: '#8B4513', color2: '#a0522d',
    range: 100, damage: 16, fireRate: 850,
    sound: 'honker',
    upgradeCost: 100,
    upgradeDmg: 9, upgradeRange: 13, upgradeFireRate: -100,
    desc: 'Shoots poop · Pierces enemies · Sees stealth',
    effect: 'pierce',
  },
  fogger: {
    name: 'Sewer Gas', cost: 110, sellRatio: 0.6,
    color: '#5588cc', color2: '#88bbff',
    range: 65, damage: 9, fireRate: 900,
    sound: 'fogger',
    upgradeCost: 85,
    upgradeDmg: 5, upgradeRange: 10, upgradeFireRate: -120,
    desc: 'Toxic cloud slams down · Hits all in range',
    effect: 'cloud',
  },
  superblast: {
    name: 'Toilet Brush', cost: 200, sellRatio: 0.6,
    color: '#00ccff', color2: '#88eeff',
    range: 115, damage: 50, fireRate: 3000,
    sound: 'superblast',
    upgradeCost: 120,
    upgradeDmg: 20, upgradeRange: 15, upgradeFireRate: -400,
    desc: 'Massive AOE blast · Hits ALL enemies in range',
    effect: 'superblast',
  },
};

const ENEMY_DEFS = {
  basic:   { name: 'Basic Mole',   hp:  80, speed: 1.0, reward: 10, color: '#8B4513', size: 15, armor: 0 },
  fast:    { name: 'Fast Mole',    hp:  45, speed: 2.3, reward:  8, color: '#DAA520', size: 12, armor: 0 },
  tank:    { name: 'Tank Mole',    hp: 300, speed: 0.6, reward: 25, color: '#778899', size: 18, armor: 3 },
  stealth: { name: 'Stealth Mole', hp:  65, speed: 1.6, reward: 18, color: '#9b59b6', size: 13, armor: 0 },
  swarm:   { name: 'Swarm Mole',   hp:  22, speed: 3.2, reward:  4, color: '#e74c3c', size:  9, armor: 0 },
  boss:    { name: 'Master Ninja', hp: 700, speed: 0.8, reward: 90, color: '#c0392b', size: 22, armor: 5 },
};
