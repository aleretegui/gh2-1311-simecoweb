import { shell, controls, fmt, pct, table, h } from '../dom.js';
import { makeChart, line, setData, setScale, COLORS } from '../charts.js';
import { createPlayer } from '../player.js';
import { genDemand, policies, simulatePolicy } from '../../models/reviewSystems.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Sistemas de revisión: continuo vs. periódico',
    intro: 'Ambos sistemas enfrentan exactamente la misma demanda. El continuo revisa cada día y pide Q al llegar a R; el periódico revisa cada T días y completa hasta S.',
    observe: 'El sistema periódico necesita más stock de seguridad porque debe cubrir T + L días, no solo L. A cambio hace menos revisiones. Compara el costo total variando T, el costo de pedido y el de faltante.',
  });
  const ctl = controls([
    { key: 'dMean', label: 'Demanda diaria media', min: 5, max: 200, step: 1, value: 50, unit: 'u' },
    { key: 'dStd', label: 'Desviación diaria', min: 0, max: 60, step: 1, value: 15, unit: 'u' },
    { key: 'L', label: 'Plazo de entrega (L)', min: 1, max: 30, step: 1, value: 7, unit: 'días' },
    { key: 'T', label: 'Periodo de revisión (T)', min: 1, max: 30, step: 1, value: 7, unit: 'días' },
    { key: 'service', label: 'Nivel de servicio', min: 80, max: 99.9, step: 0.1, value: 95, unit: '%' },
    { key: 'Q', label: 'Lote del sistema continuo (Q)', min: 50, max: 2000, step: 10, value: 400, unit: 'u' },
    { type: 'heading', label: 'Costos' },
    { key: 'K', label: 'Costo por pedido', min: 5, max: 500, step: 5, value: 50, unit: 'USD' },
    { key: 'H', label: 'Costo de mantener (por u y año)', min: 0.5, max: 50, step: 0.5, value: 5, unit: 'USD' },
    { key: 'pen', label: 'Costo por unidad faltante', min: 0, max: 100, step: 1, value: 10, unit: 'USD' },
    { type: 'heading', label: 'Simulación' },
    { key: 'days', label: 'Días a simular', min: 60, max: 365, step: 5, value: 180 },
    { key: 'seed', label: 'Semilla', type: 'seed', value: 7 },
  ], update);
  controlsBox.append(ctl.el);

  let res = null;
  const tableHost = h('div', {});
  const charts = h('div', { class: 'two-col' });
  const cC = makeChart(charts, [], { label: 'Inventario con revisión continua', title: 'Continuo (Q, R)', xTitle: 'Día', yTitle: 'Unidades' });
  const cP = makeChart(charts, [], { label: 'Inventario con revisión periódica', title: 'Periódico (T, S)', xTitle: 'Día', yTitle: 'Unidades' });
  const player = createPlayer(draw, { perSecond: 30, unit: 'día' });
  out.append(tableHost, player.el, charts);

  function draw(upTo) {
    if (!res) return;
    const pts = (r) => r.series.slice(0, upTo).map((s) => ({ x: s.day, y: s.onHand }));
    const n = res.c.series.length;
    setData(cC, [line('Inventario', pts(res.c), { color: COLORS[0], stepped: true }), line('R (punto de reorden)', [{ x: 1, y: res.pol.continuous.R }, { x: n, y: res.pol.continuous.R }], { color: COLORS[3], dashed: true })]);
    setData(cP, [line('Inventario', pts(res.p), { color: COLORS[2], stepped: true }), line('S (nivel objetivo)', [{ x: 1, y: res.pol.periodic.S }, { x: n, y: res.pol.periodic.S }], { color: COLORS[3], dashed: true })]);
    for (const c of [cC, cP]) setScale(c, 'y', { min: 0, max: res.yMax });
  }

  function update(v) {
    const pol = policies({ ...v, service: v.service / 100 });
    const demand = genDemand({ dMean: v.dMean, dStd: v.dStd, days: v.days, seed: v.seed });
    const cost = { L: v.L, K: v.K, H: v.H, pen: v.pen };
    const c = simulatePolicy('continuous', { ...pol.continuous, ...cost }, demand);
    const p = simulatePolicy('periodic', { ...pol.periodic, ...cost }, demand);
    const yMax = Math.ceil(Math.max(...c.series.map((s) => s.onHand), ...p.series.map((s) => s.onHand)) * 1.05);
    res = { pol, c, p, yMax };
    const best = c.totalCost <= p.totalCost ? 'continuo' : 'periódico';
    const row = (name, a, b, f) => [name, f(a), f(b)];
    tableHost.replaceChildren(
      table(['Indicador', 'Continuo (Q, R)', 'Periódico (T, S)'], [
        ['Parámetros', `R = ${fmt(pol.continuous.R, 0)}, Q = ${fmt(v.Q, 0)}`, `T = ${v.T}, S = ${fmt(pol.periodic.S, 0)}`],
        row('Stock de seguridad', pol.continuous.ss, pol.periodic.ss, (x) => fmt(x, 0) + ' u'),
        row('Inventario promedio', c.avgInv, p.avgInv, (x) => fmt(x, 0) + ' u'),
        row('Pedidos emitidos', c.nOrders, p.nOrders, (x) => String(x)),
        row('Unidades faltantes', c.lost, p.lost, (x) => fmt(x, 0)),
        row('Tasa de cumplimiento', c.fillRate, p.fillRate, (x) => pct(x, 2)),
        row('Costo de pedir', c.orderCost, p.orderCost, (x) => '$' + fmt(x, 0)),
        row('Costo de mantener', c.holdCost, p.holdCost, (x) => '$' + fmt(x, 0)),
        row('Costo de faltantes', c.stockoutCost, p.stockoutCost, (x) => '$' + fmt(x, 0)),
        { cells: ['Costo total', '$' + fmt(c.totalCost, 0), '$' + fmt(p.totalCost, 0)], highlight: false },
      ], 'Resultados con la misma demanda (se excluye un periodo inicial de calentamiento)'),
      h('p', { class: 'notice good' }, `Con estos parámetros el sistema ${best} tiene el menor costo total.`),
    );
    player.setTotal(v.days);
  }
  update(ctl.values);
  return () => player.stop();
}
