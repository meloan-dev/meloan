import { createSfx } from './sfx.js';

export function createStorySound(loader = window.__loader) {
  const button = document.getElementById('sound');
  const sfx = createSfx({ onStateChange: showSound });
  function showSound() {
    const ready = sfx.enabled && sfx.running;
    const label = !sfx.enabled ? 'Sound off' : ready ? 'Sound on' : 'Tap for sound';
    button.setAttribute('aria-pressed', String(ready));
    button.setAttribute('aria-label', label);
    button.title = ready ? 'Turn sound effects off' : 'Turn sound effects on';
    button.querySelector('span').textContent = label;
  }
  showSound();
  button.addEventListener('click', () => {
    // A pending/paused button activates audio; it must not accidentally mute it.
    const on = !(sfx.enabled && sfx.running);
    sfx.setEnabled(on);
    if (on) sfx.playWhenReady('tick');
    try { localStorage.setItem('meloan-sound', on ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
  });
  for (const event of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend']) {
    addEventListener(event, e => {
      // Let the button handle its entire gesture, including pointerdown before click.
      if (!button.contains(e.target)) sfx.unlock();
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => sfx.suspend(document.hidden));
  addEventListener('pageshow', () => sfx.suspend(document.hidden));
  if (loader) {
    loader.onLaunch(({ sound, late }) => {
      sfx.setEnabled(sound);
      if (sound && !late) sfx.playWhenReady('plunge');
    });
  } else {
    let sound = true;
    try { sound = localStorage.getItem('meloan-sound') !== 'off'; } catch (e) { /* storage unavailable */ }
    sfx.setEnabled(sound);
  }
  return sfx;
}
