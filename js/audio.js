// ─────────────────────────────────────────────────────────────────────────────
// AUDIO
// ─────────────────────────────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
const customSounds = { stinker: null, blaster: null, honker: null, fogger: null, superblast: null };

// Default fart sounds mapped to each tower type
const DEFAULT_SOUNDS = {
  stinker: 'voice_09-03-2026_01-07-01.mp3',
  blaster: 'voice_28-03-2026_13-55-38.mp3',
  honker:  'voice_28-03-2026_13-59-31.mp3',
  fogger:  'voice_28-03-2026_14-05-59.mp3',
  superblast: 'super_blast.mp3',
};
const defaultSounds = { stinker: null, blaster: null, honker: null, fogger: null, superblast: null };
// Duration (ms) of the active sound for each tower type; null = use def.fireRate
const soundDurations = { stinker: null, blaster: null, honker: null, fogger: null, superblast: null };

function loadDefaultSounds() {
  Object.entries(DEFAULT_SOUNDS).forEach(([type, file]) => {
    const audio = new Audio(file);
    audio.volume = 0.4;
    audio.addEventListener('error', () => { defaultSounds[type] = null; });
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        soundDurations[type] = Math.round(audio.duration * 1000);
      }
    });
    defaultSounds[type] = audio;
  });
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playFallbackSound(type) {
  try {
    const ctx = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'stinker') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(); osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'blaster') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'honker') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'superblast') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(18, ctx.currentTime + 0.7);
      gain.gain.setValueAtTime(0.38, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
      osc.start(); osc.stop(ctx.currentTime + 0.75);
    }
  } catch (_) {}
}

function playSound(type) {
  const snd = customSounds[type] || defaultSounds[type];
  if (snd) {
    snd.currentTime = 0;
    snd.play().catch(() => {});
  } else {
    playFallbackSound(type);
  }
}

function initAudioFileInputs() {
  ['stinker', 'blaster', 'honker', 'fogger', 'superblast'].forEach(t => {
    const el = document.getElementById('audio' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!el) return;
    el.addEventListener('change', function () {
      if (this.files[0]) {
        const audio = new Audio(URL.createObjectURL(this.files[0]));
        audio.volume = 0.4;
        audio.addEventListener('loadedmetadata', () => {
          if (audio.duration && isFinite(audio.duration)) {
            soundDurations[t] = Math.round(audio.duration * 1000);
          }
        });
        customSounds[t] = audio;
      }
    });
  });
}
