// charts.js
// Encapsula la creación/actualización de todas las gráficas con Chart.js.
// Colores: tonos cálidos para gasto, tonos verdes para cashback.

import { MESES, colorForCategoria } from './calculations.js';

const instances = {};

const COLOR_GASTO = '#f97316'; // naranja cálido
const COLOR_GASTO_FILL = 'rgba(249, 115, 22, 0.15)';
const COLOR_CASHBACK = '#22c55e'; // verde
const COLOR_CASHBACK_FILL = 'rgba(34, 197, 94, 0.15)';
const COLOR_GRID = 'rgba(255,255,255,0.06)';
const COLOR_TEXT = '#9ca3af';

const BASE_FONT = { family: "'Inter', system-ui, sans-serif", size: 11 };

function destroyIfExists(id) {
  if (instances[id]) {
    instances[id].destroy();
    delete instances[id];
  }
}

function baseScales(yFormatter) {
  return {
    x: {
      grid: { color: COLOR_GRID, drawTicks: false },
      ticks: { color: COLOR_TEXT, font: BASE_FONT, maxRotation: 0, autoSkip: true },
      border: { display: false },
    },
    y: {
      grid: { color: COLOR_GRID, drawTicks: false },
      ticks: {
        color: COLOR_TEXT,
        font: BASE_FONT,
        callback: yFormatter || undefined,
      },
      border: { display: false },
      beginAtZero: true,
    },
  };
}

function compactCOP(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export function renderGastoDiario(canvasId, dataPairs) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = dataPairs.map(([fecha]) => fecha.slice(5)); // MM-DD
  const values = dataPairs.map(([, v]) => v);

  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Gasto diario',
        data: values,
        borderColor: COLOR_GASTO,
        backgroundColor: COLOR_GASTO_FILL,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => compactCOP(c.parsed.y) },
        },
      },
      scales: baseScales(compactCOP),
    },
  });
}

export function renderCashbackAcumulado(canvasId, dataPairs, granularidad) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = dataPairs.map(([key]) => formatLabel(key, granularidad));
  const values = dataPairs.map(([, v]) => v);

  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cashback acumulado',
        data: values,
        borderColor: COLOR_CASHBACK,
        backgroundColor: COLOR_CASHBACK_FILL,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => compactCOP(c.parsed.y) } },
      },
      scales: baseScales(compactCOP),
    },
  });
}

function formatLabel(key, granularidad) {
  if (granularidad === 'year') return key;
  if (granularidad === 'month') {
    const [y, m] = key.split('-');
    return `${MESES[Number(m) - 1].slice(0, 3)} ${y.slice(2)}`;
  }
  return key.slice(5); // day -> MM-DD
}

export function renderComparativoMensual(canvasId, dataPairs) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = dataPairs.map(([key]) => {
    const [y, m] = key.split('-');
    return `${MESES[Number(m) - 1].slice(0, 3)} ${y.slice(2)}`;
  });
  const values = dataPairs.map(([, v]) => v);

  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Gasto mensual',
        data: values,
        backgroundColor: COLOR_GASTO,
        borderRadius: 6,
        maxBarThickness: 34,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => compactCOP(c.parsed.y) } },
      },
      scales: baseScales(compactCOP),
    },
  });
}

export function renderComparativoAnual(canvasId, dataPairs) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = dataPairs.map(([y]) => String(y));
  const values = dataPairs.map(([, v]) => v);

  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Gasto anual',
        data: values,
        backgroundColor: '#fb923c',
        borderRadius: 6,
        maxBarThickness: 48,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => compactCOP(c.parsed.y) } },
      },
      scales: baseScales(compactCOP),
    },
  });
}

export function renderTopComercios(canvasId, top) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = top.map((c) => c.comercio);
  const values = top.map((c) => c.total);

  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Gasto total',
        data: values,
        backgroundColor: '#f97316',
        borderRadius: 6,
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => compactCOP(c.parsed.x) } },
      },
      scales: {
        x: { grid: { color: COLOR_GRID }, ticks: { color: COLOR_TEXT, font: BASE_FONT, callback: compactCOP }, border: { display: false } },
        y: { grid: { display: false }, ticks: { color: '#e5e7eb', font: BASE_FONT }, border: { display: false } },
      },
    },
  });
}

// Fuente exacta usada en style.css (regla html, body) — se usa aquí para que
// el texto dibujado en canvas (leyenda y % dentro del donut) coincida con la
// tipografía real del resto del dashboard, en vez de depender del fallback
// genérico "system-ui".
const DONUT_FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Porcentaje mínimo (sobre el total) que debe tener una rebanada para que su
// etiqueta se dibuje dentro del donut. Evita saturar el gráfico cuando hay
// categorías con participación casi nula (la info sigue disponible en la
// leyenda y en el tooltip).
const MIN_SLICE_LABEL_PERCENT = 0.035; // 3.5%

// Plugin propio de Chart.js: dibuja el % de cada categoría centrado sobre su
// rebanada del donut. Se registra solo en este gráfico (no de forma global).
const percentLabelsPlugin = {
  id: 'percentLabelsCategorias',
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((a, b) => a + b, 0);
    if (!total) return;

    const { ctx } = chart;
    ctx.save();
    meta.data.forEach((arc, i) => {
      if (arc.hidden) return;
      const value = dataset.data[i];
      const pct = value / total;
      if (pct < MIN_SLICE_LABEL_PERCENT) return;

      const { startAngle, endAngle, innerRadius, outerRadius, x, y } = arc.getProps(
        ['startAngle', 'endAngle', 'innerRadius', 'outerRadius', 'x', 'y'],
        true,
      );
      const midAngle = (startAngle + endAngle) / 2;
      const midRadius = (innerRadius + outerRadius) / 2;
      const px = x + Math.cos(midAngle) * midRadius;
      const py = y + Math.sin(midAngle) * midRadius;

      const label = `${(pct * 100).toFixed(1)}%`;
      ctx.font = `13px ${DONUT_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Contorno oscuro para que el % se lea bien sobre cualquier color de fondo
      // (la tabla no lo necesita porque su fondo es siempre uniforme)
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(label, px, py);
      ctx.fillStyle = '#f4f4f5';
      ctx.fillText(label, px, py);
    });
    ctx.restore();
  },
};

export function renderDonutCategorias(canvasId, categorias) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = categorias.map((c) => c.categoria);
  const values = categorias.map((c) => c.total);
  const colors = categorias.map((c) => colorForCategoria(c.categoria));
  const total = values.reduce((a, b) => a + b, 0);

  instances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#0d0d0d',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f4f4f5',
            font: { family: DONUT_FONT_FAMILY, size: 13.5, weight: '600' },
            boxWidth: 10,
            padding: 10,
            // Leyenda detallada: nombre de categoría + su % de participación
            generateLabels: (chart) => {
              const { data } = chart;
              const meta = chart.getDatasetMeta(0);
              return data.labels.map((label, i) => {
                const style = meta.controller.getStyle(i, true);
                const value = data.datasets[0].data[i];
                const pct = total ? (value / total) * 100 : 0;
                return {
                  text: `${label}  ·  ${pct.toFixed(1)}%`,
                  fillStyle: style.backgroundColor,
                  strokeStyle: style.borderColor,
                  lineWidth: style.borderWidth,
                  pointStyle: style.pointStyle,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const pct = total ? (c.parsed / total) * 100 : 0;
              return `${c.label}: ${compactCOP(c.parsed)} (${pct.toFixed(1)}%)`;
            },
          },
        },
      },
    },
    plugins: [percentLabelsPlugin],
  });
}
