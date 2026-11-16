import { shell, controls, kpis, fmt, pct, h } from '../dom.js';
import { makeChart, line, marks, setData, COLORS } from '../charts.js';
import { createPlayer } from '../player.js';
import { simulate } from '../../models/reorderPoint.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Punto de reorden con demanda variable',
    intro: 'Con demanda incierta, el punto de reorden incluye un stock de seguridad que depende del nivel de servicio y de la variabilidad.',
    observe: 'Sube el nivel de servicio y verás más stock de seguridad y menos faltantes, pero un inventario promedio mayor. Aumenta la desviación o el plazo y el stock de seguridad crece. El nivel de servicio real fluctúa con la semilla: prueba varias.',
  });
  const ctl = controls([
    { key: 'dMean', label: 'Demanda diaria media', min: 5, max: 200, step: 1, value: 50, unit: 'u' },
    { key: 'dStd', label: 'Desviación diaria', min: 0, max: 60, step: 1, value: 15, unit: 'u' },
    { key: 'L', label: 'Plazo de entrega', min: 1, max: 30, step: 1, value: 7, unit: 'días' },
    { key: 'service', label: 'Nivel de servicio', min: 80, max: 99.9, step: 0.1, value: 95, unit: '%' },
    { key: 'Q', label: 'Cantidad de pedido (Q)', min: 50, max: 2000, step: 10, value: 400, unit: 'u' },
    { key: 'days', label: 'Días a simular', min: 30, max: 365, step: 5, value: 120 },
    { key: 'seed', label: 'Semilla', type: 'seed', value: 42 },
  ], update);
  controlsBox.append(ctl.el);

  let res = null;
  const k = kpis();
  const chartHost = h('div', {});
  const chart = makeChart(chartHost, [], { label: 'Inventario disponible, punto de reorden, pedidos y faltantes', title: 'Inventario disponible', xTitle: 'Día', yTitle: 'Unidades' });
  const player = createPlayer(draw, { perSecond: 30, unit: 'día' });
  out.append(k.el, player.el, chartHost);

  function draw(upTo) {
    if (!res) return;
    const s = res.series.slice(0, upTo);
    setData(chart, [
      line('Inventario disponible', s.map((r) => ({ x: r.day, y: r.onHand })), { color: COLORS[0], stepped: true }),
      line('Punto de reorden', [{ x: 1, y: res.rop }, { x: res.series.length, y: res.rop }], { color: COLORS[3], dashed: true }),
      marks('Pedido emitido', res.orders.filter((o) => o.day <= upTo).map((o) => ({ x: o.day, y: res.rop })), COLORS[2], 5),
      marks('Faltante', res.stockoutDays.filter((d) => d <= upTo).map((d) => ({ x: d, y: 0 })), COLORS[1], 6),
    ]);
  }

  function update(v) {
    res = simulate({ ...v, service: v.service / 100 });
    k.update([
      { label: 'Punto de reorden', value: fmt(res.rop, 0) + ' u' },
      { label: 'Stock de seguridad', value: fmt(res.ss, 0) + ' u', hint: 'z = ' + fmt(res.z, 2) },
      { label: 'Nivel de servicio (ciclos)', value: pct(res.cycleService, 0), hint: 'objetivo ' + fmt(v.service, 1) + ' %', tone: res.cycleService * 100 + 1e-9 >= v.service ? 'good' : 'warn' },
      { label: 'Tasa de cumplimiento', value: pct(res.fillRate, 2), hint: 'demanda atendida' },
      { label: 'Unidades perdidas', value: fmt(res.lost, 0), hint: res.stockoutDays.length + ' días con faltante' },
      { label: 'Inventario promedio', value: fmt(res.avgInv, 0) + ' u' },
      { label: 'Pedidos emitidos', value: String(res.orders.length) },
    ]);
    player.setTotal(res.series.length);
  }
  update(ctl.values);
  return () => player.stop();
}
