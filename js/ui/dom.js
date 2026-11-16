// Helpers de DOM: creación de elementos, controles, tarjetas KPI y estructura de página.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

export const fmt = (x, d = 2) =>
  Number.isFinite(x) ? x.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: d }) : '—';
export const pct = (x, d = 1) => (Number.isFinite(x) ? fmt(x * 100, d) + ' %' : '—');

let uid = 0;

// defs: [{key,label,min,max,step,value,unit}] | {type:'select',options:[{value,label}]}
//       | {type:'checkbox'} | {type:'seed'} | {type:'heading',label}
export function controls(defs, onChange) {
  const values = {};
  const setters = {};
  const el = h('form', { class: 'controls', onsubmit: (e) => e.preventDefault() });
  const fire = (key) => onChange && onChange(values, key);
  for (const d of defs) {
    const id = 'c' + ++uid;
    if (d.type === 'heading') {
      el.append(h('h4', {}, d.label));
      continue;
    }
    values[d.key] = d.value;
    if (d.type === 'select') {
      const sel = h('select', { id, onchange: () => { values[d.key] = sel.value; fire(d.key); } },
        d.options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(d.value) }, o.label)));
      setters[d.key] = (v) => { sel.value = v; values[d.key] = v; };
      el.append(h('label', { for: id }, d.label, sel));
    } else if (d.type === 'checkbox') {
      const cb = h('input', { id, type: 'checkbox', checked: !!d.value, onchange: () => { values[d.key] = cb.checked; fire(d.key); } });
      setters[d.key] = (v) => { cb.checked = v; values[d.key] = v; };
      el.append(h('label', { for: id, class: 'check' }, cb, d.label));
    } else if (d.type === 'seed') {
      const num = h('input', { id, type: 'number', min: 1, max: 999999, step: 1, value: d.value });
      num.addEventListener('input', () => {
        const v = parseInt(num.value, 10);
        if (Number.isFinite(v) && v > 0) { values[d.key] = v; fire(d.key); }
      });
      const btn = h('button', { type: 'button', class: 'secondary outline small', onclick: () => {
        const v = 1 + Math.floor(Math.random() * 99999);
        num.value = v; values[d.key] = v; fire(d.key);
      } }, 'Nueva semilla');
      setters[d.key] = (v) => { num.value = v; values[d.key] = v; };
      el.append(h('label', { for: id }, d.label, h('div', { class: 'seed' }, num, btn)));
    } else {
      const out = h('output', { for: id });
      const range = h('input', { id, type: 'range', min: d.min, max: d.max, step: d.step, value: d.value });
      const num = h('input', { type: 'number', min: d.min, max: d.max, step: d.step, value: d.value, 'aria-label': d.label + ' (valor numérico)' });
      const show = (v) => {
        out.textContent = (d.zeroLabel && v === 0 ? d.zeroLabel : fmt(v, 3)) + (d.unit && !(d.zeroLabel && v === 0) ? ' ' + d.unit : '');
      };
      const apply = (v, from) => {
        values[d.key] = v;
        if (from !== range) range.value = v;
        if (from !== num) num.value = v;
        show(v);
        fire(d.key);
      };
      range.addEventListener('input', () => apply(parseFloat(range.value), range));
      num.addEventListener('input', () => {
        const v = parseFloat(num.value);
        if (Number.isFinite(v) && v >= d.min && v <= d.max) apply(v, num);
      });
      setters[d.key] = (v) => { values[d.key] = v; range.value = v; num.value = v; show(v); };
      show(d.value);
      el.append(h('label', { for: id }, h('span', { class: 'lbl' }, d.label, out), h('div', { class: 'pair' }, range, num)));
    }
  }
  return { el, values, set: (k, v) => setters[k] && setters[k](v) };
}

export function kpis() {
  const el = h('div', { class: 'kpis' });
  return {
    el,
    update(items) {
      el.replaceChildren(...items.map((i) =>
        h('article', { class: 'kpi' + (i.tone ? ' ' + i.tone : '') }, h('small', {}, i.label), h('strong', {}, i.value), i.hint ? h('em', {}, i.hint) : null)));
    },
  };
}

// Estructura estándar de una simulación. Devuelve las zonas donde montar controles y resultados.
export function shell(root, { title, intro, observe }) {
  root.replaceChildren();
  const controlsBox = h('aside', { class: 'panel' }, h('h3', {}, 'Parámetros'));
  const out = h('div', { class: 'outputs' });
  root.append(
    h('h2', {}, title),
    h('p', { class: 'intro' }, intro),
    h('div', { class: 'sim-layout' }, controlsBox, out),
    h('details', { class: 'observe', open: true }, h('summary', {}, 'Qué observar'), h('p', {}, observe)),
  );
  return { controlsBox, out };
}

export function table(headers, rows, caption) {
  return h('div', { class: 'table-wrap' }, h('table', {},
    caption ? h('caption', {}, caption) : null,
    h('thead', {}, h('tr', {}, headers.map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, rows.map((r) => h('tr', { class: r.highlight ? 'hl' : '' }, (r.cells || r).map((c, i) => h(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : {}, c)))))));
}
