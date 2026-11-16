import { shell, controls, kpis, fmt, table, h } from '../dom.js';
import { makeChart, line, setData, COLORS } from '../charts.js';
import { ROLES, WEEKS, createGame, submit, aiOrder, summary, customerDemand } from '../../models/beerGame.js';

export default function mount(root) {
  const { controlsBox, out } = shell(root, {
    title: 'Beer Game (versión simplificada)',
    intro: 'Dirige un eslabón de la cadena durante 36 semanas. Cada semana decide cuántas cajas pedir a tu proveedor. El pedido tarda en llegar: el reto es no pedir de más ni de menos.',
    observe: 'La demanda del cliente solo pasa de 4 a 8 cajas en la semana 5, pero los pedidos de los eslabones suelen oscilar mucho más. Si reaccionas al inventario sin contar las cajas en tránsito, creas tu propio efecto látigo. Pedir lo que te piden más una pequeña corrección suele funcionar mejor.',
  });
  let game = createGame(0);
  const ctl = controls([
    { key: 'role', label: 'Tu rol', type: 'select', value: '0', options: ROLES.map((r, i) => ({ value: String(i), label: r })) },
  ], (v) => restart(Number(v.role)));
  const reset = h('button', { type: 'button', class: 'secondary', onclick: () => restart(game.playerRole) }, 'Reiniciar juego');
  controlsBox.append(ctl.el, reset, h('p', { class: 'intro' }, 'Costos: 0,50 USD por caja en inventario y 1,00 USD por caja pendiente, por semana. Envío: 2 semanas.'));

  const status = h('p', {});
  const k = kpis();
  const input = h('input', { id: 'order', type: 'number', min: 0, step: 1, value: 4, inputmode: 'numeric' });
  const send = h('button', { type: 'button', onclick: play }, 'Enviar pedido');
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  const orderBox = h('form', { class: 'game-order', onsubmit: (e) => e.preventDefault() },
    h('label', { for: 'order' }, 'Cajas a pedir esta semana', input), send);
  const suggest = h('p', { class: 'intro' });
  const tableHost = h('div', {});
  const chartHost = h('div', {});
  const chart = makeChart(chartHost, [], { label: 'Pedidos de cada rol y demanda del cliente por semana', title: 'Pedidos por semana', xTitle: 'Semana', yTitle: 'Cajas' });
  const endBox = h('div', {});
  out.append(status, k.el, orderBox, suggest, tableHost, chartHost, endBox);

  function restart(role) {
    game = createGame(role);
    input.value = 4;
    endBox.replaceChildren();
    render();
  }
  function play() {
    const v = Number(input.value);
    if (!Number.isFinite(v) || v < 0) { input.focus(); return; }
    submit(game, v);
    render();
    input.focus();
  }

  function render() {
    const me = game.roles[game.playerRole];
    const nextArrival = me.pipe[1];
    status.textContent = game.done ? `Juego terminado (${WEEKS} semanas). Eres: ${ROLES[game.playerRole]}.` : `Semana ${game.week} de ${WEEKS}. Eres: ${ROLES[game.playerRole]}.`;
    const dim = game.done;
    input.disabled = dim; send.disabled = dim;
    k.update([
      { label: 'Inventario', value: fmt(me.inv, 0) + ' cajas' },
      { label: 'Pendientes', value: fmt(me.backlog, 0) + ' cajas', tone: me.backlog > 0 ? 'bad' : '' },
      { label: 'Pedido recibido', value: fmt(me.demand, 0) + ' cajas', hint: game.playerRole === 0 ? 'demanda del cliente' : 'del eslabón siguiente' },
      { label: 'Cajas que llegaron', value: fmt(me.arrived, 0) },
      { label: 'Llegan la próxima semana', value: fmt(nextArrival, 0) },
      { label: 'Tu costo acumulado', value: '$' + fmt(me.cost, 1) },
    ]);
    suggest.textContent = game.done ? '' : `Referencia de la computadora para tu rol: pediría ${aiOrder(me)} cajas.`;
    tableHost.replaceChildren(table(['Rol', 'Inventario', 'Pendientes', 'Último pedido', 'Costo acumulado'],
      game.roles.map((r, i) => [ROLES[i] + (i === game.playerRole ? ' (tú)' : ''), fmt(r.inv, 0), fmt(r.backlog, 0), fmt(r.lastOrder, 0), '$' + fmt(r.cost, 1)]), 'Estado de la cadena'));
    const wk = game.history.weeks;
    setData(chart, [
      line('Demanda del cliente', wk.map((w, i) => ({ x: w, y: game.history.customer[i] })), { color: '#111827', width: 3, stepped: true }),
      ...ROLES.map((n, i) => line(n + (i === game.playerRole ? ' (tú)' : ''), wk.map((w, j) => ({ x: w, y: game.history.orders[i][j] })), { color: COLORS[i], width: i === game.playerRole ? 3 : 1.5 })),
    ]);
    if (game.done) {
      const s = summary(game);
      endBox.replaceChildren(
        h('h3', {}, 'Resultado'),
        table(['Rol', 'Razón de varianza (pedidos / demanda)'], ROLES.map((n, i) => [n, fmt(s.ratios[i], 1) + '×'])),
        h('p', { class: 'notice good' }, `Tu costo fue $${fmt(s.playerCost, 1)} y el de toda la cadena $${fmt(s.chainCost, 1)}. Una razón mayor a 1 indica amplificación de la variabilidad: es el efecto látigo. Prueba otro rol o reinicia e intenta pedir contando las cajas en tránsito.`),
      );
    }
  }
  render();
  void customerDemand;
  return () => {};
}
