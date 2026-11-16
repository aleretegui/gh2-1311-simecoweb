// Beer Game simplificado. El jugador controla un rol; la computadora controla los demás.
//  - Retraso de envío: 2 semanas. Los pedidos llegan al proveedor la semana siguiente.
//  - La Fábrica recibe su pedido como producción, también con 2 semanas de retraso.
import { variance } from '../lib/stats.js';

export const ROLES = ['Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
export const WEEKS = 36;
export const HOLD = 0.5;
export const BACKLOG = 1.0;
const TARGET = 12;
const GAIN = 0.25;

export const customerDemand = (week) => (week <= 4 ? 4 : 8); // week: 1..36

export function createGame(playerRole = 0) {
  const roles = ROLES.map(() => ({
    inv: 12,
    backlog: 0,
    pipe: [4, 4], // [llega esta semana, llega la próxima]
    ordersIn: 4, // pedido que se recibe esta semana
    arrived: 0,
    demand: 0,
    shipped: 0,
    lastOrder: 4,
    cost: 0,
  }));
  const history = { weeks: [], orders: ROLES.map(() => []), customer: [] };
  const g = { week: 1, roles, playerRole, history, done: false };
  receiveAndShip(g);
  return g;
}

// Fase A de la semana: llegada de cajas, recepción del pedido y envío.
function receiveAndShip(g) {
  g.roles.forEach((r, i) => {
    r.arrived = r.pipe[0];
    r.inv += r.arrived;
    r.demand = i === 0 ? customerDemand(g.week) : r.ordersIn;
    const need = r.backlog + r.demand;
    r.shipped = Math.min(r.inv, need);
    r.inv -= r.shipped;
    r.backlog = need - r.shipped;
  });
}

// Sugerencia de la computadora para el rol i.
export function aiOrder(r) {
  return Math.max(0, Math.round(r.demand + GAIN * (TARGET - (r.inv - r.backlog))));
}

// Envía el pedido del jugador, avanza una semana y devuelve el estado.
export function submit(g, playerOrder) {
  if (g.done) return g;
  const orders = g.roles.map((r, i) => (i === g.playerRole ? Math.max(0, Math.round(playerOrder)) : aiOrder(r)));
  g.roles.forEach((r, i) => {
    r.cost += r.inv * HOLD + r.backlog * BACKLOG;
    r.lastOrder = orders[i];
    g.history.orders[i].push(orders[i]);
  });
  g.history.weeks.push(g.week);
  g.history.customer.push(customerDemand(g.week));
  // Avance de tuberías y pedidos
  g.roles.forEach((r, i) => {
    const incomingShipment = i < ROLES.length - 1 ? g.roles[i + 1].shipped : orders[i]; // la Fábrica produce lo que pide
    r.pipe = [r.pipe[1], incomingShipment];
  });
  g.roles.forEach((r, i) => {
    if (i > 0) g.roles[i].ordersIn = orders[i - 1];
  });
  if (g.week >= WEEKS) {
    g.done = true;
    return g;
  }
  g.week += 1;
  receiveAndShip(g);
  return g;
}

export function summary(g) {
  const cd = g.history.customer;
  const vd = variance(cd) || 1;
  return {
    playerCost: g.roles[g.playerRole].cost,
    chainCost: g.roles.reduce((s, r) => s + r.cost, 0),
    ratios: g.history.orders.map((o) => variance(o) / vd),
  };
}
