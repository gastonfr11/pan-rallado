// ── BÚSQUEDA INTELIGENTE / POR NOMBRE ────────────────
function setModoBarrio(modo) {
  const manualFields = document.getElementById('modoManualFields');
  const inteligenteFields = document.getElementById('modoInteligenteFields');
  const nombreFields = document.getElementById('modoNombreFields');
  const btnGenerar = document.getElementById('btnGenerar');

  // Reset
  manualFields.style.display = 'none';
  inteligenteFields.style.display = 'none';
  nombreFields.style.display = 'none';
  ['tabManual', 'tabInteligente', 'tabNombre'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );

  if (modo === 'manual') {
    manualFields.style.display = 'block';
    document.getElementById('tabManual').classList.add('active');
    btnGenerar.style.display = 'block';
  } else if (modo === 'inteligente') {
    inteligenteFields.style.display = 'flex';
    document.getElementById('tabInteligente').classList.add('active');
    btnGenerar.style.display = 'block';
  } else if (modo === 'nombre') {
    nombreFields.style.display = 'flex';
    document.getElementById('tabNombre').classList.add('active');
    btnGenerar.style.display = 'none';
    // Poblar el select de zona copiando del selector principal (si aún no está poblado)
    const src = document.getElementById('barrio');
    const dst = document.getElementById('barrioNombre');
    if (dst.options.length === 0) {
      Array.from(src.options).forEach(o => dst.add(new Option(o.text, o.value)));
    }
  }
}

async function buscarPorNombre() {
  const q = document.getElementById('busquedaNombre').value.trim();
  const barrio = document.getElementById('barrioNombre').value || 'Todo Montevideo';
  if (!q) { showToast('⚠️ Escribí un nombre para buscar'); return; }

  const btn = document.getElementById('btnBuscarNombre');
  btn.disabled = true;
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');
  document.getElementById('loadingText').textContent = `Buscando "${q}"...`;
  document.getElementById('emptyState').style.display = 'none';

  try {
    const res = await authFetch(`/buscar-por-nombre?q=${encodeURIComponent(q)}&barrio=${encodeURIComponent(barrio)}`);
    const data = await res.json();
    overlay.classList.remove('show');

    if (!data.resultados.length) {
      showToast(`⚠️ Sin resultados para "${q}"`);
      document.getElementById('emptyState').style.display = 'flex';
      return;
    }

    negociosData = data.resultados;
    resetChat();
    mostrarResultadosBusqueda(data.resultados, q);
    _guardarBusqueda('nombre', q, document.getElementById('modo').value, data.resultados);
    showToast(`✅ ${data.total} resultado${data.total !== 1 ? 's' : ''} para "${q}"`);
    goTo('lista', document.querySelectorAll('#nav .nav-btn')[1]);
  } catch (e) {
    overlay.classList.remove('show');
    showToast('❌ Error de conexión');
    document.getElementById('emptyState').style.display = 'flex';
  } finally {
    btn.disabled = false;
  }
}

function mostrarResultadosBusqueda(resultados, query) {
  // Stats
  document.getElementById('statsContainer').style.display = 'block';
  document.getElementById('statsRow').innerHTML = [
    { v: resultados.length, l: 'Encontrados' },
    { v: resultados.filter(n => !n.ya_visitado).length, l: 'Sin visitar' },
    { v: resultados.filter(n => n.ya_visitado).length, l: 'Ya visitados' },
  ].map(s => `<div class="stat-card"><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');

  // Lista
  document.getElementById('listaEmpty').style.display = 'none';
  const lc = document.getElementById('listaNegociosContainer');
  lc.style.display = 'flex';

  lc.innerHTML = resultados.map((n, i) => `
    <div class="negocio-card${n.ya_visitado ? ' ya-visitado' : ''}" id="card-${i}" onclick="${n.ya_visitado ? '' : `seleccionarNegocio(${i})`}">
      <div class="negocio-body" style="flex:1;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
          <div class="negocio-badge">${n.tipo}</div>
          ${n.ya_visitado ? '<div class="badge-ya-visitado">✅ Ya visitado</div>' : ''}
        </div>
        <div class="negocio-nombre">${n.nombre}</div>
        <div class="negocio-dir">📍 ${n.direccion.split(',')[0]}</div>
        <div class="negocio-actions">
          <a class="btn-waze" href="https://waze.com/ul?ll=${n.lat},${n.lng}&navigate=yes" target="_blank" onclick="event.stopPropagation()">🚗 Waze</a>
          ${!n.ya_visitado ? `
            <button class="btn-chat-quick" onclick="event.stopPropagation();abrirChatNegocio(${i})">💬 Chat</button>
            <button class="btn-visitado" id="visitado-${i}" onclick="event.stopPropagation();marcarVisitado(${i})">✅ Visitado</button>
          ` : ''}
        </div>
      </div>
    </div>`).join('');

  // Mapa chips
  document.getElementById('mapaEmpty').style.display = 'none';
  const mc = document.getElementById('mapChips');
  mc.style.display = 'flex';
  mc.innerHTML = resultados.map((n, i) =>
    `<div class="map-chip${n.ya_visitado ? ' visitado' : ''}" id="chip-${i}" onclick="seleccionarNegocio(${i})">${n.nombre.split(' ').slice(0, 2).join(' ')}</div>`
  ).join('');

  // Chat chips (solo no visitados)
  document.getElementById('chatSelector').style.display = 'block';
  document.getElementById('chatChips').innerHTML = resultados
    .map((n, i) => n.ya_visitado ? '' :
      `<div class="chat-negocio-chip" id="chatChip-${i}" onclick="abrirChatNegocio(${i})">${n.nombre.split(' ').slice(0, 3).join(' ')}</div>`
    ).join('');

  iniciarMapa(resultados);
}

async function recomendarBarrio() {
  const modo = document.getElementById('modo').value;
  const btn = document.getElementById('btnRecomendar');
  const card = document.getElementById('recomendacionCard');

  btn.disabled = true;
  btn.textContent = '⏳ Analizando...';
  card.style.display = 'none';

  try {
    const res = await authFetch(`/recomendar-barrio?modo=${modo}`);
    const data = await res.json();

    const barrio = data.barrio_recomendado;
    const razon = data.razon;

    // Pre-seleccionar en el select (para que generarRoadmap funcione igual)
    const select = document.getElementById('barrio');
    const option = Array.from(select.options).find(o => o.value === barrio);
    if (option) select.value = barrio;

    card.style.display = 'block';
    card.innerHTML = `
      <div class="recomendacion-card">
        <div class="recomendacion-barrio">📍 ${barrio}</div>
        <div class="recomendacion-razon">${razon}</div>
      </div>`;
  } catch (e) {
    showToast('❌ Error al analizar barrios');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Analizar y recomendar';
  }
}

// ── ROADMAP ───────────────────────────────────────────
async function generarRoadmap() {
  const barrio = document.getElementById('barrio').value;
  const whatsapp = document.getElementById('whatsapp').checked;
  const modo = document.getElementById('modo').value;
  if (!barrio) return;

  const btn = document.getElementById('btnGenerar');
  btn.disabled = true;
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');
  document.getElementById('loadingText').textContent = `Buscando negocios en ${barrio}...`;
  document.getElementById('emptyState').style.display = 'none';

  try {
    const res = await authFetch('/generar-roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barrio, enviar_whatsapp: whatsapp, modo })
    });
    const data = await res.json();
    overlay.classList.remove('show');

    if (data.error) {
      showToast('⚠️ ' + data.error);
      document.getElementById('emptyState').style.display = 'flex';
      return;
    }

    negociosData = data.seleccionados;
    resetChat();
    mostrarResultados(data);
    _guardarBusqueda('roadmap', barrio, modo, data.seleccionados);
    showToast('✅ ' + data.seleccionados.length + ' negocios encontrados');

  } catch (e) {
    overlay.classList.remove('show');
    showToast('❌ Error de conexión');
    document.getElementById('emptyState').style.display = 'flex';
  } finally {
    btn.disabled = false;
  }
}

function mostrarResultados(data) {
  // Stats
  document.getElementById('statsContainer').style.display = 'block';
  document.getElementById('statsRow').innerHTML = [
    { v: data.total_encontrados, l: 'Encontrados' },
    { v: data.seleccionados.length, l: 'Seleccionados' },
    { v: data.distancia_km ? data.distancia_km + ' km' : '—', l: 'Distancia' },
    { v: data.tiempo_min ? data.tiempo_min + ' min' : '—', l: 'Tiempo' },
  ].map(s => `<div class="stat-card"><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');

  // Lista
  document.getElementById('listaEmpty').style.display = 'none';
  const lc = document.getElementById('listaNegociosContainer');
  lc.style.display = 'flex';

  lc.innerHTML = data.seleccionados.map((n, i) => `
    <div class="negocio-card" id="card-${i}" onclick="seleccionarNegocio(${i})">
      <div class="negocio-num">${i + 1}</div>
      <div class="negocio-body">
        <div class="negocio-badge">${n.tipo || 'negocio'}</div>
        <div class="negocio-nombre">${n.nombre}</div>
        <div class="negocio-dir">📍 ${n.direccion.split(',')[0]}</div>
        <div class="negocio-razon">💡 ${n.razon}</div>
        <div class="negocio-actions">
          <a class="btn-waze" href="https://waze.com/ul?ll=${n.lat},${n.lng}&navigate=yes" target="_blank" onclick="event.stopPropagation()">🚗 Waze</a>
          <button class="btn-chat-quick" onclick="event.stopPropagation();abrirChatNegocio(${i})">💬 Chat</button>
          <button class="btn-visitado" id="visitado-${i}" onclick="event.stopPropagation();marcarVisitado(${i})">✅ Visitado</button>
        </div>
      </div>
    </div>`).join('');

  // Mapa chips
  document.getElementById('mapaEmpty').style.display = 'none';
  const mc = document.getElementById('mapChips');
  mc.style.display = 'flex';
  mc.innerHTML = data.seleccionados.map((n, i) =>
    `<div class="map-chip" id="chip-${i}" onclick="seleccionarNegocio(${i})">${i + 1}. ${n.nombre.split(' ').slice(0, 2).join(' ')}</div>`
  ).join('');

  // Chat chips
  document.getElementById('chatSelector').style.display = 'block';
  document.getElementById('chatChips').innerHTML = data.seleccionados.map((n, i) =>
    `<div class="chat-negocio-chip" id="chatChip-${i}" onclick="abrirChatNegocio(${i})">${i + 1}. ${n.nombre.split(' ').slice(0, 3).join(' ')}</div>`
  ).join('');

  iniciarMapa(data.seleccionados);
}

// ── BÚSQUEDAS RECIENTES ───────────────────────────────
const _BR_KEY = 'busquedas_recientes';
const _BR_TTL = 24 * 60 * 60 * 1000; // 24 horas en ms

function _guardarBusqueda(tipo, label, modo, negocios) {
  const todas = _cargarBusquedas();
  // Evitar duplicado exacto reciente (mismo label + modo en últimos 5 min)
  const hace5min = Date.now() - 5 * 60 * 1000;
  const duplicado = todas.find(b => b.label === label && b.modo === modo && b.timestamp > hace5min);
  if (duplicado) return;

  todas.unshift({
    id: Date.now(),
    tipo,        // 'roadmap' | 'nombre'
    label,       // barrio o query
    modo,
    negocios,
    timestamp: Date.now()
  });

  // Máximo 10 búsquedas guardadas
  localStorage.setItem(_BR_KEY, JSON.stringify(todas.slice(0, 10)));
  renderBusquedasRecientes();
}

function _cargarBusquedas() {
  try {
    const raw = localStorage.getItem(_BR_KEY);
    if (!raw) return [];
    const todas = JSON.parse(raw);
    // Filtrar expiradas
    const vigentes = todas.filter(b => Date.now() - b.timestamp < _BR_TTL);
    if (vigentes.length !== todas.length) localStorage.setItem(_BR_KEY, JSON.stringify(vigentes));
    return vigentes;
  } catch { return []; }
}

function _eliminarBusqueda(id) {
  const vigentes = _cargarBusquedas().filter(b => b.id !== id);
  localStorage.setItem(_BR_KEY, JSON.stringify(vigentes));
  renderBusquedasRecientes();
}

function _tiempoRelativo(ts) {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  const hs   = Math.floor(diff / 3600000);
  if (min < 1)  return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  if (hs < 24)  return `hace ${hs}h`;
  return 'hace más de 24h';
}

function renderBusquedasRecientes() {
  const contenedor = document.getElementById('busquedasRecientes');
  if (!contenedor) return;
  const busquedas = _cargarBusquedas();
  if (!busquedas.length) { contenedor.innerHTML = ''; return; }

  contenedor.innerHTML = `
    <div style="margin-top:16px;">
      <div style="font-size:0.75rem;font-weight:600;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
        🕐 Búsquedas recientes
      </div>
      ${busquedas.map(b => `
        <div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:pointer;"
          onclick="restaurarBusqueda(${b.id})">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.88rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${b.tipo === 'roadmap' ? '📍' : '🔎'} ${b.label}
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">
              ${b.modo === 'chico' ? '🏪 Clientes chicos' : '🏭 Clientes grandes'} · ${b.negocios.length} negocios · ${_tiempoRelativo(b.timestamp)}
            </div>
          </div>
          <button onclick="event.stopPropagation();_eliminarBusqueda(${b.id})"
            style="background:none;border:none;color:var(--text-dim);font-size:1rem;cursor:pointer;padding:4px;flex-shrink:0;"
            title="Eliminar">✕</button>
        </div>
      `).join('')}
    </div>`;
}

function restaurarBusqueda(id) {
  const b = _cargarBusquedas().find(x => x.id === id);
  if (!b) return;
  negociosData = b.negocios;
  resetChat();
  if (b.tipo === 'roadmap') {
    mostrarResultados({
      seleccionados: b.negocios,
      total_encontrados: b.negocios.length,
      distancia_km: null,
      tiempo_min: null
    });
  } else {
    mostrarResultadosBusqueda(b.negocios, b.label);
  }
  goTo('lista', document.querySelectorAll('#nav .nav-btn')[1]);
}
