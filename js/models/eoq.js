// Cantidad económica de pedido (EOQ).
export const eoq = (D, S, H) => Math.sqrt((2 * D * S) / H);

export function costs({ D, S, H, c }, Q) {
  const order = (D / Q) * S;
  const hold = (Q / 2) * H;
  const purchase = D * c;
  return { order, hold, purchase, total: order + hold + purchase };
}

export function costCurves(p, qMin, qMax, n = 80) {
  const order = [];
  const hold = [];
  const total = [];
  for (let i = 0; i <= n; i++) {
    const q = qMin + ((qMax - qMin) * i) / n;
    const k = costs(p, q);
    order.push({ x: q, y: k.order });
    hold.push({ x: q, y: k.hold });
    total.push({ x: q, y: k.order + k.hold });
  }
  return { order, hold, total };
}

// Diente de sierra del inventario. Tiempo en días (año de 365 días).
export function sawtooth({ D }, Q, cycles = 4) {
  const T = (Q / D) * 365;
  const pts = [];
  for (let i = 0; i < cycles; i++) {
    pts.push({ x: i * T, y: Q }, { x: (i + 1) * T, y: 0 });
  }
  return { points: pts, cycleDays: T };
}
