// ─────────────────────────────────────────────────────────────────────────────
// HELPERS & ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

let msgTimeout = null;
function showMessage(text) {
  const box = document.getElementById('msgBox');
  box.textContent = text;
  box.style.opacity = '1';
  clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => { box.style.opacity = '0'; }, 2500);
}

// Wire up custom audio file inputs
initAudioFileInputs();
loadDefaultSounds();

// Boot
const game = new Game();

// ── Generate Map button (title screen) ────────────────────────────────────────
document.getElementById('btnGenerateMap').addEventListener('click', () => {
  game.regenerateMap();
  // Make overlay semi-transparent so the new map is visible behind it
  document.getElementById('overlay').classList.add('map-preview');
  document.getElementById('mapGenHint').textContent = '💩 New map generated! Click again for another layout.';
});
