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

// Boot
const game = new Game();
