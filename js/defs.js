// ─────────────────────────────────────────────────────────────────────────────
// TOWER & ENEMY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const TOWER_DEFS = {
  stinker: {
    name: 'Stinker', cost: 75, sellRatio: 0.6,
    color: '#27ae60', color2: '#2ecc71',
    range: 110, damage: 6, fireRate: 1200,
    sound: 'stinker',
    upgradeCost: 60,
    upgradeDmg: 4, upgradeRange: 15, upgradeFireRate: -150,
    desc: 'Slows + poisons on hit',
    effect: 'slow',
  },
  blaster: {
    name: 'Blaster', cost: 100, sellRatio: 0.6,
    color: '#e67e22', color2: '#f39c12',
    range: 85, damage: 28, fireRate: 2000,
    sound: 'blaster',
    upgradeCost: 80,
    upgradeDmg: 14, upgradeRange: 10, upgradeFireRate: -300,
    desc: 'AoE explosion on impact',
    effect: 'aoe',
  },
  honker: {
    name: 'Honker', cost: 125, sellRatio: 0.6,
    color: '#2980b9', color2: '#3498db',
    range: 150, damage: 16, fireRate: 850,
    sound: 'honker',
    upgradeCost: 100,
    upgradeDmg: 9, upgradeRange: 20, upgradeFireRate: -100,
    desc: 'Pierces enemies · Sees stealth',
    effect: 'pierce',
  },
  fogger: {
    name: 'Crusher', cost: 110, sellRatio: 0.6,
    color: '#5588cc', color2: '#88bbff',
    range: 95, damage: 9, fireRate: 900,
    sound: 'stinker',
    upgradeCost: 85,
    upgradeDmg: 5, upgradeRange: 15, upgradeFireRate: -120,
    desc: 'Metal bar slams down · Hits all in range',
    effect: 'cloud',
  },
};

const ENEMY_DEFS = {
  basic:   { name: 'Basic Mole',   hp:  80, speed: 1.0, reward: 10, color: '#8B4513', size: 22, armor: 0 },
  fast:    { name: 'Fast Mole',    hp:  45, speed: 2.3, reward:  8, color: '#DAA520', size: 18, armor: 0 },
  tank:    { name: 'Tank Mole',    hp: 300, speed: 0.6, reward: 25, color: '#778899', size: 27, armor: 3 },
  stealth: { name: 'Stealth Mole', hp:  65, speed: 1.6, reward: 18, color: '#9b59b6', size: 20, armor: 0 },
  swarm:   { name: 'Swarm Mole',   hp:  22, speed: 3.2, reward:  4, color: '#e74c3c', size: 13, armor: 0 },
  boss:    { name: 'Master Ninja', hp: 700, speed: 0.8, reward: 90, color: '#c0392b', size: 33, armor: 5 },
};
