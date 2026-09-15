// This code runs while the HTML is parsed, before application hydration. It
// starts the entrance player independently of the scene.
export const ENTRANCE_AUDIO_BOOTSTRAP = String.raw`
(() => {
  const audio = document.getElementById('paper-entrance-music');
  if (!audio) return;
  let enabled = true;
  try { enabled = localStorage.getItem('paper-sound-muted') !== 'true'; } catch {}
  const start = () => {
    audio.muted = !enabled;
    if (!enabled || document.hidden) { audio.pause(); return; }
    if (!audio.paused || audio.ended) return;
    audio.play().then(() => {
      if (!enabled || document.hidden) audio.pause();
    }).catch(() => {});
  };
  // If the browser denies audible autoplay, retry during normal interaction
  // without adding an entry gate or changing the user's sound preference.
  document.addEventListener('click', start);
  document.addEventListener('keydown', start);
  document.addEventListener('visibilitychange', start);
  window.addEventListener('paper-sound-preference', event => {
    enabled = event.detail === true;
    start();
  });
  start();
})();
`;
