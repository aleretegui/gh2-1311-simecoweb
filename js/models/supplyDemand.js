// Oferta y demanda lineales.
//   Demanda: Qd = a − b·P          (P = precio que paga el consumidor)
//   Oferta:  Qs = c + d·(P − t)    (t = impuesto por unidad; t < 0 es subsidio)

export function equilibrium({ a, b, c, d, t = 0 }) {
  const P = (a - c + d * t) / (b + d);
  const Q = Math.max(0, a - b * P);
  return { P, Q, Pnet: P - t };
}

export function surpluses(p) {
  const { a, b, c, d, t = 0 } = p;
  const { P, Q, Pnet } = equilibrium(p);
  if (Q <= 0) return { cs: 0, ps: 0, revenue: 0 };
  const cs = 0.5 * (a / b - P) * Q;
  const ps = c >= 0 ? Pnet * Q - (Q > c ? (Q - c) ** 2 / (2 * d) : 0) : Pnet * Q - (Q * Q / 2 - c * Q) / d;
  return { cs, ps, revenue: t * Q };
}

// Compara el mercado original con el mercado tras shocks e impuesto.
export function compare(params) {
  const { a, b, c, d, da = 0, dc = 0, t = 0 } = params;
  const base = { a, b, c, d, t: 0 };
  const next = { a: a + da, b, c: c + dc, d, t };
  const e0 = equilibrium(base);
  const e1 = equilibrium(next);
  const s0 = surpluses(base);
  const s1 = surpluses(next);
  const dwl = s0.cs + s0.ps - (s1.cs + s1.ps + s1.revenue);
  return { base, next, e0, e1, s0, s1, dwl };
}

// Curvas en el plano (Q, P). Devuelve puntos de demanda y oferta.
export function curves(p, qMax, n = 60) {
  const demand = [];
  const supply = [];
  const pMax = p.a / p.b;
  for (let i = 0; i <= n; i++) {
    const q = (qMax * i) / n;
    const pd = (p.a - q) / p.b;
    if (pd >= 0) demand.push({ x: q, y: pd });
    const ps = (q - p.c) / p.d + (p.t || 0);
    if (ps >= 0 && ps <= pMax * 1.6) supply.push({ x: q, y: ps });
  }
  return { demand, supply };
}

// Ajuste dinámico del precio: P(t+1) = P(t) + k·(Qd − Qs).
export function priceAdjustment({ next, P0, k, steps = 40 }) {
  const rows = [];
  let P = P0;
  for (let i = 0; i <= steps; i++) {
    const qd = Math.max(0, next.a - next.b * P);
    const qs = Math.max(0, next.c + next.d * (P - next.t));
    rows.push({ step: i, P, qd, qs });
    P = Math.max(0, P + k * (qd - qs));
  }
  return rows;
}
