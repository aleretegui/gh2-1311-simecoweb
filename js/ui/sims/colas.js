import { shell, controls, kpis, fmt, pct, table, h } from '../dom.js';
import { makeChart, line, setData, destroyCharts, COLORS } from '../charts.js';
import { createPlayer } from '../player.js';
import { mmc, runSingle, runSeries } from '../../models/queues.js';

const HORIZON = 8; // horas simuladas

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Teoría de colas y cuellos de botella',
    intro: 'Estudia una estación de servicio (M/M/c) con fórmulas y simulación en vivo, o una línea de tres estaciones en serie para encontrar el cuello de botella.',
    observe: 'Cuando la utilización ρ se acerca a 1 la cola crece de forma explosiva, aunque ρ < 1. Con ρ ≥ 1 la cola nunca se estabiliza. En la línea en serie, añadir capacidad fuera del cuello de botella casi no mejora el sistema.',
  });
  const mode = controls([{ key: 'mode', label: 'Modelo', type: 'select', value: 'single', options: [
    { value: 'single', label: 'Estación única M/M/c' }, { value: 'series', label: 'Línea de 3 estaciones en serie' }] }], (v) => build(v.mode));
  const body = h('div', {});
  controlsBox.append(mode.el, body);
  const outBody = h('div', { class: 'outputs' });
  out.append(outBody);
  let stopFn = () => {};
  build('single');

  function build(which) {
    stopFn();
    body.replaceChildren();
    outBody.replaceChildren();
    destroyCharts();
    stopFn = which === 'single' ? single() : series();
  }

  function single() {
    const ctl = controls([
      { key: 'lambda', label: 'Llegadas (λ)', min: 1, max: 200, step: 1, value: 40, unit: 'clientes/h' },
      { key: 'mu', label: 'Servicio por servidor (μ)', min: 1, max: 100, step: 1, value: 15, unit: 'clientes/h' },
      { key: 'c', label: 'Servidores (c)', min: 1, max: 10, step: 1, value: 3 },
      { key: 'capacity', label: 'Capacidad máxima de la cola', min: 0, max: 100, step: 1, value: 0, zeroLabel: 'ilimitada' },
      { key: 'speed', label: 'Velocidad de simulación', min: 1, max: 50, step: 1, value: 10, unit: '×' },
      { key: 'seed', label: 'Semilla', type: 'seed', value: 5 },
    ], update);
    body.append(ctl.el);
    let run = null;
    const warn = h('p', { class: 'notice' });
    const k = kpis();
    const live = kpis();
    const host = h('div', {});
    const chart = makeChart(host, [], { label: 'Longitud de la cola y servidores ocupados en el tiempo', title: 'Cola y servidores ocupados', xTitle: 'Hora', yTitle: 'Clientes' });
    const player = createPlayer(draw, { perSecond: 1, unit: 'paso' });
    outBody.append(warn, k.el, player.el, live.el, host);

    function draw(step) {
      if (!run) return;
      const upTo = Math.max(0, step);
      const s = run.series.slice(0, upTo + 1);
      setData(chart, [
        line('En cola', s.map((p) => ({ x: p.t, y: p.queue })), { color: COLORS[1], stepped: true, fill: true }),
        line('Servidores ocupados', s.map((p) => ({ x: p.t, y: p.busy })), { color: COLORS[0], stepped: true }),
      ]);
      const cur = s[s.length - 1];
      const tNow = cur ? cur.t : 0;
      const seen = run.recs.filter((r) => r.arr <= tNow);
      const waited = seen.length ? seen.reduce((a, r) => a + (r.start - r.arr), 0) / seen.length : 0;
      live.update([
        { label: 'Hora simulada', value: fmt(tNow, 2) + ' h' },
        { label: 'En cola ahora', value: String(cur ? cur.queue : 0) },
        { label: 'Servidores ocupados', value: String(cur ? cur.busy : 0) },
        { label: 'Clientes llegados', value: String(seen.length) },
        { label: 'Espera media observada', value: fmt(waited * 60, 1) + ' min' },
      ]);
    }

    function update(v) {
      const an = mmc(v.lambda, v.mu, v.c);
      run = runSingle({ ...v, capacity: v.capacity === 0 ? Infinity : v.capacity, horizon: HORIZON });
      warn.hidden = an.stable;
      warn.textContent = `ρ = ${fmt(an.rho, 2)} ≥ 1: la demanda supera la capacidad. Las fórmulas no aplican y la cola crece sin límite (en la simulación solo durante ${HORIZON} h).`;
      k.update([
        { label: 'Utilización (ρ)', value: pct(an.rho, 0), tone: an.rho >= 1 ? 'bad' : an.rho > 0.85 ? 'warn' : 'good' },
        { label: 'Prob. de esperar', value: an.stable ? pct(an.pWait, 0) : '—' },
        { label: 'Cola media (Lq)', value: an.stable ? fmt(an.Lq, 2) : '∞', hint: 'fórmula' },
        { label: 'Espera media (Wq)', value: an.stable ? fmt(an.Wq * 60, 1) + ' min' : '∞', hint: 'fórmula' },
        { label: 'Tiempo en sistema (W)', value: an.stable ? fmt(an.W * 60, 1) + ' min' : '∞' },
        { label: 'Simulado: espera media', value: fmt(run.stats.avgWait * 60, 1) + ' min', hint: `${HORIZON} h, ${run.arrivals} llegadas` },
        { label: 'Rechazados (cola llena)', value: String(run.blocked), tone: run.blocked ? 'warn' : '' },
      ]);
      player.setTotal(run.series.length - 1);
      player.setSpeed(v.speed * 3); // 240 pasos = 8 h; 10× = 1 h simulada por segundo
    }
    update(ctl.values);
    return () => player.stop();
  }

  function series() {
    const ctl = controls([
      { key: 'lambda', label: 'Llegadas (λ)', min: 1, max: 100, step: 1, value: 30, unit: 'clientes/h' },
      { type: 'heading', label: 'Estación 1' },
      { key: 'mu1', label: 'μ por servidor', min: 1, max: 60, step: 1, value: 20 },
      { key: 'c1', label: 'Servidores', min: 1, max: 8, step: 1, value: 2 },
      { type: 'heading', label: 'Estación 2' },
      { key: 'mu2', label: 'μ por servidor', min: 1, max: 60, step: 1, value: 8 },
      { key: 'c2', label: 'Servidores', min: 1, max: 8, step: 1, value: 4 },
      { type: 'heading', label: 'Estación 3' },
      { key: 'mu3', label: 'μ por servidor', min: 1, max: 60, step: 1, value: 18 },
      { key: 'c3', label: 'Servidores', min: 1, max: 8, step: 1, value: 2 },
      { key: 'seed', label: 'Semilla', type: 'seed', value: 5 },
    ], update);
    body.append(ctl.el);
    const msg = h('p', { class: 'notice' });
    const k = kpis();
    const tbl = h('div', {});
    const actions = h('div', { class: 'actions' });
    const host = h('div', {});
    const chart = makeChart(host, [], { label: 'Cola de cada estación en el tiempo', title: 'Clientes en cola por estación', xTitle: 'Hora', yTitle: 'Clientes en cola' });
    outBody.append(msg, k.el, tbl, actions, host);

    const addTo = (i) => { ctl.set('c' + (i + 1), Math.min(8, ctl.values['c' + (i + 1)] + 1)); update(ctl.values); };
    let bn = 0, other = 0;

    function update(v) {
      const st = [1, 2, 3].map((i) => ({ mu: v['mu' + i], c: v['c' + i] }));
      const r = runSeries({ lambda: v.lambda, stations: st, horizon: HORIZON, seed: v.seed });
      const rho = r.results.map((x) => x.rhoTheory);
      bn = rho.indexOf(Math.max(...rho));
      other = rho.indexOf(Math.min(...rho));
      const cap = Math.min(...st.map((s) => s.mu * s.c));
      msg.hidden = false;
      msg.textContent = `Cuello de botella: Estación ${bn + 1} (ρ = ${fmt(rho[bn], 2)}). Capacidad del sistema ≈ ${fmt(cap, 0)} clientes/h frente a ${v.lambda} que llegan.` + (rho[bn] >= 1 ? ' Está saturada: la cola crece sin límite.' : '');
      k.update([
        { label: 'Llegadas', value: String(r.entered), hint: `en ${HORIZON} h` },
        { label: 'Clientes que terminaron', value: String(r.finished), tone: r.finished < r.entered * 0.9 ? 'warn' : 'good' },
        { label: 'Rendimiento', value: fmt(r.throughput, 1) + '/h' },
        { label: 'Capacidad del sistema', value: fmt(cap, 0) + '/h' },
      ]);
      tbl.replaceChildren(table(['Estación', 'Servidores × μ', 'Utilización teórica', 'Espera media', 'Cola máxima'],
        r.results.map((x, i) => ({ highlight: i === bn, cells: ['Estación ' + (i + 1) + (i === bn ? ' ⚠ cuello' : ''), `${st[i].c} × ${st[i].mu}`, pct(x.rhoTheory, 0), fmt(x.avgWait * 60, 1) + ' min', String(x.maxQueue)] })), 'Resultados por estación'));
      actions.replaceChildren(
        h('button', { type: 'button', onclick: () => addTo(bn) }, `+1 servidor a la estación ${bn + 1} (cuello)`),
        h('button', { type: 'button', class: 'secondary', onclick: () => addTo(other) }, `+1 servidor a la estación ${other + 1} (menos usada)`),
      );
      setData(chart, r.results.map((x, i) => line('Estación ' + (i + 1), x.series.map((p) => ({ x: p.t, y: p.queue })), { color: COLORS[i], stepped: true, width: i === bn ? 3 : 1.5 })));
    }
    update(ctl.values);
    return () => {};
  }
  return () => stopFn();
}
