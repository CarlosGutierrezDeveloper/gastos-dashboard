// calculations.js
// Toda la lógica de negocio: cálculo de cashback, columnas derivadas,
// KPIs, comparativos mensuales y agrupaciones para las gráficas.
// Las columnas derivadas (Año, Mes, Mes-Año, etc.) NO se guardan en Airtable:
// se calculan aquí en tiempo real a partir de "Fecha", para evitar datos
// duplicados/desincronizados (buena práctica de normalización).

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const CASHBACK_RAPPI_RATE = 0.01; // 1%
export const CASHBACK_BB_RATE = 0.05; // 5%

export const CATEGORIAS = [
  { nombre: 'Comida', color: '#22c55e' },
  { nombre: 'Transporte', color: '#06b6d4' },
  { nombre: 'Entretenimiento', color: '#f59e0b' },
  { nombre: 'Compras', color: '#ef4444' },
  { nombre: 'Servicios', color: '#8b5cf6' },
  { nombre: 'Otros', color: '#9ca3af' },
];

export function colorForCategoria(nombre) {
  return CATEGORIAS.find((c) => c.nombre === nombre)?.color || '#9ca3af';
}

// Añade todas las columnas derivadas + cashback a un registro crudo de Airtable
export function enrich(record) {
  const [y, m, d] = (record.fecha || '1970-01-01').split('-').map(Number);
  const cashbackRappi = record.aplicaCashback ? record.valor * CASHBACK_RAPPI_RATE : 0;
  const cashbackBB = record.aplicaCashback ? record.valor * CASHBACK_BB_RATE : 0;
  return {
    ...record,
    year: y,
    month: m,
    day: d,
    monthName: MESES[m - 1] || '',
    monthYear: `${MESES[m - 1] || ''} ${y}`,
    yearMonthKey: `${y}-${String(m).padStart(2, '0')}`,
    cashbackRappi,
    cashbackBB,
    cashbackTotal: cashbackRappi + cashbackBB,
  };
}

export function enrichAll(records) {
  return records
    .map(enrich)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

export function sum(records, key) {
  return records.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

export function filterByYearMonth(records, year, month) {
  return records.filter((r) => r.year === year && r.month === month);
}

export function filterByYear(records, year) {
  return records.filter((r) => r.year === year);
}

export function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function previousPeriod(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// Diferencia = gasto del mes anterior - gasto del mes actual
// (positivo => se gastó MENOS que el mes anterior = ahorro)
export function diferenciaYVariacion(gastoAnterior, gastoActual) {
  const diferencia = gastoAnterior - gastoActual;
  const variacion = gastoAnterior !== 0 ? diferencia / gastoAnterior : null;
  return { diferencia, variacion };
}

// KPIs de cabecera: SIEMPRE referidos al mes calendario real actual vs el anterior,
// independientemente de los filtros del dashboard (así lo define la regla de negocio).
export function computeHeaderKPIs(allRecords) {
  const { year, month } = currentPeriod();
  const prev = previousPeriod(year, month);
  const actual = filterByYearMonth(allRecords, year, month);
  const anterior = filterByYearMonth(allRecords, prev.year, prev.month);

  const gastoActual = sum(actual, 'valor');
  const gastoAnterior = sum(anterior, 'valor');
  const { diferencia, variacion } = diferenciaYVariacion(gastoAnterior, gastoActual);

  return {
    year, month,
    prevYear: prev.year, prevMonth: prev.month,
    gastoActual,
    gastoAnterior,
    diferencia,
    variacion,
    cashbackRappiMes: sum(actual, 'cashbackRappi'),
    cashbackBBMes: sum(actual, 'cashbackBB'),
    cashbackTotalAcumulado: sum(allRecords, 'cashbackTotal'),
    numCompras: actual.length,
    ticketPromedio: actual.length ? gastoActual / actual.length : 0,
  };
}

// Para la sección "Consulta por mes y año": compara CUALQUIER mes/año
// seleccionado por el usuario contra el mes inmediatamente anterior a ese.
export function computeMonthComparison(allRecords, year, month) {
  const prev = previousPeriod(year, month);
  const sel = filterByYearMonth(allRecords, year, month);
  const prevRecs = filterByYearMonth(allRecords, prev.year, prev.month);

  const gastoSel = sum(sel, 'valor');
  const gastoPrev = sum(prevRecs, 'valor');
  const { diferencia, variacion } = diferenciaYVariacion(gastoPrev, gastoSel);

  return {
    gastoSel,
    gastoPrev,
    diferencia,
    variacion,
    cashbackTotal: sum(sel, 'cashbackTotal'),
    cashbackRappi: sum(sel, 'cashbackRappi'),
    cashbackBB: sum(sel, 'cashbackBB'),
    numCompras: sel.length,
    ticketPromedio: sel.length ? gastoSel / sel.length : 0,
    prevLabel: `${MESES[prev.month - 1]} ${prev.year}`,
    selLabel: `${MESES[month - 1]} ${year}`,
  };
}

// Agrupa y suma un valor por una llave arbitraria (día, mes, año, comercio...)
function groupSum(records, keyFn, valueKey = 'valor') {
  const map = new Map();
  for (const r of records) {
    const k = keyFn(r);
    map.set(k, (map.get(k) || 0) + (Number(r[valueKey]) || 0));
  }
  return map;
}

export function gastoPorDia(records) {
  const map = groupSum(records, (r) => r.fecha, 'valor');
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

export function gastoPorMes(records) {
  const map = groupSum(records, (r) => r.yearMonthKey, 'valor');
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

export function gastoPorAno(records) {
  const map = groupSum(records, (r) => r.year, 'valor');
  return [...map.entries()].sort(([a], [b]) => a - b);
}

// Cashback acumulado (running total) agrupado por día, mes o año
export function cashbackAcumulado(records, granularidad = 'day') {
  const keyFn =
    granularidad === 'year' ? (r) => String(r.year)
    : granularidad === 'month' ? (r) => r.yearMonthKey
    : (r) => r.fecha;

  const map = groupSum(records, keyFn, 'cashbackTotal');
  const sorted = [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let running = 0;
  return sorted.map(([key, val]) => {
    running += val;
    return [key, running];
  });
}

// Ranking de comercios por gasto total (para Top N, donut y tabla detalle)
export function rankingComercios(records, topN = 10) {
  const map = new Map();
  for (const r of records) {
    const key = r.comercio || '(Sin comercio)';
    const cur = map.get(key) || { comercio: key, total: 0, compras: 0, cashback: 0 };
    cur.total += r.valor;
    cur.compras += 1;
    cur.cashback += r.cashbackTotal;
    map.set(key, cur);
  }
  const all = [...map.values()].sort((a, b) => b.total - a.total);
  const totalGeneral = sum(records, 'valor');
  const top = all.slice(0, topN);
  const resto = all.slice(topN);
  const restoTotal = sum(resto, 'total');

  return {
    all: all.map((c) => ({ ...c, participacion: totalGeneral ? c.total / totalGeneral : 0 })),
    top,
    resto: restoTotal,
    totalGeneral,
  };
}

// Agrupa el gasto por categoría (para el donut y el detalle de "Participación por Categoría").
// A diferencia de rankingComercios, aquí no hay Top N / "Otros": las categorías son un
// conjunto fijo y pequeño (ver CATEGORIAS), así que se muestran todas.
export function gastoPorCategoria(records) {
  const map = new Map();
  for (const r of records) {
    const key = r.categoria || 'Otros';
    const cur = map.get(key) || { categoria: key, total: 0, compras: 0, cashback: 0 };
    cur.total += r.valor;
    cur.compras += 1;
    cur.cashback += r.cashbackTotal;
    map.set(key, cur);
  }
  const totalGeneral = sum(records, 'valor');
  const all = [...map.values()]
    .map((c) => ({ ...c, participacion: totalGeneral ? c.total / totalGeneral : 0 }))
    .sort((a, b) => b.total - a.total);

  return { all, totalGeneral };
}

export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

export function formatPct(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor);
}

export function formatFechaLarga(fechaISO) {
  if (!fechaISO) return '';
  const [y, m, d] = fechaISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}