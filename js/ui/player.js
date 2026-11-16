// Controles Ejecutar / Pausar / Reiniciar para simulaciones que avanzan en el tiempo.
import { h } from './dom.js';

// onFrame(upTo): se llama con el número de pasos visibles. perSecond: pasos por segundo.
export function createPlayer(onFrame, { perSecond = 30, unit = 'día' } = {}) {
  let total = 0;
  let current = 0;
  let raf = null;
  let last = 0;
  const label = h('span', { class: 'player-label', 'aria-live': 'off' });
  const bRun = h('button', { type: 'button', onclick: () => run() }, 'Ejecutar');
  const bPause = h('button', { type: 'button', class: 'secondary', onclick: () => pause() }, 'Pausar');
  const bReset = h('button', { type: 'button', class: 'secondary outline', onclick: () => reset() }, 'Reiniciar');
  const el = h('div', { class: 'player', role: 'group', 'aria-label': 'Reproducción' }, bRun, bPause, bReset, label);

  const show = () => {
    label.textContent = `${unit} ${Math.round(current)} / ${total}`;
    onFrame(Math.round(current));
  };
  const tick = (now) => {
    current = Math.min(total, current + ((now - last) / 1000) * perSecond);
    last = now;
    show();
    raf = current < total ? requestAnimationFrame(tick) : null;
  };
  function run() {
    if (raf) return;
    if (current >= total) current = 0;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }
  function reset() {
    pause();
    current = 0;
    show();
  }
  return {
    el,
    // Nuevo total (por cambio de parámetros): muestra la simulación completa.
    setTotal(n) {
      pause();
      total = n;
      current = n;
      show();
    },
    setSpeed(n) {
      perSecond = n;
    },
    stop: pause,
  };
}
