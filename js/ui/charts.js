// Envoltura de Chart.js (cargado como global desde /vendor/chart.umd.js).
import { h } from './dom.js';

export const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];
const charts = new Set();

function themeDefaults() {
  const css = getComputedStyle(document.documentElement);
  const color = css.getPropertyValue('--pico-color').trim() || '#333';
  window.Chart.defaults.color = color;
  window.Chart.defaults.borderColor = css.getPropertyValue('--pico-muted-border-color').trim() || '#8884';
  window.Chart.defaults.font.family = css.getPropertyValue('--pico-font-family').trim() || 'sans-serif';
}

// Dataset de línea con valores por defecto legibles.
export function line(label, data, o = {}) {
  const color = o.color || COLORS[0];
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: o.fill ? color + '33' : color,
    borderWidth: o.width || 2,
    borderDash: o.dashed ? [6, 4] : [],
    pointRadius: o.points || 0,
    pointStyle: o.pointStyle || 'circle',
    showLine: o.showLine !== false,
    stepped: o.stepped || false,
    fill: !!o.fill,
    tension: 0,
  };
}

export function marks(label, data, color, radius = 5) {
  return { ...line(label, data, { color, points: radius }), showLine: false };
}

export function bars(label, data, color, stack) {
  return { label, data, backgroundColor: color, stack };
}

// opts: {type, label (accesibilidad), xTitle, yTitle, labels (eje categórico), stacked, xMin, xMax, yMin, yMax}
export function makeChart(parent, datasets, opts = {}) {
  themeDefaults();
  const canvas = h('canvas', { role: 'img', 'aria-label': opts.label || 'Gráfico' });
  const wrap = h('figure', { class: 'chart-wrap' }, opts.title ? h('figcaption', {}, opts.title) : null, h('div', { class: 'chart-box' }, canvas));
  parent.append(wrap);
  const category = !!opts.labels;
  const chart = new window.Chart(canvas, {
    type: opts.type || 'line',
    data: { labels: opts.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 14 } } },
      scales: {
        x: { type: category ? 'category' : 'linear', stacked: !!opts.stacked, title: { display: !!opts.xTitle, text: opts.xTitle }, min: opts.xMin, max: opts.xMax },
        y: { stacked: !!opts.stacked, title: { display: !!opts.yTitle, text: opts.yTitle }, min: opts.yMin, max: opts.yMax, beginAtZero: opts.yMin === undefined },
      },
    },
  });
  charts.add(chart);
  return chart;
}

// Actualiza datos conservando la instancia (y el estado de la leyenda si hay el mismo número de series).
export function setData(chart, datasets, labels) {
  if (labels) chart.data.labels = labels;
  if (chart.data.datasets.length === datasets.length) {
    datasets.forEach((d, i) => Object.assign(chart.data.datasets[i], d, { hidden: chart.data.datasets[i].hidden }));
  } else {
    chart.data.datasets = datasets;
  }
  chart.update('none');
}

export function setScale(chart, axis, o) {
  Object.assign(chart.options.scales[axis], o);
}

export function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts.clear();
}
