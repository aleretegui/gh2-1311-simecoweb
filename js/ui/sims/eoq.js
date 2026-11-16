import { shell, controls, kpis, fmt, h } from '../dom.js';
import { makeChart, line, marks, setData, setScale, COLORS } from '../charts.js';
import { eoq, costs, costCurves, sawtooth } from '../../models/eoq.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Cantidad económica de pedido (EOQ)',
    intro: 'Pedir poco cuesta en trámites; pedir mucho cuesta en almacenamiento. El EOQ equilibra ambos costos.',
    observe: 'En el EOQ el costo de pedir y el de mantener son iguales y el costo total es mínimo. La curva total es plana cerca del óptimo: desviarse un 20 % cambia poco el costo. Desmarca «Usar EOQ óptimo» para probar otros lotes.',
  });
  const ctl = controls([
    { key: 'D', label: 'Demanda anual (D)', min: 100, max: 50000, step: 100, value: 10000, unit: 'u' },
    { key: 'S', label: 'Costo por pedido (S)', min: 5, max: 500, step: 5, value: 50, unit: 'USD' },
    { key: 'H', label: 'Costo de mantener (H, por u y año)', min: 0.5, max: 50, step: 0.5, value: 5, unit: 'USD' },
    { key: 'c', label: 'Costo unitario (c)', min: 1, max: 100, step: 1, value: 20, unit: 'USD' },
    { key: 'opt', label: 'Usar EOQ óptimo', type: 'checkbox', value: true },
    { key: 'Q', label: 'Lote elegido (Q)', min: 10, max: 5000, step: 10, value: 450, unit: 'u' },
  ], update);
  controlsBox.append(ctl.el);

  const k = kpis();
  const charts = h('div', { class: 'two-col' });
  const chartA = makeChart(charts, [], { label: 'Curvas de costo de pedido, de mantener y total', title: 'Costos anuales según el lote', xTitle: 'Tamaño de lote Q (u)', yTitle: 'USD por año' });
  const chartB = makeChart(charts, [], { label: 'Diente de sierra del inventario', title: 'Inventario en el tiempo (lote elegido)', xTitle: 'Días', yTitle: 'Unidades' });
  out.append(k.el, charts);

  function update(v, key) {
    const p = { D: v.D, S: v.S, H: v.H, c: v.c };
    const qStar = eoq(p.D, p.S, p.H);
    if (v.opt) {
      const q = Math.min(5000, Math.max(10, Math.round(qStar)));
      ctl.set('Q', q);
      v.Q = q;
    }
    const Q = v.opt ? qStar : v.Q;
    const lo = Math.max(5, Math.min(qStar, Q) / 3);
    const hi = Math.max(qStar, Q) * 2.2;
    const cv = costCurves(p, lo, hi);
    const kStar = costs(p, qStar);
    const kQ = costs(p, Q);
    setData(chartA, [
      line('Costo de pedir', cv.order, { color: COLORS[1] }),
      line('Costo de mantener', cv.hold, { color: COLORS[2] }),
      line('Total (pedir + mantener)', cv.total, { color: COLORS[0], width: 3 }),
      marks('EOQ óptimo', [{ x: qStar, y: kStar.order + kStar.hold }], '#111827', 7),
      marks('Lote elegido', [{ x: Q, y: kQ.order + kQ.hold }], COLORS[3], 6),
    ]);
    setScale(chartA, 'x', { min: lo, max: hi });
    const saw = sawtooth(p, Q);
    setData(chartB, [line('Inventario', saw.points, { color: COLORS[0], fill: true })]);
    const diff = (kQ.total - kStar.total) / kStar.total;
    k.update([
      { label: 'EOQ', value: fmt(qStar, 1) + ' u' },
      { label: 'Pedidos por año', value: fmt(p.D / Q, 1) },
      { label: 'Tiempo entre pedidos', value: fmt(saw.cycleDays, 1) + ' días' },
      { label: 'Costo total (con compra)', value: '$' + fmt(kQ.total, 0), hint: 'óptimo: $' + fmt(kStar.total, 0) },
      { label: 'Sobrecosto vs. óptimo', value: fmt(diff * 100, 2) + ' %', tone: diff > 0.05 ? 'warn' : 'good' },
    ]);
  }
  update(ctl.values);
  return () => {};
}
