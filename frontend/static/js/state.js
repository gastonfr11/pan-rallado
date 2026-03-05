// ── STATE GLOBAL ─────────────────────────────────────
let mapa = null;
let markers = [];
let infoWindows = [];
let directionsRenderer = null;
let negociosData = [];
let negocioActivo = null;
let historialChat = [];
let negocioParaVisitar = null;

const screens = {
  generar:   'generarScreen',
  lista:     'listaScreen',
  mapa:      'mapaScreen',
  chat:      'chatScreen',
  dashboard: 'dashboardScreen',
};
