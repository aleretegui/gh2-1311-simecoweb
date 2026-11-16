// Sistemas de revisión: continuo (Q, R) vs periódico (T, S) con la misma demanda.
import { normInv, mean } from '../lib/stats.js';
export { genDemand } from './reorderPoint.js';

// Parámetros de política derivados. service en fracción.
export function policies({ dMean, dStd, L, T, service, Q }) {
  const z = normInv(service);
  const ssC = z * dStd * Math.sqrt(L);
  const ssP = z * dStd * Math.sqrt(T + L);
  return {
    z,
    continuous: { R: dMean * L + ssC, Q, ss: ssC },
    periodic: { T, S: dMean * (T + L) + ssP, ss: ssP },
  };
}

// kind: 'continuous' | 'periodic'. Costos: K por pedido, H por unidad y año, pen por unidad faltante.
export function simulatePolicy(kind, { R, Q, T, S, L, K, H, pen }, demand) {
  const days = demand.length;
  let onHand = Math.round(kind === 'continuous' ? R + Q : S);
  let onOrder = 0;
  const arrivals = new Map();
  const series = [];
  const orders = [];
  let lost = 0;
  const place = (day, qty) => {
    if (qty <= 0) return;
    arrivals.set(day + L, (arrivals.get(day + L) || 0) + qty);
    onOrder += qty;
    orders.push({ day, qty });
  };
  for (let day = 1; day <= days; day++) {
    const arr = arrivals.get(day) || 0;
    onHand += arr;
    onOrder -= arr;
    const sold = Math.min(onHand, demand[day - 1]);
    onHand -= sold;
    lost += demand[day - 1] - sold;
    if (kind === 'continuous') {
      let position = onHand + onOrder;
      while (position <= R) {
        place(day, Q);
        position += Q;
      }
    } else if (day % T === 0) {
      place(day, Math.round(S - (onHand + onOrder)));
    }
    series.push({ day, onHand });
  }
  const warm = Math.min(30, Math.floor(days / 4));
  const measured = series.slice(warm);
  const avgInv = mean(measured.map((s) => s.onHand));
  const nOrders = orders.filter((o) => o.day > warm).length;
  const years = (days - warm) / 365;
  const totalDemand = demand.reduce((s, x) => s + x, 0);
  const orderCost = nOrders * K;
  const holdCost = avgInv * H * years;
  const stockoutCost = lost * pen;
  return {
    series,
    orders,
    avgInv,
    nOrders,
    lost,
    fillRate: totalDemand ? 1 - lost / totalDemand : 1,
    orderCost,
    holdCost,
    stockoutCost,
    totalCost: orderCost + holdCost + stockoutCost,
  };
}
