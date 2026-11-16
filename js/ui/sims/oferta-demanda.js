import { shell, controls, kpis, fmt, h } from '../dom.js';
import { makeChart, line, marks, setData, setScale, COLORS } from '../charts.js';
import { compare, curves, priceAdjustment } from '../../models/supplyDemand.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Oferta y demanda',
    intro: 'El precio de equilibrio surge del cruce entre oferta y demanda. Introduce shocks o un impuesto y observa cómo se desplaza el mercado.',
    observe: 'Un shock positivo de demanda sube precio y cantidad; uno positivo de oferta baja el precio. Un impuesto reduce la cantidad y genera una pérdida de eficiencia (peso muerto). En el gráfico dinámico, con k alto el precio oscila y puede no converger.',
  });
  const ctl = controls([
    { key: 'a', label: 'a (demanda máxima)', min: 50, max: 300, step: 5, value: 100 },
    { key: 'b', label: 'b (sensibilidad de la demanda)', min: 0.5, max: 5, step: 0.1, value: 2 },
    { key: 'c', label: 'c (oferta mínima)', min: -50, max: 50, step: 5, value: 0 },
    { key: 'd', label: 'd (sensibilidad de la oferta)', min: 0.5, max: 5, step: 0.1, value: 1.5 },
    { type: 'heading', label: 'Shocks y política' },
    { key: 'da', label: 'Shock de demanda (Δa)', min: -50, max: 50, step: 5, value: 0 },
    { key: 'dc', label: 'Shock de oferta (Δc)', min: -50, max: 50, step: 5, value: 0 },
    { key: 't', label: 'Impuesto (+) o subsidio (−) por unidad', min: -10, max: 10, step: 0.5, value: 0, unit: 'USD' },
    { type: 'heading', label: 'Ajuste dinámico del precio' },
    { key: 'k', label: 'k (velocidad de ajuste)', min: 0.01, max: 0.5, step: 0.01, value: 0.1 },
    { key: 'p0', label: 'Precio inicial', type: 'select', value: 'eq', options: [
      { value: 'eq', label: 'Equilibrio original' }, { value: 'low', label: 'Bajo (50 % del equilibrio)' }, { value: 'high', label: 'Alto (150 % del equilibrio)' }] },
  ], update);
  controlsBox.append(ctl.el);

  const k = kpis();
  const mk = h('div', {});
  const chartA = makeChart(mk, [], { label: 'Curvas de oferta y demanda con el equilibrio', title: 'Mercado: precio vs. cantidad', xTitle: 'Cantidad', yTitle: 'Precio (USD)' });
  const dyn = h('div', {});
  const chartB = makeChart(dyn, [], { label: 'Ajuste dinámico del precio hacia el nuevo equilibrio', title: 'Ajuste dinámico del precio', xTitle: 'Paso', yTitle: 'Precio (USD)' });
  const note = h('p', { class: 'notice' });
  out.append(k.el, mk, dyn, note);

  function update(v) {
    const r = compare(v);
    const qMax = Math.max(v.a, v.a + v.da);
    const pMax = Math.max(v.a / v.b, (v.a + v.da) / v.b) * 1.05;
    const c0 = curves(r.base, qMax);
    const c1 = curves(r.next, qMax);
    const shocked = v.da !== 0 || v.dc !== 0 || v.t !== 0;
    const ds = [
      line('Demanda original', c0.demand, { color: COLORS[0] }),
      line('Oferta original', c0.supply, { color: COLORS[1] }),
      marks('Equilibrio original', [{ x: r.e0.Q, y: r.e0.P }], '#111827', 6),
    ];
    if (shocked) {
      ds.push(line('Demanda nueva', c1.demand, { color: COLORS[0], dashed: true }),
        line('Oferta nueva (precio al consumidor)', c1.supply, { color: COLORS[1], dashed: true }),
        marks('Equilibrio nuevo', [{ x: r.e1.Q, y: r.e1.P }], COLORS[3], 7));
    }
    setData(chartA, ds);
    setScale(chartA, 'x', { min: 0, max: qMax });
    setScale(chartA, 'y', { min: 0, max: pMax });
    chartA.update('none');

    const P0 = v.p0 === 'low' ? r.e0.P * 0.5 : v.p0 === 'high' ? r.e0.P * 1.5 : r.e0.P;
    const rows = priceAdjustment({ next: r.next, P0, k: v.k });
    setData(chartB, [
      line('Precio', rows.map((x) => ({ x: x.step, y: x.P })), { color: COLORS[0] }),
      line('Precio de equilibrio nuevo', [{ x: 0, y: r.e1.P }, { x: 40, y: r.e1.P }], { color: COLORS[3], dashed: true }),
    ]);
    const stable = v.k * (v.b + v.d) < 2;
    note.hidden = stable;
    note.textContent = 'Con este k el ajuste no converge (k·(b+d) ≥ 2): el precio oscila sin estabilizarse. Reduce k.';

    k.update([
      { label: 'Precio de equilibrio', value: '$' + fmt(r.e1.P), hint: shocked ? 'antes: $' + fmt(r.e0.P) : null },
      { label: 'Cantidad de equilibrio', value: fmt(r.e1.Q, 1), hint: shocked ? 'antes: ' + fmt(r.e0.Q, 1) : null },
      { label: 'Excedente del consumidor', value: fmt(r.s1.cs, 0), hint: shocked ? 'antes: ' + fmt(r.s0.cs, 0) : null },
      { label: 'Excedente del productor', value: fmt(r.s1.ps, 0), hint: shocked ? 'antes: ' + fmt(r.s0.ps, 0) : null },
      { label: 'Recaudación fiscal', value: fmt(r.s1.revenue, 0) },
      { label: 'Pérdida de eficiencia', value: fmt(Math.max(0, r.dwl), 0), tone: r.dwl > 0.5 ? 'warn' : '' },
    ]);
  }
  update(ctl.values);
  return () => {};
}
