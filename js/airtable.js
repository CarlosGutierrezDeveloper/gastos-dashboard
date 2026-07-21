// airtable.js
// Capa de acceso a datos: encapsula todas las llamadas a la API REST de Airtable.
// Documentación oficial: https://airtable.com/developers/web/api/introduction

import { getConfig } from './config.js';

function baseUrl(tableNameOverride) {
  const cfg = getConfig();
  const table = tableNameOverride ?? cfg.tableName;
  return `https://api.airtable.com/v0/${cfg.baseId}/${encodeURIComponent(table)}`;
}

function authHeaders() {
  const cfg = getConfig();
  return {
    Authorization: `Bearer ${cfg.token}`,
    'Content-Type': 'application/json',
  };
}

async function parseErrorBody(res) {
  try {
    const body = await res.json();
    return body?.error?.message || body?.error?.type || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

// Prueba la conexión con las credenciales dadas (sin guardar aún)
export async function testConnection({ token, baseId, tableName }) {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return true;
}

function mapRecord(r) {
  const f = r.fields || {};
  return {
    id: r.id,
    fecha: f['Fecha'] || null,
    comercio: f['Comercio'] || '',
    valor: typeof f['Valor'] === 'number' ? f['Valor'] : Number(f['Valor']) || 0,
    categoria: f['Categoria'] || 'Otros',
    aplicaCashback: f['AplicaCashback'] === true,
  };
}

function toAirtableFields(data) {
  const out = {};
  if (data.fecha !== undefined) out['Fecha'] = data.fecha;
  if (data.comercio !== undefined) out['Comercio'] = data.comercio;
  if (data.valor !== undefined) out['Valor'] = Number(data.valor);
  if (data.categoria !== undefined) out['Categoria'] = data.categoria;
  if (data.aplicaCashback !== undefined) out['AplicaCashback'] = !!data.aplicaCashback;
  return out;
}

// Trae TODOS los registros paginando automáticamente (Airtable devuelve máx. 100 por página)
export async function fetchAllRecords() {
  let all = [];
  let offset;
  do {
    const url = new URL(baseUrl());
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('sort[0][field]', 'Fecha');
    url.searchParams.set('sort[0][direction]', 'asc');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error(await parseErrorBody(res));
    const data = await res.json();
    all = all.concat(data.records.map(mapRecord));
    offset = data.offset;
  } while (offset);
  return all;
}

export async function createRecord(fields) {
  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: authHeaders(),
    // typecast:true permite que Airtable cree automáticamente la opción de
    // "Categoria" (Single Select) la primera vez que se usa, sin necesidad
    // de preconfigurarla manualmente en la base.
    body: JSON.stringify({ fields: toAirtableFields(fields), typecast: true }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return mapRecord(await res.json());
}

export async function updateRecord(id, fields) {
  const res = await fetch(`${baseUrl()}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields: toAirtableFields(fields), typecast: true }),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return mapRecord(await res.json());
}

export async function deleteRecord(id) {
  const res = await fetch(`${baseUrl()}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return true;
}
