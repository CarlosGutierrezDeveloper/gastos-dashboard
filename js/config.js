// config.js
// Maneja la configuración de conexión a Airtable.
// IMPORTANTE: el token NUNCA se guarda en el código ni se sube al repositorio.
// Se guarda únicamente en localStorage del navegador de quien lo ingresa.

const STORAGE_KEY = 'gastos_airtable_config_v1';

export function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Error leyendo configuración', e);
    return null;
  }
}

export function saveConfig({ token, baseId, tableName }) {
  const config = {
    token: token.trim(),
    baseId: baseId.trim(),
    tableName: tableName.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isConfigured() {
  const c = getConfig();
  return !!(c && c.token && c.baseId && c.tableName);
}
