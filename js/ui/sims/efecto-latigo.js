import { shell, controls, kpis, fmt, table, h } from '../dom.js';
import { makeChart, line, bars, setData, COLORS } from '../charts.js';
import { createPlayer } from '../player.js';
import { simulate, ECHELONS } from '../../models/bullwhip.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Efecto látigo (bullwhip effect)',
    intro: 'Cadena de cuatro eslabones. Cada uno pronostica con una media móvil de los pedidos que recibe y pide para reponer hasta un nivel objetivo.',
    observe: 'Un pequeño cambio en la demanda final se amplifica en cada eslabón hacia la Fábrica. La razón de varianza crece aguas arriba. Activa «Compartir información» o reduce el plazo para ver cómo se atenúa; una ventana de pronóstico corta amplifica más.',
  });
  const ctl = controls([
    { key: 'pattern', label: 'Patrón de demanda final', type: 'select', value: 'step', options: [
      { value: 'step', label: 'Escalón (+20 % en el periodo 10)' }, { value: 'random', label: 'Aleatoria' }, { value: 'seasonal', label: 'Estacional' }] },
    { key: 'm', label: 'Ventana del pronóstico (m)', min: 1, max: 10, step: 1, value: 4, unit: 'periodos' },
    { key: 'L', label: 'Plazo entre eslabones (L)', min: 1, max: 5, step: 1, value: 2, unit: 'periodos' },
    { key: 'z', label: 'Factor de seguridad (z)', min: 0, max: 2.5, step: 0.1, value: 1 },
    { key: 'share', label: 'Compartir información de la demanda final', type: 'checkbox', value: false },
    { key: 'periods', label: 'Periodos a simular', min: 20, max: 100, step: 5, value: 50 },
    { key: 'seed', label: 'Semilla (demanda aleatoria)', type: 'seed', value: 11 },
  ], update);
  controlsBox.append(ctl.el);

  let res = null;
  const k = kpis();
  const charts = h('div', { class: 'two-col' });
  const chartLine = makeChart(charts, [], { label: 'Pedidos de cada eslabón frente a la demanda final', title: 'Pedidos por eslabón', xTitle: 'Periodo', yTitle: 'Unidades' });
  const chartBar = makeChart(charts, [], { type: 'bar', labels: ECHELONS, label: 'Razón de varianza por eslabón', title: 'Amplificación: Var(pedidos) / Var(demanda final)', yTitle: 'Razón' });
  const tableHost = h('div', {});
  const player = createPlayer(draw, { perSecond: 8, unit: 'periodo' });
  out.append(k.el, player.el, charts, tableHost);

  function draw(upTo) {
    if (!res) return;
    const pts = (arr) => arr.slice(0, upTo).map((y, i) => ({ x: i + 1, y }));
    setData(chartLine, [
      line('Demanda final', pts(res.demand), { color: '#111827', width: 3 }),
      ...ECHELONS.map((n, i) => line(n, pts(res.orders[i]), { color: COLORS[i] })),
    ]);
  }

  function update(v) {
    res = simulate(v);
    setData(chartBar, [bars('Razón de varianza', res.ratios, COLORS[4])], ECHELONS);
    const last = res.ratios[3];
    k.update([
      { label: 'Amplificación en la Fábrica', value: fmt(last, 1) + '×', tone: last > 3 ? 'bad' : last > 1.5 ? 'warn' : 'good', hint: 'varianza de pedidos / demanda' },
      { label: 'Amplificación en el Minorista', value: fmt(res.ratios[0], 2) + '×' },
      { label: 'Pedido máximo (Fábrica)', value: fmt(Math.max(...res.orders[3]), 0) + ' u' },
      { label: 'Demanda final máxima', value: fmt(Math.max(...res.demand), 0) + ' u' },
    ]);
    tableHost.replaceChildren(table(['Eslabón', 'Razón de varianza', 'Pedido máximo (u)', 'Pedido mínimo (u)'],
      ECHELONS.map((n, i) => [n, fmt(res.ratios[i], 2) + '×', fmt(Math.max(...res.orders[i]), 0), fmt(Math.min(...res.orders[i]), 0)]), 'Resumen por eslabón'));
    player.setTotal(v.periods);
  }
  update(ctl.values);
  return () => player.stop();
}
