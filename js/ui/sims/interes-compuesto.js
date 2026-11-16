import { shell, controls, kpis, fmt, pct, table, h } from '../dom.js';
import { makeChart, line, bars, setData, COLORS } from '../charts.js';
import { growth, npv, irr } from '../../models/compoundInterest.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Interés compuesto y decisiones financieras',
    intro: 'Compara dos escenarios de ahorro con aportes mensuales, mira el efecto de la inflación y decide entre proyectos con VPN y TIR.',
    observe: 'La mayor parte del crecimiento al final del plazo proviene de los intereses, no de los aportes. La inflación reduce el valor real. Un proyecto con mayor TIR no siempre tiene mayor VPN si difieren en tamaño.',
  });
  const ctl = controls([
    { type: 'heading', label: 'Escenario A' },
    { key: 'principal', label: 'Capital inicial', min: 0, max: 100000, step: 100, value: 10000, unit: 'USD' },
    { key: 'monthly', label: 'Aporte mensual', min: 0, max: 5000, step: 50, value: 200, unit: 'USD' },
    { key: 'rate', label: 'Tasa nominal anual', min: 0, max: 30, step: 0.1, value: 8, unit: '%' },
    { key: 'm', label: 'Capitalizaciones por año', type: 'select', value: 12, options: [1, 2, 4, 12, 365].map((n) => ({ value: n, label: String(n) })) },
    { key: 'years', label: 'Horizonte', min: 1, max: 40, step: 1, value: 10, unit: 'años' },
    { key: 'inflation', label: 'Inflación anual', min: 0, max: 15, step: 0.1, value: 3, unit: '%' },
    { type: 'heading', label: 'Escenario B (comparación)' },
    { key: 'rateB', label: 'Tasa nominal anual B', min: 0, max: 30, step: 0.1, value: 6, unit: '%' },
    { key: 'monthlyB', label: 'Aporte mensual B', min: 0, max: 5000, step: 50, value: 300, unit: 'USD' },
  ], update);
  controlsBox.append(ctl.el);

  const k = kpis();
  const charts = h('div', { class: 'two-col' });
  const chartA = makeChart(charts, [], { label: 'Crecimiento del capital nominal y real', title: 'Crecimiento del capital', xTitle: 'Años', yTitle: 'USD' });
  const chartB = makeChart(charts, [], { type: 'bar', stacked: true, labels: [], label: 'Capital aportado e intereses por año, escenario A', title: 'Escenario A: aportes vs. intereses', xTitle: 'Años', yTitle: 'USD' });

  // Calculadora de VPN
  const npvBox = h('section', {}, h('h3', {}, 'Decisión de inversión (VPN y TIR)'));
  const npvCtl = controls([
    { key: 'r', label: 'Tasa de descuento', min: 0, max: 30, step: 0.5, value: 10, unit: '%' },
    { key: 'iA', label: 'Proyecto A: inversión', min: 1000, max: 100000, step: 500, value: 10000, unit: 'USD' },
    { key: 'fA', label: 'Proyecto A: flujo anual', min: 100, max: 50000, step: 100, value: 3000, unit: 'USD' },
    { key: 'nA', label: 'Proyecto A: años', min: 1, max: 20, step: 1, value: 5 },
    { key: 'iB', label: 'Proyecto B: inversión', min: 1000, max: 100000, step: 500, value: 15000, unit: 'USD' },
    { key: 'fB', label: 'Proyecto B: flujo anual', min: 100, max: 50000, step: 100, value: 4200, unit: 'USD' },
    { key: 'nB', label: 'Proyecto B: años', min: 1, max: 20, step: 1, value: 5 },
  ], updateNpv);
  const npvOut = h('div', {});
  const advice = h('p', { class: 'notice good' });
  npvBox.append(npvCtl.el, npvOut, advice);
  out.append(k.el, charts, npvBox);

  function update(v) {
    const base = { principal: v.principal, monthly: v.monthly, rate: v.rate / 100, m: Number(v.m), years: v.years, inflation: v.inflation / 100 };
    const A = growth(base);
    const B = growth({ ...base, rate: v.rateB / 100, monthly: v.monthlyB });
    setData(chartA, [
      line('A nominal', A.rows.map((r) => ({ x: r.year, y: r.nominal })), { color: COLORS[0] }),
      line('A real (descontada la inflación)', A.rows.map((r) => ({ x: r.year, y: r.real })), { color: COLORS[2] }),
      line('B nominal', B.rows.map((r) => ({ x: r.year, y: r.nominal })), { color: COLORS[1], dashed: true }),
    ]);
    setData(chartB, [
      bars('Capital aportado', A.rows.map((r) => r.contributed), COLORS[0], 's'),
      bars('Intereses', A.rows.map((r) => r.interest), COLORS[3], 's'),
    ], A.rows.map((r) => String(r.year)));
    const f = A.final;
    k.update([
      { label: 'Valor final A (nominal)', value: '$' + fmt(f.nominal, 0) },
      { label: 'Valor final A (real)', value: '$' + fmt(f.real, 0) },
      { label: 'Aportes totales A', value: '$' + fmt(f.contributed, 0) },
      { label: 'Intereses ganados A', value: '$' + fmt(f.interest, 0), hint: pct(f.interest / f.nominal, 0) + ' del total' },
      { label: 'Tasa efectiva anual', value: pct(A.tea, 2) },
      { label: 'Valor final B (nominal)', value: '$' + fmt(B.final.nominal, 0), hint: 'dif. vs A: $' + fmt(B.final.nominal - f.nominal, 0) },
    ]);
  }

  function updateNpv(v) {
    const r = v.r / 100;
    const A = { rate: r, invest: v.iA, flow: v.fA, years: v.nA };
    const B = { rate: r, invest: v.iB, flow: v.fB, years: v.nB };
    const vA = npv(A), vB = npv(B);
    const tA = irr(A), tB = irr(B);
    npvOut.replaceChildren(table(['Proyecto', 'VPN (USD)', 'TIR', 'Decisión'], [
      ['A', fmt(vA, 0), tA === null ? 'n/d' : pct(tA), vA > 0 ? 'Crea valor' : 'Destruye valor'],
      ['B', fmt(vB, 0), tB === null ? 'n/d' : pct(tB), vB > 0 ? 'Crea valor' : 'Destruye valor'],
    ]));
    advice.textContent = vA <= 0 && vB <= 0 ? 'Ningún proyecto supera la tasa de descuento: conviene no invertir.'
      : `Con el criterio de VPN conviene el proyecto ${vA >= vB ? 'A' : 'B'}.` + ((tA !== null && tB !== null && (tA > tB) !== (vA > vB)) ? ' Nota: la TIR apunta al otro proyecto; el VPN es el criterio más fiable al comparar tamaños distintos.' : '');
  }
  update(ctl.values);
  updateNpv(npvCtl.values);
  return () => {};
}
