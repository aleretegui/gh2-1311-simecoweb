// Punto de reorden con demanda variable (ventas perdidas si no hay stock).
import { createRng } from '../lib/rng.js';
import { normInv, mean } from '../lib/stats.js';

export function reorderPoint({ dMean, dStd, L, service }) {
  const z = normInv(service);
  const sigmaL = dStd * Math.sqrt(L);
  const ss = z * sigmaL;
  return { z, sigmaL, ss, rop: dMean * L + ss };
}

export function genDemand({ dMean, dStd, days, seed }) {
  const rng = createRng(seed);
  return Array.from({ length: days }, () => Math.max(0, Math.round(rng.normal(dMean, dStd))));
}

// service en fracción (0.95). Revisión continua: se pide Q cuando la posición ≤ ROP.
export function simulate({ dMean, dStd, L, service, Q, days, seed }) {
  const { rop, ss, z } = reorderPoint({ dMean, dStd, L, service });
  const demand = genDemand({ dMean, dStd, days, seed });
  let onHand = Math.round(rop) + Q;
  const arrivals = new Map(); // día de llegada → unidades
  const orders = []; // {day, arrive, stockout}
  const series = [];
  const stockoutDays = [];
  let lost = 0;
  let onOrder = 0;
  for (let day = 1; day <= days; day++) {
    const arr = arrivals.get(day) || 0;
    onHand += arr;
    onOrder -= arr;
    const dem = demand[day - 1];
    const sold = Math.min(onHand, dem);
    onHand -= sold;
    if (dem > sold) {
      lost += dem - sold;
      stockoutDays.push(day);
      for (const o of orders) if (o.arrive > day) o.stockout = true;
    }
    let position = onHand + onOrder;
    while (position <= rop) {
      const arrive = day + L;
      arrivals.set(arrive, (arrivals.get(arrive) || 0) + Q);
      orders.push({ day, arrive, stockout: false });
      onOrder += Q;
      position += Q;
    }
    series.push({ day, onHand, position });
  }
  const totalDemand = demand.reduce((s, x) => s + x, 0);
  const completed = orders.filter((o) => o.arrive <= days);
  return {
    rop,
    ss,
    z,
    demand,
    series,
    orders,
    stockoutDays,
    lost,
    totalDemand,
    fillRate: totalDemand ? 1 - lost / totalDemand : 1,
    cycleService: completed.length ? 1 - completed.filter((o) => o.stockout).length / completed.length : 1,
    avgInv: mean(series.map((s) => s.onHand)),
  };
}
