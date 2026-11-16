// Teoría de colas: fórmulas M/M/c y simulación de eventos discretos (FIFO).
import { createRng } from '../lib/rng.js';
import { erlangC } from '../lib/stats.js';

// λ y μ en clientes por hora; tiempos devueltos en horas.
export function mmc(lambda, mu, c) {
  const a = lambda / mu;
  const rho = a / c;
  if (rho >= 1) return { stable: false, rho, a };
  const pWait = erlangC(a, c);
  const Lq = (pWait * rho) / (1 - rho);
  const Wq = Lq / lambda;
  return { stable: true, rho, a, pWait, Lq, Wq, W: Wq + 1 / mu, L: Lq + a };
}

export function genArrivals(lambda, horizon, rng) {
  const out = [];
  let t = rng.exponential(lambda);
  while (t < horizon) {
    out.push(t);
    t += rng.exponential(lambda);
  }
  return out;
}

// arrivals ordenadas. capacity = tamaño máximo de la cola (Infinity = sin límite).
export function simulateStation(arrivals, { mu, c, capacity = Infinity }, rng) {
  const free = Array(c).fill(0);
  const recs = [];
  let p = 0;
  let blocked = 0;
  for (const a of arrivals) {
    while (p < recs.length && recs[p].start <= a) p++;
    if (recs.length - p >= capacity) {
      blocked++;
      continue;
    }
    let idx = 0;
    for (let i = 1; i < c; i++) if (free[i] < free[idx]) idx = i;
    const start = Math.max(a, free[idx]);
    const dep = start + rng.exponential(mu);
    free[idx] = dep;
    recs.push({ arr: a, start, dep });
  }
  return { recs, blocked };
}

// Muestrea cola y servidores ocupados en n instantes.
export function sample(recs, horizon, n = 240) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (horizon * i) / n;
    let queue = 0;
    let busy = 0;
    for (const r of recs) {
      if (r.arr > t) break;
      if (r.start > t) queue++;
      else if (r.dep > t) busy++;
    }
    out.push({ t, queue, busy });
  }
  return out;
}

export function stats(recs, c, horizon) {
  const n = recs.length;
  const waits = recs.map((r) => r.start - r.arr);
  const busyTime = recs.reduce((s, r) => s + (Math.min(r.dep, horizon) - Math.min(r.start, horizon)), 0);
  const waitSum = waits.reduce((s, w) => s + w, 0);
  return {
    served: recs.filter((r) => r.dep <= horizon).length,
    arrived: n,
    avgWait: n ? waitSum / n : 0,
    maxWait: n ? Math.max(...waits) : 0,
    utilization: busyTime / (c * horizon),
  };
}

export function runSingle({ lambda, mu, c, capacity, horizon, seed }) {
  const rng = createRng(seed);
  const arrivals = genArrivals(lambda, horizon, rng);
  const { recs, blocked } = simulateStation(arrivals, { mu, c, capacity }, rng);
  return { recs, blocked, series: sample(recs, horizon), stats: stats(recs, c, horizon), arrivals: arrivals.length };
}

// stations: [{mu, c}]. Estaciones en serie con colas ilimitadas.
export function runSeries({ lambda, stations, horizon, seed }) {
  const rng = createRng(seed);
  let flow = genArrivals(lambda, horizon, rng);
  const results = [];
  for (const s of stations) {
    const { recs } = simulateStation(flow, { mu: s.mu, c: s.c }, rng);
    const st = stats(recs, s.c, horizon);
    const series = sample(recs, horizon);
    results.push({
      rhoTheory: lambda / (s.c * s.mu),
      utilization: st.utilization,
      avgWait: st.avgWait,
      maxQueue: Math.max(...series.map((x) => x.queue)),
      series,
      recs,
    });
    flow = recs.map((r) => r.dep).sort((a, b) => a - b);
  }
  const last = results[results.length - 1].recs;
  const first = results[0].recs;
  const through = last.filter((r) => r.dep <= horizon).length / horizon;
  return { results, throughput: through, entered: first.length, finished: last.filter((r) => r.dep <= horizon).length };
}
