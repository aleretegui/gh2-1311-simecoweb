// Enrutador por hash: #/<id>. Cada simulación es un módulo en js/ui/sims/<id>.js
import { h } from './ui/dom.js';
import { destroyCharts } from './ui/charts.js';

export const GROUPS = [
  { name: 'Mercado y finanzas', sims: [
    { id: 'oferta-demanda', title: 'Oferta y demanda', desc: 'Equilibrio, shocks, impuestos y ajuste dinámico del precio.' },
    { id: 'interes-compuesto', title: 'Interés compuesto y decisiones financieras', desc: 'Crecimiento con aportes, inflación, VPN y TIR.' },
  ] },
  { name: 'Inventarios', sims: [
    { id: 'eoq', title: 'Cantidad económica de pedido', desc: 'El tamaño de lote que minimiza el costo total.' },
    { id: 'punto-reorden', title: 'Punto de reorden con demanda variable', desc: 'Stock de seguridad y nivel de servicio simulados.' },
    { id: 'sistemas-revision', title: 'Sistemas de revisión', desc: 'Revisión continua (Q, R) frente a periódica (T, S).' },
  ] },
  { name: 'Cadena y colas', sims: [
    { id: 'efecto-latigo', title: 'Efecto látigo', desc: 'Cómo la variabilidad se amplifica aguas arriba.' },
    { id: 'beer-game', title: 'Beer Game (simplificado)', desc: 'Juega un eslabón de la cadena durante 36 semanas.' },
    { id: 'colas', title: 'Teoría de colas y cuellos de botella', desc: 'M/M/c, simulación en vivo y líneas en serie.' },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.sims);

const app = document.getElementById('app');
const jump = document.getElementById('jump');
jump.append(h('option', { value: '' }, 'Ir a…'), ...ALL.map((s) => h('option', { value: s.id }, s.title)));
jump.addEventListener('change', () => { if (jump.value) location.hash = '#/' + jump.value; });

let cleanup = null;
let token = 0;

function home() {
  app.replaceChildren(
    h('h1', {}, 'Simulador de conceptos económicos'),
    h('p', { class: 'intro' }, 'Ocho simulaciones interactivas de inventarios, cadena de suministro, colas y finanzas. Mueve los parámetros y observa el efecto en vivo.'),
    ...GROUPS.flatMap((g) => [
      h('h3', { class: 'group-title' }, g.name),
      h('div', { class: 'cards' }, g.sims.map((s) =>
        h('article', {}, h('h4', {}, s.title), h('p', {}, s.desc), h('a', { href: '#/' + s.id, role: 'button' }, 'Abrir')))),
    ]),
  );
  document.title = 'Simulador económico y de operaciones';
}

async function route() {
  const id = location.hash.replace(/^#\/?/, '');
  const mine = ++token;
  if (cleanup) { try { cleanup(); } catch { /* sin efecto */ } cleanup = null; }
  destroyCharts();
  jump.value = id;
  const sim = ALL.find((s) => s.id === id);
  if (!sim) { home(); return; }
  try {
    const mod = await import(`./ui/sims/${id}.js`);
    if (mine !== token) return;
    const root = h('section', { class: 'sim' });
    app.replaceChildren(h('p', {}, h('a', { href: '#/' }, '← Todas las simulaciones')), root);
    document.title = sim.title + ' · Simulador';
    cleanup = mod.default(root) || null;
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('p', { class: 'notice' }, 'No se pudo cargar la simulación: ' + e.message));
  }
}

window.addEventListener('hashchange', route);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', route);
route();
