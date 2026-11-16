// Efecto látigo: 4 eslabones con política order-up-to y pronóstico de media móvil.
import { createRng } from '../lib/rng.js';
import { mean, std, sum, variance } from '../lib/stats.js';

export const ECHELONS = ['Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
const BASE = 100;

// pattern: 'step' | 'random' | 'seasonal'
export function customerDemand({ pattern, periods, seed }) {
  const rng = createRng(seed);
  return Array.from({ length: periods }, (_, t) => {
    if (pattern === 'random') return Math.max(0, Math.round(rng.normal(BASE, 10)));
    if (pattern === 'seasonal') return Math.round(BASE + 20 * Math.sin((2 * Math.PI * t) / 12));
    return t < 10 ? BASE : BASE * 1.2;
  });
}

export function simulate({ pattern, m, L, z, share, periods, seed }) {
  const demand = customerDemand({ pattern, periods, seed });
  const st = ECHELONS.map(() => ({ inv: BASE, pipe: Array(L).fill(BASE), hist: Array(m).fill(BASE) }));
  const orders = ECHELONS.map(() => []);
  for (let t = 0; t < periods; t++) {
    let down = demand[t];
    st.forEach((e, k) => {
      e.inv += e.pipe.shift();
      e.inv -= down; // inventario neto (puede ser negativo = pendientes)
      e.hist.push(share ? demand[t] : down);
      if (e.hist.length > m) e.hist.shift();
      const target = mean(e.hist) * (L + 1) + z * std(e.hist) * Math.sqrt(L + 1);
      const o = Math.max(0, target - (e.inv + sum(e.pipe)));
      e.pipe.push(o);
      orders[k].push(o);
      down = o;
    });
  }
  const vd = variance(demand) || 1;
  return { demand, orders, ratios: orders.map((o) => variance(o) / vd) };
}
