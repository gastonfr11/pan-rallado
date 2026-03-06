// ── NAVIGATION ────────────────────────────────────────
function goTo(name, btn) {
  Object.values(screens).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const screen = document.getElementById(screens[name]);
  if (screen) screen.classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'dashboard') cargarDashboard();
}

async function cargarBarrios() {
  try {
    const res = await authFetch('/barrios');
    const data = await res.json();
    document.getElementById('barrio').innerHTML = data.barrios
      .map(b => `<option value="${b}">${b}</option>`).join('');
    const filtro = document.getElementById('filtroBarrio');
    if (filtro) {
      filtro.innerHTML = '<option value="">Todos los barrios</option>' +
        data.barrios.map(b => `<option value="${b}">${b}</option>`).join('');
    }
  } catch (e) {
    document.getElementById('barrio').innerHTML = '<option value="Pocitos">Pocitos</option>';
  }
}

// ── DASHBOARD ─────────────────────────────────────────
async function cargarDashboard() {
  const barrio = document.getElementById('filtroBarrio').value;
  const estado = document.getElementById('filtroEstado').value;
  const busqueda = document.getElementById('filtroBusqueda').value.toLowerCase();

  try {
    const url = barrio ? `/historial?barrio=${encodeURIComponent(barrio)}` : '/historial';
    const res = await fetch(url);
    const data = await res.json();

    let negocios = data.negocios.filter(n => n.visitado);
    if (estado) negocios = negocios.filter(n => n.resultado === estado);
    if (busqueda) negocios = negocios.filter(n => n.nombre.toLowerCase().includes(busqueda));

    // Stats
    const total = negocios.length;
    const clientes = negocios.filter(n => n.resultado === 'cliente').length;
    const interesados = negocios.filter(n => n.resultado === 'interesado').length;
    const conversion = total > 0 ? Math.round((clientes / total) * 100) : 0;

    document.getElementById('dashboardStats').innerHTML = [
      { v: total, l: 'Visitados' },
      { v: clientes, l: 'Clientes' },
      { v: interesados, l: 'Interesados' },
      { v: conversion + '%', l: 'Conversión' },
    ].map(s => `<div class="stat-card"><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`).join('');

    // Lista
    const lista = document.getElementById('dashboardLista');
    if (negocios.length === 0) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Sin resultados</h3><p>No hay negocios visitados con esos filtros.</p></div>`;
      return;
    }

    lista.innerHTML = negocios.map(n => {
      const nombreEsc = n.nombre.replace(/'/g, "\\'");
      const dirEsc = (n.direccion || '').replace(/'/g, "\\'");
      return `
      <div class="dashboard-card">
        <div class="dashboard-card-header">
          <div>
            <div class="dashboard-card-nombre">${n.nombre}</div>
            <div class="dashboard-card-dir">📍 ${n.direccion ? n.direccion.split(',')[0] : ''}</div>
          </div>
          <span class="estado-badge estado-${n.resultado || 'visitado'}">${(n.resultado || 'visitado').replace('_', ' ')}</span>
        </div>
        <div class="dashboard-detalles">
          ${n.barrio ? `<div class="dashboard-detalle"><div class="dashboard-detalle-label">Barrio</div><div class="dashboard-detalle-valor">${n.barrio}</div></div>` : ''}
          ${n.fecha_ultima_visita ? `<div class="dashboard-detalle"><div class="dashboard-detalle-label">Fecha</div><div class="dashboard-detalle-valor">${new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY')}</div></div>` : ''}
          ${n.telefono ? `<div class="dashboard-detalle"><div class="dashboard-detalle-label">Teléfono</div><div class="dashboard-detalle-valor"><a href="tel:${n.telefono}" style="color:var(--accent);text-decoration:none;">${n.telefono}</a></div></div>` : ''}
          ${n.tipo_negocio ? `<div class="dashboard-detalle"><div class="dashboard-detalle-label">Tipo</div><div class="dashboard-detalle-valor">${n.tipo_negocio}</div></div>` : ''}
          ${n.nivel_operativo ? `<div class="dashboard-detalle"><div class="dashboard-detalle-label">Nivel</div><div class="dashboard-detalle-valor">${n.nivel_operativo.replace('_', ' ')}</div></div>` : ''}
          ${n.email ? `<div class="dashboard-detalle"><div class="dashboard-detalle-label">Email</div><div class="dashboard-detalle-valor">${n.email}</div></div>` : ''}
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Rotisería propia</div><div class="dashboard-detalle-valor">${n.tiene_rotiseria ? '✅ Sí' : '❌ No'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Producción propia</div><div class="dashboard-detalle-valor">${n.tiene_produccion_propia ? '✅ Sí' : '❌ No'}</div></div>
          ${n.horario ? `<div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Horario</div><div class="dashboard-detalle-valor">${n.horario}</div></div>` : ''}
          ${n.notas ? `<div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Notas</div><div class="dashboard-detalle-valor">${n.notas}</div></div>` : ''}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <select class="dashboard-select-estado" style="flex:1;" onchange="actualizarEstado('${nombreEsc}','${dirEsc}',this.value)">
            <option value="visitado" ${n.resultado === 'visitado' ? 'selected' : ''}>Visitado</option>
            <option value="interesado" ${n.resultado === 'interesado' ? 'selected' : ''}>Interesado</option>
            <option value="cliente" ${n.resultado === 'cliente' ? 'selected' : ''}>Cliente</option>
            <option value="no_interesado" ${n.resultado === 'no_interesado' ? 'selected' : ''}>No interesado</option>
          </select>
          <button onclick="editarVisitado(${n.id})" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
            ✏️ Editar
          </button>
        </div>
      </div>`;
    }).join('');

  } catch (e) {
    document.getElementById('dashboardLista').innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Error al cargar</h3></div>`;
  }
}

async function actualizarEstado(nombre, direccion, nuevoEstado) {
  try {
    await fetch('/marcar-visitado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, direccion, resultado: nuevoEstado })
    });
    showToast('✅ Estado actualizado');
    cargarDashboard();
  } catch (e) {
    showToast('❌ Error al actualizar');
  }
}

function goTo(name, btn) {
  Object.values(screens).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const screen = document.getElementById(screens[name]);
  if (screen) screen.classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'dashboard') cargarDashboard();
  if (name === 'chat' && !negocioActivo) activarChat(null);
}
