// ui.js
// Renderizado del DOM, manejo de filtros, modales y orquestación de CRUD.

import { getConfig, saveConfig, isConfigured } from './config.js';
import * as Airtable from './airtable.js';
import {
  MESES, CATEGORIAS, colorForCategoria, enrichAll,
  computeHeaderKPIs, computeMonthComparison,
  gastoPorDia, gastoPorMes, gastoPorAno, cashbackAcumulado, rankingComercios, gastoPorCategoria,
  formatCOP, formatPct, formatFechaLarga, currentPeriod,
} from './calculations.js';
import * as Charts from './charts.js';

// ---------- ESTADO GLOBAL DE LA APP ----------
let allRecords = [];          // registros enriquecidos, todo el histórico
let cashbackGranularity = 'day';
let editingId = null;
let deletingId = null;
let sortState = { key: 'fecha', dir: 'desc' };

const $ = (id) => document.getElementById(id);

// ---------- HELPERS DE UI ----------
function showToast(message, type = 'success') {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function showLoading(show, text = 'Cargando datos...') {
  $('loadingText').textContent = text;
  $('loadingOverlay').classList.toggle('hidden', !show);
}

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

// ---------- FILTROS ----------
function currentFilters() {
  return {
    year: $('filterYear').value,
    month: $('filterMonth').value,
    from: $('filterFrom').value,
    to: $('filterTo').value,
    comercio: $('filterComercio').value.trim().toLowerCase(),
    categoria: $('filterCategoria').value,
    min: $('filterMin').value,
    max: $('filterMax').value,
    topN: Number($('filterTopN').value) || 10,
  };
}

function applyFilters(records) {
  const f = currentFilters();
  return records.filter((r) => {
    if (f.year && String(r.year) !== f.year) return false;
    if (f.month && String(r.month) !== f.month) return false;
    if (f.from && r.fecha < f.from) return false;
    if (f.to && r.fecha > f.to) return false;
    if (f.comercio && !r.comercio.toLowerCase().includes(f.comercio)) return false;
    if (f.categoria && r.categoria !== f.categoria) return false;
    if (f.min && r.valor < Number(f.min)) return false;
    if (f.max && r.valor > Number(f.max)) return false;
    return true;
  });
}

function populateFilterOptions() {
  const years = [...new Set(allRecords.map((r) => r.year))].sort((a, b) => b - a);

  const yearSel = $('filterYear');
  const curYearVal = yearSel.value;
  yearSel.innerHTML = '<option value="">Todos</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');
  yearSel.value = years.includes(Number(curYearVal)) ? curYearVal : '';

  const monthSel = $('filterMonth');
  if (!monthSel.dataset.filled) {
    monthSel.innerHTML = '<option value="">Todos</option>' + MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    monthSel.dataset.filled = '1';
  }

  const catSel = $('filterCategoria');
  if (!catSel.dataset.filled) {
    catSel.innerHTML = '<option value="">Todas</option>' + CATEGORIAS.map((c) => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    catSel.dataset.filled = '1';
  }

  // Selects de la sección "Consulta por mes y año"
  const qYear = $('queryYear');
  const curQYear = qYear.value;
  qYear.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  if (years.includes(Number(curQYear))) qYear.value = curQYear;
  else if (years.includes(currentPeriod().year)) qYear.value = currentPeriod().year;
  else if (years.length) qYear.value = years[0];

  const qMonth = $('queryMonth');
  if (!qMonth.dataset.filled) {
    qMonth.innerHTML = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    qMonth.dataset.filled = '1';
    qMonth.value = currentPeriod().month;
  }
}

// ---------- KPI HEADER ----------
function kpiCardHTML({ icon, label, value, sub, subClass, cls }) {
  return `
  <div class="kpi-card ${cls || ''}">
    <div class="kpi-card-top">
      <span class="kpi-label">${label}</span>
      <span class="kpi-icon">${icon}</span>
    </div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub ${subClass || ''}">${sub}</div>` : ''}
  </div>`;
}

function trendSub(diferencia, { positivoEsBueno = true } = {}) {
  if (diferencia === 0) return { text: 'Igual que el periodo anterior', cls: '' };
  const bajoElGasto = diferencia > 0; // diferencia = anterior - actual > 0 => se gastó menos
  const bueno = positivoEsBueno ? bajoElGasto : !bajoElGasto;
  const arrow = bajoElGasto ? '▼' : '▲';
  const texto = bajoElGasto ? 'Gastaste menos que el periodo anterior' : 'Gastaste más que el periodo anterior';
  return { text: `${arrow} ${texto}`, cls: bueno ? 'positive' : 'negative' };
}

function renderKPIHeader() {
  const k = computeHeaderKPIs(allRecords);
  const dif = trendSub(k.diferencia);
  const varSub = k.variacion === null ? { text: 'Sin datos del mes anterior', cls: '' } : trendSub(k.diferencia);

  const cards = [
    kpiCardHTML({ icon: '💸', cls: 'gasto', label: `Gasto ${MESES[k.month - 1]} ${k.year}`, value: formatCOP(k.gastoActual), sub: `${k.numCompras} compras este mes` }),
    kpiCardHTML({ icon: '📅', cls: 'gasto', label: `Gasto ${MESES[k.prevMonth - 1]} ${k.prevYear}`, value: formatCOP(k.gastoAnterior) }),
    kpiCardHTML({ icon: '⚖️', label: 'Diferencia vs mes anterior', value: formatCOP(k.diferencia), sub: dif.text, subClass: dif.cls }),
    kpiCardHTML({ icon: '%', label: 'Variación mensual', value: formatPct(k.variacion), sub: varSub.text, subClass: varSub.cls }),
    kpiCardHTML({ icon: '🛵', cls: 'cashback', label: 'Cashback Rappi (mes)', value: formatCOP(k.cashbackRappiMes) }),
    kpiCardHTML({ icon: '🏦', cls: 'cashback', label: 'Cashback Banco de Bogotá (mes)', value: formatCOP(k.cashbackBBMes) }),
    kpiCardHTML({ icon: '🟢', cls: 'cashback', label: 'Cashback total acumulado', value: formatCOP(k.cashbackTotalAcumulado), sub: 'Histórico completo' }),
    kpiCardHTML({ icon: '🎟️', label: 'Ticket promedio (mes)', value: formatCOP(k.ticketPromedio) }),
  ];
  $('kpiGrid').innerHTML = cards.join('');
}

// ---------- CONSULTA POR MES Y AÑO ----------
function renderQueryResult() {
  const year = Number($('queryYear').value);
  const month = Number($('queryMonth').value);
  if (!year || !month) { $('queryResult').innerHTML = ''; return; }

  const r = computeMonthComparison(allRecords, year, month);
  const dif = trendSub(r.diferencia);
  const varSub = r.variacion === null ? { text: 'Sin datos del mes anterior', cls: '' } : trendSub(r.diferencia);

  $('queryResult').innerHTML = [
    kpiCardHTML({ icon: '💸', cls: 'gasto', label: `Gasto de ${r.selLabel}`, value: formatCOP(r.gastoSel), sub: `${r.numCompras} compras` }),
    kpiCardHTML({ icon: '📅', cls: 'gasto', label: `Gasto de ${r.prevLabel}`, value: formatCOP(r.gastoPrev) }),
    kpiCardHTML({ icon: '⚖️', label: 'Diferencia', value: formatCOP(r.diferencia), sub: dif.text, subClass: dif.cls }),
    kpiCardHTML({ icon: '%', label: 'Variación %', value: formatPct(r.variacion), sub: varSub.text, subClass: varSub.cls }),
    kpiCardHTML({ icon: '🟢', cls: 'cashback', label: `Cashback de ${r.selLabel}`, value: formatCOP(r.cashbackTotal) }),
    kpiCardHTML({ icon: '🎟️', label: 'Ticket promedio', value: formatCOP(r.ticketPromedio) }),
  ].join('');
}

// ---------- GRÁFICAS ----------
function renderCharts(filtered) {
  Charts.renderGastoDiario('chartGastoDiario', gastoPorDia(filtered));
  Charts.renderCashbackAcumulado('chartCashbackAcumulado', cashbackAcumulado(filtered, cashbackGranularity), cashbackGranularity);
  Charts.renderComparativoMensual('chartComparativoMensual', gastoPorMes(filtered));
  Charts.renderComparativoAnual('chartComparativoAnual', gastoPorAno(filtered));

  const { topN } = currentFilters();
  const ranking = rankingComercios(filtered, topN);
  Charts.renderTopComercios('chartTopComercios', ranking.top);
  renderComerciosTable(ranking.all);

  const categorias = gastoPorCategoria(filtered);
  Charts.renderDonutCategorias('chartDonutCategorias', categorias.all);
}

function renderComerciosTable(all) {
  const tbody = document.querySelector('#tableComercios tbody');
  if (!all.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted-text">Sin datos para los filtros actuales.</td></tr>`;
    return;
  }
  tbody.innerHTML = all.map((c) => `
    <tr>
      <td>${escapeHtml(c.comercio)}</td>
      <td class="value-gasto">${formatCOP(c.total)}</td>
      <td>${c.compras}</td>
      <td class="value-cashback">${formatCOP(c.cashback)}</td>
      <td>${formatPct(c.participacion)}</td>
    </tr>`).join('');
}

// ---------- TABLA DE MOVIMIENTOS ----------
function sortRecords(records) {
  const { key, dir } = sortState;
  const mult = dir === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => {
    if (a[key] < b[key]) return -1 * mult;
    if (a[key] > b[key]) return 1 * mult;
    return 0;
  });
}

function renderMovimientosTable(filtered) {
  const sorted = sortRecords(filtered);
  $('movimientosCount').textContent = `${sorted.length} movimiento${sorted.length === 1 ? '' : 's'}`;
  const tbody = $('movimientosBody');

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted-text">No hay movimientos que coincidan con los filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((r) => `
    <tr>
      <td>${formatFechaLarga(r.fecha)}</td>
      <td>${escapeHtml(r.comercio)}</td>
      <td><span class="cat-badge"><span class="cat-dot" style="background:${colorForCategoria(r.categoria)}"></span>${r.categoria}</span></td>
      <td class="value-gasto">${formatCOP(r.valor)}</td>
      <td class="value-cashback">${formatCOP(r.cashbackRappi)}</td>
      <td class="value-cashback">${formatCOP(r.cashbackBB)}</td>
      <td class="value-cashback">${formatCOP(r.cashbackTotal)}</td>
      <td>${r.monthName}</td>
      <td>${r.year}</td>
      <td>
        <div class="row-actions">
          <button class="edit-btn" data-id="${r.id}" title="Editar">✎</button>
          <button class="del-btn" data-id="${r.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.edit-btn').forEach((btn) => btn.addEventListener('click', () => openEditExpense(btn.dataset.id)));
  tbody.querySelectorAll('.del-btn').forEach((btn) => btn.addEventListener('click', () => openDeleteConfirm(btn.dataset.id)));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- RENDER GENERAL ----------
function renderAll() {
  populateFilterOptions();
  renderKPIHeader();
  const filtered = applyFilters(allRecords);
  renderCharts(filtered);
  renderMovimientosTable(filtered);
  renderQueryResult();
}

// ---------- CARGA DE DATOS ----------
async function loadData() {
  showLoading(true, 'Cargando datos desde Airtable...');
  try {
    const raw = await Airtable.fetchAllRecords();
    allRecords = enrichAll(raw);
    renderAll();
  } catch (err) {
    showToast(`Error al cargar datos: ${err.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

// ---------- DROPDOWN PERSONALIZADO DE CATEGORÍA ----------
function buildCategoriaDropdown() {
  const menu = $('fCategoriaMenu');
  menu.innerHTML = CATEGORIAS.map((c) => `
    <div class="dropdown-option" data-value="${c.nombre}">
      <span class="cat-dot" style="background:${c.color}"></span>${c.nombre}
    </div>`).join('');

  menu.querySelectorAll('.dropdown-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      setCategoriaValue(opt.dataset.value);
      menu.classList.add('hidden');
    });
  });

  $('fCategoriaTrigger').addEventListener('click', () => menu.classList.toggle('hidden'));
  document.addEventListener('click', (e) => {
    if (!$('fCategoriaDropdown').contains(e.target)) menu.classList.add('hidden');
  });
}

function setCategoriaValue(nombre) {
  $('fCategoria').value = nombre;
  $('fCategoriaLabel').textContent = nombre;
  $('fCategoriaLabel').classList.remove('muted-text');
  const dot = $('fCategoriaDot');
  dot.style.background = colorForCategoria(nombre);
  dot.classList.remove('hidden');
  $('fCategoriaMenu').querySelectorAll('.dropdown-option').forEach((o) => {
    o.classList.toggle('selected', o.dataset.value === nombre);
  });
}

// ---------- MODAL: AGREGAR / EDITAR GASTO ----------

// Helpers para formato de miles sin decimales en el input Monto
function parseMontoInput(str) {
  const digits = String(str || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}
function formatMontoDisplay(num) {
  if (!num || Number.isNaN(num)) return '';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num);
}
function attachMontoFormatter(inputEl) {
  inputEl.addEventListener('input', () => {
    const n = parseMontoInput(inputEl.value);
    inputEl.value = n ? formatMontoDisplay(n) : '';
  });
}


function resetExpenseForm() {
  editingId = null;
  $('fId').value = '';
  $('fValor').value = '';
  $('fComercio').value = '';
  $('fFecha').value = new Date().toISOString().slice(0, 10);
  $('fAplicaCashback').checked = true;
  setCategoriaValue(CATEGORIAS[0].nombre);
  $('expenseModalTitle').textContent = 'Agregar Nuevo Gasto';
  $('expenseSubmitBtn').textContent = 'Agregar Gasto';
  $('expenseFormError').classList.add('hidden');
}

function openAddExpense() {
  resetExpenseForm();
  openModal('expenseModal');
}

function openEditExpense(id) {
  const r = allRecords.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  $('fId').value = id;
  $('fValor').value = r.valor;
  $('fComercio').value = r.comercio;
  $('fFecha').value = r.fecha;
  $('fAplicaCashback').checked = r.aplicaCashback;
  setCategoriaValue(r.categoria);
  $('expenseModalTitle').textContent = 'Editar Gasto';
  $('expenseSubmitBtn').textContent = 'Guardar Cambios';
  $('expenseFormError').classList.add('hidden');
  openModal('expenseModal');
}

async function handleExpenseSubmit(e) {
  e.preventDefault();
  const errEl = $('expenseFormError');
  errEl.classList.add('hidden');
  const valor = parseMontoInput($('fValor').value);
  const comercio = $('fComercio').value.trim();
  const categoria = $('fCategoria').value;
  const fecha = $('fFecha').value;
  const aplicaCashback = $('fAplicaCashback').checked;

  if (!valor || valor <= 0) return showFormError(errEl, 'Ingresa un monto válido mayor a 0.');
  if (!comercio) return showFormError(errEl, 'Ingresa el nombre del comercio.');
  if (!categoria) return showFormError(errEl, 'Selecciona una categoría.');
  if (!fecha) return showFormError(errEl, 'Selecciona una fecha.');

  const fields = { valor, comercio, categoria, fecha, aplicaCashback };

  showLoading(true, editingId ? 'Guardando cambios...' : 'Agregando gasto...');
  try {
    if (editingId) {
      const updated = await Airtable.updateRecord(editingId, fields);
      const idx = allRecords.findIndex((r) => r.id === editingId);
      allRecords[idx] = { ...updated };
      allRecords = enrichAll(allRecords.map((r) => ({ ...r })));
      showToast('Gasto actualizado correctamente.');
    } else {
      const created = await Airtable.createRecord(fields);
      allRecords = enrichAll([...allRecords, created]);
      showToast('Gasto agregado correctamente.');
    }
    closeModal('expenseModal');
    renderAll();
  } catch (err) {
    showFormError(errEl, `No se pudo guardar: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ---------- MODAL: CONFIRMAR ELIMINAR ----------
function openDeleteConfirm(id) {
  const r = allRecords.find((x) => x.id === id);
  deletingId = id;
  $('confirmModalText').textContent = r
    ? `Vas a eliminar el gasto de ${formatCOP(r.valor)} en "${r.comercio}" (${formatFechaLarga(r.fecha)}). Esta acción no se puede deshacer.`
    : 'Esta acción no se puede deshacer.';
  openModal('confirmModal');
}

async function handleConfirmDelete() {
  if (!deletingId) return;
  showLoading(true, 'Eliminando...');
  try {
    await Airtable.deleteRecord(deletingId);
    allRecords = allRecords.filter((r) => r.id !== deletingId);
    showToast('Movimiento eliminado.');
    closeModal('confirmModal');
    renderAll();
  } catch (err) {
    showToast(`Error al eliminar: ${err.message}`, 'error');
  } finally {
    showLoading(false);
    deletingId = null;
  }
}

// ---------- MODAL: CONFIGURACIÓN AIRTABLE ----------
function fillConfigForm() {
  const cfg = getConfig();
  if (cfg) {
    $('cfgToken').value = cfg.token || '';
    $('cfgBaseId').value = cfg.baseId || '';
    $('cfgTableName').value = cfg.tableName || 'Gastos';
  }
}

async function handleTestConnection() {
  const errEl = $('cfgError'); const okEl = $('cfgSuccess');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const token = $('cfgToken').value.trim();
  const baseId = $('cfgBaseId').value.trim();
  const tableName = $('cfgTableName').value.trim();
  if (!token || !baseId || !tableName) return showFormError(errEl, 'Completa los tres campos antes de probar.');

  $('cfgTestBtn').textContent = 'Probando...';
  try {
    await Airtable.testConnection({ token, baseId, tableName });
    okEl.textContent = '✓ Conexión exitosa.';
    okEl.classList.remove('hidden');
  } catch (err) {
    showFormError(errEl, `No se pudo conectar: ${err.message}`);
  } finally {
    $('cfgTestBtn').textContent = 'Probar conexión';
  }
}

async function handleSaveConfig() {
  const errEl = $('cfgError');
  errEl.classList.add('hidden');
  const token = $('cfgToken').value.trim();
  const baseId = $('cfgBaseId').value.trim();
  const tableName = $('cfgTableName').value.trim();
  if (!token || !baseId || !tableName) return showFormError(errEl, 'Completa los tres campos.');

  saveConfig({ token, baseId, tableName });
  closeModal('configModal');
  await loadData();
}

// ---------- FILTROS: EVENTOS ----------
function wireFilters() {
  const ids = ['filterYear', 'filterMonth', 'filterFrom', 'filterTo', 'filterComercio', 'filterCategoria', 'filterMin', 'filterMax', 'filterTopN'];
  ids.forEach((id) => $(id).addEventListener('input', () => {
    const filtered = applyFilters(allRecords);
    renderCharts(filtered);
    renderMovimientosTable(filtered);
  }));

  $('clearFiltersBtn').addEventListener('click', () => {
    ids.forEach((id) => { $(id).value = id === 'filterTopN' ? '10' : ''; });
    const filtered = applyFilters(allRecords);
    renderCharts(filtered);
    renderMovimientosTable(filtered);
  });

  $('cashbackGranularity').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('cashbackGranularity').querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cashbackGranularity = btn.dataset.g;
      Charts.renderCashbackAcumulado('chartCashbackAcumulado', cashbackAcumulado(applyFilters(allRecords), cashbackGranularity), cashbackGranularity);
    });
  });

  $('queryYear').addEventListener('change', renderQueryResult);
  $('queryMonth').addEventListener('change', renderQueryResult);
}

function wireSortableHeaders() {
  document.querySelectorAll('#tableMovimientos th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      sortState = { key, dir: sortState.key === key && sortState.dir === 'asc' ? 'desc' : 'asc' };
      renderMovimientosTable(applyFilters(allRecords));
    });
  });
}

function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((tc) => tc.classList.remove('active'));
      $(`tab${btn.dataset.tab.charAt(0).toUpperCase()}${btn.dataset.tab.slice(1)}`).classList.add('active');
    });
  });
}

function wireExpenseModal() {
  $('addExpenseBtn').addEventListener('click', openAddExpense);
  $('expenseModalClose').addEventListener('click', () => closeModal('expenseModal'));
  $('expenseCancelBtn').addEventListener('click', () => closeModal('expenseModal'));
  $('expenseForm').addEventListener('submit', handleExpenseSubmit);
  attachMontoFormatter($('fValor'));
  buildCategoriaDropdown();
}

function wireConfirmModal() {
  $('confirmCancelBtn').addEventListener('click', () => closeModal('confirmModal'));
  $('confirmDeleteBtn').addEventListener('click', handleConfirmDelete);
}

function wireConfigModal() {
  $('settingsBtn').addEventListener('click', () => { fillConfigForm(); openModal('configModal'); });
  $('cfgTestBtn').addEventListener('click', handleTestConnection);
  $('cfgSaveBtn').addEventListener('click', handleSaveConfig);
}

function wireMisc() {
  $('refreshBtn').addEventListener('click', loadData);
  $('exportBtn').addEventListener('click', () => exportCSV(applyFilters(allRecords)));
}

function exportCSV(records) {
  const header = ['Fecha', 'Comercio', 'Categoria', 'Valor', 'CashbackRappi', 'CashbackBancoBogota', 'CashbackTotal', 'Mes', 'Anio'];
  const rows = records.map((r) => [
    r.fecha, r.comercio, r.categoria,
    r.valor, r.cashbackRappi.toFixed(2), r.cashbackBB.toFixed(2), r.cashbackTotal.toFixed(2),
    r.monthName, r.year,
  ]);
  const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gastos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- BOOTSTRAP ----------
export async function initApp() {
  wireTabs();
  wireFilters();
  wireSortableHeaders();
  wireExpenseModal();
  wireConfirmModal();
  wireConfigModal();
  wireMisc();

  if (!isConfigured()) {
    openModal('configModal');
  } else {
    await loadData();
  }
}