// charts.js
// Encapsula la creación/actualización de todas las gráficas con Chart.js.
// Colores: tonos cálidos para gasto, tonos verdes para cashback.

import { MESES } from './calculations.js';

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

const DONUT_PALETTE = ['#22c55e', '#f97316', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#eab308', '#14b8a6', '#ec4899', '#64748b'];

export function renderDonutComercios(canvasId, top, resto) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  const labels = [...top.map((c) => c.comercio), ...(resto > 0 ? ['Otros'] : [])];
  const values = [...top.map((c) => c.total), ...(resto > 0 ? [resto] : [])];

  instances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => DONUT_PALETTE[i % DONUT_PALETTE.length]),
        borderColor: '#0d0d0d',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e5e7eb', font: BASE_FONT, boxWidth: 10, padding: 10 },
        },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${compactCOP(c.parsed)}` } },
      },
    },
  });
}
