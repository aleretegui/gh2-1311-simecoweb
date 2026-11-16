# README-handoff — Simulador de conceptos económicos y de operaciones

Documento de traspaso de **Claude Design (prototipo)** a **Claude Code Web (desarrollo)**.
Léelo completo antes de escribir código. Es la fuente de verdad de alcance, stack, lógica y despliegue.

## 1. Objetivo

Aplicación web simple, responsiva y gratuita para simular de forma dinámica (sliders y gráficos que se actualizan en vivo) conceptos de gestión de inventarios, cadena de suministro, colas y flujos de servicio. Es un prototipo educativo.

## 2. Reglas no negociables

1. **Sin compilación.** No hay `npm run build`, bundler, transpilador ni framework que requiera build. Lo que está en el repo es lo que se sube a Cloudflare.
2. **Sin CDN en producción.** Las librerías se guardan en `/vendor` con versión fija.
3. **Responsivo primero en móvil** (320 px en adelante), sin scroll horizontal de página.
4. **Lógica separada de la interfaz.** Cada modelo es un módulo JS puro (sin acceso al DOM) para poder probarlo aparte.
5. **Reproducibilidad.** Toda simulación con azar usa un generador con semilla (ver sección 5).
6. **Sin backend ni base de datos.** Todo corre en el navegador.

## 3. Stack

| Capa | Tecnología | Versión | Motivo |
|---|---|---|---|
| Estructura | HTML5 semántico | Estándar | Sin build. Una página por simulación o SPA con pestañas. |
| Estilos | Pico CSS (clásico) | 2.1.1 (verificada en npm) | Estilo semántico y responsivo sin clases. |
| Lógica | JavaScript vanilla, módulos ES (`<script type="module">`) | ES2022 | Modelos puros y testeables, sin build. |
| Interactividad | JavaScript vanilla (sin Alpine.js) | n/a | Decisión tomada: menos dependencias. Controles y gráficos se actualizan desde módulos propios. |
| Gráficos | Chart.js (bundle UMD) | 4.6.1 (verificada en npm) | Líneas, barras y series temporales dinámicas. |
| Hosting | Cloudflare Pages (subida directa) o Workers con Static Assets | Plan gratuito | Archivos estáticos, gratis en prototipo. |
| Despliegue manual | Panel de Cloudflare, o Wrangler (`pages deploy` / `deploy`) | Wrangler 4.163.0, que exige Node.js >= 22.12.0 (solo en la máquina local) | La subida desde el panel no requiere Node. |
| Repositorio | GitHub | n/a | `https://github.com/aleretegui/gh2-1311-simecoweb` |

Versiones verificadas contra el registro de npm el 2026-11-16 y anotadas en `/vendor/VERSIONS.md`.

## 4. Estructura de carpetas propuesta

```
/
├── index.html                 # Portada con las 8 simulaciones
├── README-handoff.md
├── wrangler.jsonc             # Solo si se despliega como Workers Static Assets
├── css/
│   └── app.css                # Ajustes sobre Pico
├── js/
│   ├── app.js                 # Navegación y arranque
│   ├── ui/                    # Controles, tarjetas de KPI, helpers de Chart.js
│   ├── lib/
│   │   ├── rng.js             # Generador con semilla
│   │   └── stats.js           # Normal inversa, media, desviación, percentiles
│   └── models/                # Un módulo puro por simulación
│       ├── supplyDemand.js
│       ├── compoundInterest.js
│       ├── eoq.js
│       ├── reorderPoint.js
│       ├── reviewSystems.js
│       ├── bullwhip.js
│       ├── beerGame.js
│       └── queues.js
├── pages/                     # Una página HTML por simulación (si no es SPA)
└── vendor/
    ├── chart.umd.js
    ├── alpine.min.js
    ├── pico.min.css
    └── VERSIONS.md
```

## 5. Convenciones comunes

- **Moneda y unidades:** mostrar siempre la unidad (USD, unidades, días, semanas).
- **Aleatoriedad:** implementar un PRNG con semilla (por ejemplo mulberry32). Cada simulación estocástica muestra la semilla y tiene un botón «Nueva semilla».
- **Distribución normal:** usar Box-Muller para generar y una aproximación de la normal inversa para el factor `z`.
- **Controles:** cada parámetro tiene slider + campo numérico, con rango, paso y valor por defecto (ver tablas).
- **Estado de cada simulación:** `Ejecutar`, `Pausar`, `Reiniciar` y, donde aplique, velocidad de reproducción.
- **KPIs:** tarjetas con el valor actual encima de los gráficos.
- **Accesibilidad:** etiquetas en todos los controles, contraste suficiente, gráficos con descripción de texto, soporte de modo claro y oscuro.
- **Textos:** interfaz en español. Cada simulación incluye un bloque «Qué observar» de 2 a 3 líneas.

## 6. Simulaciones

### 6.1 Oferta y demanda

**Concepto:** el precio de equilibrio surge del cruce entre oferta y demanda, y se desplaza con shocks.

**Modelo (lineal):**
- Demanda: `Qd = a − b·P`
- Oferta: `Qs = c + d·P`
- Equilibrio: `P* = (a − c) / (b + d)`, `Q* = a − b·P*`

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| a (demanda máxima) | 50–300 | 5 | 100 |
| b (sensibilidad de la demanda) | 0.5–5 | 0.1 | 2 |
| c (oferta mínima) | −50–50 | 5 | 0 |
| d (sensibilidad de la oferta) | 0.5–5 | 0.1 | 1.5 |
| Shock de demanda (Δa) | −50–50 | 5 | 0 |
| Shock de oferta (Δc) | −50–50 | 5 | 0 |
| Impuesto o subsidio por unidad | −10–10 | 0.5 | 0 |

**Salidas:** gráfico de curvas con el punto de equilibrio, tabla de P*, Q*, excedente del consumidor y del productor, y equilibrio antes y después del shock.
**Modo dinámico opcional:** ajuste de precio `P(t+1) = P(t) + k·(Qd − Qs)` con `k` entre 0.01 y 0.5.

### 6.2 Interés compuesto y decisiones financieras

**Modelo:**
- Valor futuro con aportes: `VF = P·(1+i)^n + A·[((1+i)^n − 1)/i]`, con `i` la tasa por periodo y `n` el número de periodos.
- Equivalencia efectiva: `TEA = (1 + r/m)^m − 1`.
- Valor presente neto: `VPN = Σ Ft / (1+r)^t − Inversión`.

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| Capital inicial | 0–100 000 | 100 | 10 000 |
| Aporte periódico | 0–5 000 | 50 | 200 |
| Tasa nominal anual | 0–30 % | 0.1 | 8 % |
| Capitalizaciones por año (m) | 1, 2, 4, 12, 365 | n/a | 12 |
| Horizonte (años) | 1–40 | 1 | 10 |
| Inflación anual | 0–15 % | 0.1 | 3 % |

**Salidas:** curva de crecimiento (nominal vs. real), desglose capital / aportes / intereses, y comparación de dos escenarios A y B (por ejemplo, tasa o plazo distintos). Incluir una calculadora corta de VPN para decidir entre dos proyectos.

### 6.3 Cantidad económica de pedido (EOQ)

**Modelo:**
- `EOQ = √(2·D·S / H)`
- Costo total anual: `CT(Q) = (D/Q)·S + (Q/2)·H + D·c`
- Número de pedidos: `D / Q*`. Tiempo entre pedidos: `Q* / D`.

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| Demanda anual D | 100–50 000 | 100 | 10 000 |
| Costo por pedido S | 5–500 | 5 | 50 |
| Costo de mantener H (por unidad y año) | 0.5–50 | 0.5 | 5 |
| Costo unitario c | 1–100 | 1 | 20 |
| Q elegido por el usuario | 10–5 000 | 10 | igual a EOQ |

**Salidas:** gráfico con las curvas de costo de pedido, costo de mantener y costo total con el mínimo marcado, diagrama de diente de sierra del inventario y comparación del costo con el Q elegido frente al EOQ.

### 6.4 Punto de reorden con demanda variable

**Modelo:**
- Demanda durante el plazo: media `μL = d̄·L`, desviación `σL = σd·√L`.
- Stock de seguridad: `SS = z·σL`, con `z` según el nivel de servicio.
- Punto de reorden: `ROP = d̄·L + SS`.

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| Demanda diaria media d̄ | 5–200 | 1 | 50 |
| Desviación diaria σd | 0–60 | 1 | 15 |
| Plazo de entrega L (días) | 1–30 | 1 | 7 |
| Nivel de servicio | 80–99.9 % | 0.1 | 95 % |
| Cantidad de pedido Q | 50–2 000 | 10 | 400 |
| Días a simular | 30–365 | 5 | 120 |

**Simulación diaria:** se genera la demanda diaria con distribución normal (truncada en 0). Al cruzar el ROP con inventario disponible se emite un pedido que llega tras `L` días.
**Salidas:** serie del inventario, marcas de pedidos y faltantes, nivel de servicio real obtenido, número de faltantes y stock promedio.

### 6.5 Sistemas de revisión (continua vs. periódica)

**Sistema continuo (Q, R):** se revisa cada día y se pide `Q` cuando el inventario efectivo (disponible + en tránsito) llega a `R`.
**Sistema periódico (T, S):** cada `T` días se pide `S − inventario efectivo`. Nivel objetivo: `S = d̄·(T+L) + z·σd·√(T+L)`.

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| Demanda media / desviación | igual que 6.4 | n/a | 50 / 15 |
| Plazo L (días) | 1–30 | 1 | 7 |
| Periodo de revisión T (días) | 1–30 | 1 | 7 |
| Nivel de servicio | 80–99.9 % | 0.1 | 95 % |
| Costo de pedido, de mantener y de faltante | ver 6.3 | n/a | 50 / 5 / 10 |

**Salidas:** dos gráficos de inventario lado a lado con la **misma semilla de demanda**, y una tabla comparativa de stock promedio, stock de seguridad requerido, número de pedidos, faltantes y costo total. Mensaje esperado: el sistema periódico exige más stock de seguridad porque cubre `T + L`.

### 6.6 Efecto látigo (bullwhip effect)

**Cadena:** Cliente → Minorista → Mayorista → Distribuidor → Fábrica (4 eslabones).
**Regla de pedido por eslabón:** order-up-to con pronóstico de media móvil.
- `Pronóstico_t = promedio de los últimos m periodos de la demanda recibida`
- `Pedido_t = Pronóstico_t·(L+1) + z·σ̂ − inventario efectivo`, con `Pedido ≥ 0`

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| Patrón de demanda final | constante con un escalón, aleatoria, estacional | n/a | escalón |
| Ventana del pronóstico m | 1–10 | 1 | 4 |
| Plazo entre eslabones L (periodos) | 1–5 | 1 | 2 |
| Factor de seguridad z | 0–2.5 | 0.1 | 1 |
| Compartir información de demanda | sí / no | n/a | no |
| Periodos a simular | 20–100 | 5 | 50 |

**Salidas:** gráfico con la serie de pedidos de cada eslabón sobre la demanda final, y tabla de la **razón de varianza** `Var(pedidos)/Var(demanda)` por eslabón. Con «Compartir información» activo la amplificación debe reducirse de forma visible.

### 6.7 Beer Game (versión simplificada)

**Roles:** Minorista, Mayorista, Distribuidor y Fábrica. En la versión simplificada el usuario juega **un rol** (por defecto el Minorista) y los demás los controla la computadora con una regla fija.

**Mecánica por semana:**
1. Llegan las cajas enviadas hace 2 semanas (retraso de envío).
2. Se recibe el pedido del cliente (o del eslabón siguiente) y se despacha lo posible. Lo no cubierto queda como pendiente.
3. El jugador decide cuánto pedir al eslabón anterior. El pedido llega con retraso de 2 semanas.
4. Se calculan los costos.

**Costos:** inventario 0.50 por caja y semana, pendiente 1.00 por caja y semana.
**Demanda del cliente:** 4 cajas por semana hasta la semana 4 y 8 cajas desde la semana 5.
**Inicio:** 12 cajas de inventario y 4 en cada tramo de la tubería por eslabón.
**Duración:** 36 semanas.
**Regla de la computadora:** pide lo que recibió la semana anterior más una corrección parcial del inventario hacia 12 cajas.

**Salidas:** panel con inventario, pendientes, pedidos en tránsito, costo acumulado y gráfico de pedidos. Al terminar, mostrar un resumen con el costo del jugador, la razón de varianza y un mensaje que relacione el resultado con el efecto látigo (6.6).

### 6.8 Teoría de colas y cuellos de botella

**Dos vistas:**

**A) Fórmulas analíticas M/M/c** (tasa de llegada λ, tasa de servicio μ por servidor, c servidores):
- Utilización `ρ = λ / (c·μ)`. Debe ser menor que 1 para que el sistema sea estable.
- Para M/M/1: `L = ρ/(1−ρ)`, `W = 1/(μ−λ)`, `Lq = ρ²/(1−ρ)`, `Wq = ρ/(μ−λ)`.
- Para `c > 1`, usar la probabilidad de espera de Erlang C.

**B) Simulación de eventos discretos** con llegadas exponenciales y servicio exponencial, que muestra la cola creciendo en vivo.

| Parámetro | Rango | Paso | Defecto |
|---|---|---|---|
| Tasa de llegada λ (clientes por hora) | 1–200 | 1 | 40 |
| Tasa de servicio μ por servidor (clientes por hora) | 1–100 | 1 | 15 |
| Número de servidores c | 1–10 | 1 | 3 |
| Capacidad máxima de la cola | ilimitada, 5–100 | n/a | ilimitada |
| Velocidad de simulación | 1×–50× | n/a | 10× |

**Cuellos de botella:** modo «línea de 3 estaciones en serie» con tasas de servicio distintas por estación. La estación con mayor utilización se resalta como cuello de botella y se muestra el efecto de añadir capacidad a ella frente a otra estación.
**Salidas:** utilización, longitud media de cola, tiempo medio de espera, clientes atendidos y gráfico de la cola en el tiempo. Mostrar aviso cuando `ρ ≥ 1`.

## 7. Diseño de la interfaz

- **Navegación:** portada con 8 tarjetas agrupadas en tres bloques: Mercado y finanzas (6.1, 6.2), Inventarios (6.3, 6.4, 6.5) y Cadena y colas (6.6, 6.7, 6.8).
- **Disposición de cada simulación:** controles a un lado y gráficos al otro en escritorio, y apilados en móvil con los controles arriba.
- **Gráficos:** un solo `<canvas>` por gráfico, con actualización por `chart.update()` sin recrear la instancia.
- **Rendimiento:** limitar la frecuencia de redibujo con `requestAnimationFrame` y no recalcular más de lo necesario cuando se mueve un slider.

## 8. Criterios de aceptación

- [ ] Las 8 simulaciones funcionan sin errores en consola.
- [ ] Mover un slider actualiza resultados y gráficos en menos de 200 ms.
- [ ] La misma semilla produce los mismos resultados.
- [ ] Se ve y se usa bien a 320 px, 768 px y 1280 px de ancho.
- [ ] No hay llamadas a CDN ni a servicios externos en producción.
- [ ] No existe `package.json` con scripts de build requeridos para desplegar.
- [ ] Los modelos de `/js/models` no tocan el DOM.
- [ ] Cada simulación incluye «Qué observar».
- [ ] Las versiones fijadas están en `/vendor/VERSIONS.md`.

## 9. Despliegue manual en Cloudflare

**Opción A: Cloudflare Pages con subida directa (sin Node).**
1. En el panel de Cloudflare: Workers & Pages → Create → Pages → Upload assets.
2. Nombra el proyecto y sube la carpeta del repositorio (sin `.git`).
3. Cloudflare publica en `https://<proyecto>.pages.dev`.

**Opción B: Wrangler (requiere Node.js 22.12 o superior en tu máquina).**
```bash
npx wrangler pages deploy . --project-name=<proyecto>
```

**Opción C: Workers con Static Assets.** Añade un `wrangler.jsonc` mínimo y ejecuta `npx wrangler deploy`:
```jsonc
{
  "name": "simecoweb",
  "compatibility_date": "2026-11-01",
  "assets": { "directory": "./" }
}
```
Si usas esta opción, excluye del despliegue archivos que no deban publicarse (por ejemplo, este README o `.git`) moviendo el sitio a una carpeta `public/` y apuntando `directory` a ella.

**Nota:** al no haber compilación, la variable `NODE_VERSION` de Cloudflare no aplica. Si algún día se conecta Git a Pages, fija la versión de Node explícitamente.

## 10. Orden de trabajo sugerido para Claude Code Web

1. Crear la estructura de carpetas, la portada y descargar las librerías a `/vendor` con versiones verificadas.
2. Implementar `lib/rng.js` y `lib/stats.js` con pruebas rápidas.
3. Construir las simulaciones de menor a mayor complejidad: 6.3, 6.1, 6.2, 6.4, 6.5, 6.6, 6.8 y 6.7.
4. Revisar responsividad y accesibilidad.
5. Hacer commit en `main` y desplegar de forma manual siguiendo la sección 9.

## 11. Estado de la implementación y supuestos

**Implementado (SPA con enrutado por hash, sin build):** las 8 simulaciones, con modelos puros en `js/models/` e interfaz en `js/ui/sims/`.

Decisiones que difieren del borrador inicial:
- Es una SPA (`index.html` + rutas `#/<id>`), no varias páginas HTML. No hay carpeta `pages/`.
- No se usa Alpine.js.
- Chart.js 4.6.1 y Pico CSS 2.1.1, vendorizados en `/vendor`.
- Los controles Ejecutar / Pausar / Reiniciar existen en las simulaciones que avanzan en el tiempo (6.4, 6.5, 6.6 y 6.8 estación única). Las demás se recalculan al mover un parámetro; el Beer Game avanza semana a semana con el botón «Enviar pedido».
- Beer Game: el pedido llega al proveedor la semana siguiente y el envío tarda 2 semanas. La computadora pide `pedido recibido + 0,25 × (12 − inventario neto)`.
- Interés compuesto: el aporte es mensual y la tasa efectiva mensual se deriva de la nominal y de las capitalizaciones por año.
- Punto de reorden y sistemas de revisión: las ventas no atendidas se pierden (no hay pendientes).
- Colas: horizonte fijo de 8 horas simuladas.

Para probar en local hace falta un servidor estático (los módulos ES no cargan con `file://`), por ejemplo `python3 -m http.server 8765` desde la raíz.

**Pendiente de validar con el equipo:** parámetros y rangos por defecto, y el aspecto visual definitivo de Claude Design.
