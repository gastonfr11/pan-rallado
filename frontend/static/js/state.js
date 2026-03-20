// ── STATE GLOBAL ─────────────────────────────────────
let mapa = null;
let markers = [];
let infoWindows = [];
let directionsRenderer = null;
let negociosData = [];
let negocioActivo = null;
let historialChat = [];
let negocioParaVisitar = null;
let currentUser = null;

const screens = {
  generar:   'generarScreen',
  lista:     'listaScreen',
  mapa:      'mapaScreen',
  chat:      'chatScreen',
  dashboard: 'dashboardScreen',
};

async function authFetch(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  return res;
}
