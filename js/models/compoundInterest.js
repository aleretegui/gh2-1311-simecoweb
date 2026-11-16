// Interés compuesto con aportes mensuales (al final de cada mes) y VPN/TIR.

export function effectiveAnnual(rate, m) {
  return (1 + rate / m) ** m - 1;
}

// rate y inflation en fracción (0.08 = 8 %). m = capitalizaciones por año.
export function growth({ principal, monthly, rate, m, years, inflation }) {
  const i = (1 + rate / m) ** (m / 12) - 1; // tasa efectiva mensual equivalente
  const rows = [{ year: 0, nominal: principal, real: principal, contributed: principal, interest: 0 }];
  let bal = principal;
  let contributed = principal;
  for (let month = 1; month <= years * 12; month++) {
    bal = bal * (1 + i) + monthly;
    contributed += monthly;
    if (month % 12 === 0) {
      const year = month / 12;
      rows.push({ year, nominal: bal, real: bal / (1 + inflation) ** year, contributed, interest: bal - contributed });
    }
  }
  return { rows, tea: effectiveAnnual(rate, m), final: rows[rows.length - 1] };
}

// Valor presente neto de una inversión con flujo anual constante.
export function npv({ rate, invest, flow, years }) {
  let v = -invest;
  for (let t = 1; t <= years; t++) v += flow / (1 + rate) ** t;
  return v;
}

// Tasa interna de retorno por bisección. Devuelve null si no existe en [-99 %, 1000 %].
export function irr({ invest, flow, years }) {
  let lo = -0.99;
  let hi = 10;
  const f = (r) => npv({ rate: r, invest, flow, years });
  if (f(lo) * f(hi) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
