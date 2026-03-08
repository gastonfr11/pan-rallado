// frontend/static/js/dashboard.js
// ── Dashboard con soporte de roles (admin ve todo + vendedor, vendedor ve solo los suyos) ──

let _dashboardNegocios = [];

async function cargarDashboard() {
  const lista     = document.getElementById('dashboardLista');
  const statsEl   = document.getElementById('dashboardStats');
  const filtroB   = document.getElementById('filtroBarrio');
  const filtroE   = document.getElementById('filtroEstado').value;
  const filtroF   = document.getElementById('filtroFecha').value;
  const busqueda  = document.getElementById('filtroBusqueda')?.value?.toLowerCase() || '';
  const filtroVendedor = document.getElementById('filtroVendedor')?.value || '';

  lista.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center;font-size:0.85rem;">Cargando...</div>';

  try {
    const res  = await apiFetch('/historial?barrio=Todo%20Montevideo');
    const data = await res.json();
    let negocios = (data.negocios || []).filter(n => n.visitado && n.resultado !== 'no_interesa');

    _dashboardNegocios = negocios;
    window._dashboardNegocios = negocios;

    // Poblar filtro de barrios
    const barrios = [...new Set(negocios.map(n => n.barrio).filter(Boolean))].sort();
    const barrioActual = filtroB.value;
    filtroB.innerHTML = '<option value="">Todos los barrios</option>' +
      barrios.map(b => `<option value="${b}" ${b === barrioActual ? 'selected' : ''}>${b}</option>`).join('');

    // Aplicar filtros
    let filtrados = negocios;
    if (filtroB.value)   filtrados = filtrados.filter(n => n.barrio === filtroB.value);
    if (filtroE)         filtrados = filtrados.filter(n => n.resultado === filtroE);
    if (busqueda)        filtrados = filtrados.filter(n => n.nombre.toLowerCase().includes(busqueda));

    // Filtro por vendedor (solo admin)
    if (currentUser?.rol === 'admin' && filtroVendedor) {
      filtrados = filtrados.filter(n => String(n.vendedor_id) === filtroVendedor);
    }

    // Filtro por fecha
    if (filtroF && filtroF !== 'especifica') {
      const ahora = new Date();
      filtrados = filtrados.filter(n => {
        if (!n.fecha_ultima_visita) return false;
        const f = new Date(n.fecha_ultima_visita);
        if (filtroF === 'hoy')    return f.toDateString() === ahora.toDateString();
        if (filtroF === 'semana') {
          const ini = new Date(ahora); ini.setDate(ahora.getDate() - ahora.getDay()); ini.setHours(0,0,0,0);
          return f >= ini;
        }
        if (filtroF === 'mes') return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        return true;
      });
    } else if (filtroF === 'especifica') {
      const fechaEsp = document.getElementById('filtroFechaEspecifica')?.value;
      if (fechaEsp) {
        filtrados = filtrados.filter(n => n.fecha_ultima_visita &&
          new Date(n.fecha_ultima_visita).toISOString().slice(0, 10) === fechaEsp);
      }
    }

    // Stats
    const total       = filtrados.length;
    const clientes    = filtrados.filter(n => n.resultado === 'cliente').length;
    const interesados = filtrados.filter(n => n.resultado === 'interesado').length;
    const noInt       = filtrados.filter(n => n.resultado === 'no_interesado').length;

    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Visitados</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#4dc864;">${clientes}</div><div class="stat-label">Clientes</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#f5c842;">${interesados}</div><div class="stat-label">Interesados</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#ff6464;">${noInt}</div><div class="stat-label">No interes.</div></div>
    `;

    if (!filtrados.length) {
      lista.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-dim);">
          <div style="font-size:2rem;margin-bottom:8px;">📭</div>
          <div>Sin negocios que coincidan con los filtros</div>
        </div>`;
      return;
    }

    // Mapa vendedores (solo admin)
    let vendedoresMap = {};
    const filtroVendedorWrap = document.getElementById('filtroVendedorWrap');
    if (currentUser?.rol === 'admin') {
      if (filtroVendedorWrap) filtroVendedorWrap.style.display = 'block';
      try {
        const rv = await apiFetch('/admin/usuarios');
        const dv = await rv.json();
        const selectVendedor = document.getElementById('filtroVendedor');
        if (selectVendedor) {
          selectVendedor.innerHTML = '<option value="">Todos los vendedores</option>' +
            (dv.usuarios || []).map(u =>
              `<option value="${u.id}" ${String(u.id) === filtroVendedor ? 'selected' : ''}>${_esc(u.nombre)}</option>`
            ).join('');
        }
        (dv.usuarios || []).forEach(u => { vendedoresMap[u.id] = u.nombre; });
      } catch (_) {}
    } else {
      if (filtroVendedorWrap) filtroVendedorWrap.style.display = 'none';
    }

    lista.innerHTML = filtrados.map(n => _renderCard(n, vendedoresMap)).join('');

    // Event delegation
    lista.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'chat')         chatDesdeHistorial(parseInt(btn.dataset.id));
      if (action === 'toggle-notas') toggleNotas(parseInt(btn.dataset.id));
      if (action === 'add-nota')     abrirAgregarNota(parseInt(btn.dataset.id));
      if (action === 'archivar')     archivarNegocio(btn.dataset.nombre, btn.dataset.direccion, btn.dataset.vendedorId, btn.dataset.negocioId);
      if (action === 'wpp')          abrirWppDashboard(parseInt(btn.dataset.id));
    };
    lista.onchange = (e) => {
      const sel = e.target.closest('[data-action="estado"]');
      if (!sel) return;
      actualizarEstado(sel.dataset.nombre, sel.dataset.direccion, sel.value, sel.dataset.vendedorId);
    };

  } catch (err) {
    lista.innerHTML = '<div style="color:#ff6464;padding:20px;text-align:center;">Error al cargar el dashboard</div>';
    console.error(err);
  }
}

// ── Render de card ────────────────────────────────────────────────────────────

function _renderCard(n, vendedoresMap) {
  const colores = {
    cliente:       { bg: 'rgba(77,200,100,0.08)',  border: 'rgba(77,200,100,0.25)',  badge: '#4dc864', label: '🟢 Cliente' },
    interesado:    { bg: 'rgba(245,200,66,0.08)',  border: 'rgba(245,200,66,0.25)',  badge: '#f5c842', label: '🟡 Interesado' },
    no_interesado: { bg: 'rgba(255,100,100,0.08)', border: 'rgba(255,100,100,0.25)', badge: '#ff6464', label: '🔴 No interesado' },
    visitado:      { bg: 'rgba(255,255,255,0.03)', border: 'var(--border)',           badge: 'var(--text-mid)', label: '⚪ Visitado' },
  };
  const c = colores[n.resultado] || colores.visitado;

  const nombreEsc = _escAttr(n.nombre);
  const dirEsc    = _escAttr(n.direccion);

  // Botón teléfono
  let telBtn = '—';
  if (n.telefono) {
    const num    = n.telefono.replace(/\s/g, '');
    const esMovil = /^09\d/.test(num) || /^\+?5989\d/.test(num);
    if (esMovil) {
      const numWpp = num.startsWith('+') ? num.replace('+', '') : '598' + num.replace(/^0/, '');
      telBtn = `<a href="https://wa.me/${numWpp}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;background:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.3);color:#25d366;padding:3px 8px;border-radius:6px;font-size:0.75rem;text-decoration:none;">📲 ${_esc(n.telefono)}</a>`;
    } else {
      telBtn = `<a href="tel:${n.telefono}" style="display:inline-flex;align-items:center;gap:4px;background:rgba(100,160,255,0.1);border:1px solid rgba(100,160,255,0.25);color:#6496ff;padding:3px 8px;border-radius:6px;font-size:0.75rem;text-decoration:none;">📞 ${_esc(n.telefono)}</a>`;
    }
  }

  // Badge vendedor (solo admin)
  const vendedorBadge = (currentUser?.rol === 'admin' && n.vendedor_id && vendedoresMap[n.vendedor_id])
    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.25);color:var(--accent);padding:3px 8px;border-radius:6px;font-size:0.7rem;font-weight:600;">👤 ${_esc(vendedoresMap[n.vendedor_id])}</span>`
    : '';

  const vendedorIdAttr = n.vendedor_id ? `data-vendedor-id="${n.vendedor_id}"` : '';

  return `
    <div style="background:${c.bg};border:1px solid ${c.border};border-radius:14px;padding:14px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.95rem;font-weight:600;color:var(--text);line-height:1.3;">${_esc(n.nombre)}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">${_esc(n.direccion)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <span style="font-size:0.72rem;color:${c.badge};font-weight:600;white-space:nowrap;">${c.label}</span>
          ${vendedorBadge}
        </div>
      </div>

      <div class="dashboard-detalles">
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Barrio</div><div class="dashboard-detalle-valor">${_esc(n.barrio) || '—'}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Fecha</div><div class="dashboard-detalle-valor">${n.fecha_ultima_visita ? new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY') : '—'}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Teléfono</div><div class="dashboard-detalle-valor">${telBtn}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Tipo</div><div class="dashboard-detalle-valor">${_esc(n.tipo_negocio) || '—'}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Nivel</div><div class="dashboard-detalle-valor">${n.nivel_operativo ? n.nivel_operativo.replace('_', ' ') : '—'}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Email</div><div class="dashboard-detalle-valor">${_esc(n.email) || '—'}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Rotisería propia</div><div class="dashboard-detalle-valor">${n.tiene_rotiseria ? '✅ Sí' : '❌ No'}</div></div>
        <div class="dashboard-detalle"><div class="dashboard-detalle-label">Producción propia</div><div class="dashboard-detalle-valor">${n.tiene_produccion_propia ? '✅ Sí' : '❌ No'}</div></div>
        <div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Horario</div><div class="dashboard-detalle-valor">${n.horario ? formatearHorario(n.horario) : '—'}</div></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <select class="dashboard-select-estado" style="flex:1;min-width:120px;"
          data-action="estado" data-nombre="${nombreEsc}" data-direccion="${dirEsc}" ${vendedorIdAttr}>
          <option value="visitado"      ${n.resultado === 'visitado'      ? 'selected' : ''}>Visitado</option>
          <option value="interesado"    ${n.resultado === 'interesado'    ? 'selected' : ''}>Interesado</option>
          <option value="cliente"       ${n.resultado === 'cliente'       ? 'selected' : ''}>Cliente</option>
          <option value="no_interesado" ${n.resultado === 'no_interesado' ? 'selected' : ''}>No interesado</option>
        </select>
        <button data-action="chat" data-id="${n.id}"
          style="background:var(--accent-dim);border:1px solid rgba(245,166,35,0.3);color:var(--accent);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
          💬 Chat
        </button>
        <button data-action="toggle-notas" data-id="${n.id}"
          style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
          📝 Notas${(n.notas_lista && n.notas_lista.length) ? ` (${n.notas_lista.length})` : ''}
        </button>
        <button data-action="add-nota" data-id="${n.id}"
          style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
          ✍️ Agregar nota
        </button>
        <button data-action="archivar" data-nombre="${nombreEsc}" data-direccion="${dirEsc}" ${vendedorIdAttr} data-negocio-id="${n.id}"
          style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.25);color:#ff4d4d;padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
          🗑️
        </button>
      </div>

      <div style="display:none;margin-top:10px;" id="notas-container-${n.id}">
        <div id="notas-lista-${n.id}">${_renderNotas(n.notas_lista || [], n.id)}</div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input type="text" id="notaInput-${n.id}" placeholder="Agregar nota..."
            style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:0.8rem;font-family:'DM Sans',sans-serif;"
            onkeydown="if(event.key==='Enter') agregarNotaDashboard(${n.id})">
          <button onclick="agregarNotaDashboard(${n.id})"
            style="background:var(--accent-dim);border:1px solid rgba(245,166,35,0.3);color:var(--accent);padding:7px 12px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
            + Agregar
          </button>
        </div>
      </div>
    </div>`;
}

// ── Notas ─────────────────────────────────────────────────────────────────────

function _renderNotas(notas, negocioId) {
  if (!notas || !notas.length) {
    return `<div style="font-size:0.78rem;color:var(--text-dim);padding:4px 0;">Sin notas aún</div>`;
  }
  return notas.map(nt => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 8px;background:var(--surface2);border-radius:8px;margin-bottom:4px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.8rem;color:var(--text);word-break:break-word;">${_esc(nt.texto)}</div>
        <div style="font-size:0.7rem;color:var(--text-dim);margin-top:2px;">
          ${nt.vendedor_nombre ? `👤 ${_esc(nt.vendedor_nombre)} · ` : ''}${nt.fecha ? new Date(nt.fecha).toLocaleDateString('es-UY') : ''}
        </div>
      </div>
      <button onclick="eliminarNotaDashboard(${nt.id}, ${negocioId})"
        style="background:none;border:none;color:#ff6464;cursor:pointer;font-size:0.85rem;padding:2px 4px;flex-shrink:0;" title="Eliminar nota">🗑️</button>
    </div>`).join('');
}

async function agregarNotaDashboard(negocioId) {
  const input = document.getElementById(`notaInput-${negocioId}`);
  const texto = input?.value?.trim();
  if (!texto) return;
  try {
    const res = await apiFetch('/notas', {
      method: 'POST',
      body: JSON.stringify({ negocio_id: negocioId, texto })
    });
    if (!res.ok) { mostrarToast('❌ Error al agregar nota'); return; }
    const data = await res.json();
    input.value = '';
    const n = _dashboardNegocios.find(x => x.id === negocioId);
    if (n) {
      if (!n.notas_lista) n.notas_lista = [];
      n.notas_lista.push({ id: data.id, texto, fecha: new Date().toISOString(), vendedor_nombre: currentUser?.nombre, vendedor_id: currentUser?.id });
      const lista = document.getElementById(`notas-lista-${negocioId}`);
      if (lista) lista.innerHTML = _renderNotas(n.notas_lista, negocioId);
    }
  } catch (e) {
    mostrarToast('❌ Error al agregar nota');
  }
}

async function eliminarNotaDashboard(notaId, negocioId) {
  try {
    const res = await apiFetch(`/notas/${notaId}`, { method: 'DELETE' });
    if (!res.ok) { mostrarToast('❌ Sin permiso'); return; }
    const n = _dashboardNegocios.find(x => x.id === negocioId);
    if (n) {
      n.notas_lista = (n.notas_lista || []).filter(nt => nt.id !== notaId);
      const lista = document.getElementById(`notas-lista-${negocioId}`);
      if (lista) lista.innerHTML = _renderNotas(n.notas_lista, negocioId);
    }
    mostrarToast('🗑️ Nota eliminada');
  } catch (e) {
    mostrarToast('❌ Error al eliminar nota');
  }
}

// ── Filtro fecha ──────────────────────────────────────────────────────────────

function onFiltroFechaChange() {
  const val  = document.getElementById('filtroFecha').value;
  document.getElementById('filtroFechaEspecificaWrap').style.display = val === 'especifica' ? 'block' : 'none';
  cargarDashboard();
}

// ── Actualizar estado ─────────────────────────────────────────────────────────

async function actualizarEstado(nombre, direccion, nuevoEstado, vendedorId) {
  try {
    const body = { nombre, direccion, resultado: nuevoEstado };
    if (vendedorId) body.vendedor_id = parseInt(vendedorId);
    await apiFetch('/marcar-visitado', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    mostrarToast(`✅ ${nombre} → ${nuevoEstado.replace('_', ' ')}`);
    cargarDashboard();
  } catch (e) {
    mostrarToast('❌ Error al actualizar estado');
  }
}

// ── Toggle notas / Agregar nota ───────────────────────────────────────────────

function toggleNotas(negocioId) {
  const container = document.getElementById(`notas-container-${negocioId}`);
  if (!container) return;
  container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

function abrirAgregarNota(negocioId) {
  const container = document.getElementById(`notas-container-${negocioId}`);
  if (!container) return;
  container.style.display = 'block';
  document.getElementById(`notaInput-${negocioId}`)?.focus();
}

// ── Archivar (No me interesa) ─────────────────────────────────────────────────

function archivarNegocio(nombre, direccion, vendedorId, negocioId) {
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <span>¿Archivar "${_esc(nombre)}" como No me interesa?</span>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button id="btnConfirmarArchivar"
        style="background:#ff4d4d;border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Confirmar
      </button>
      <button id="btnCancelarArchivar"
        style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Cancelar
      </button>
    </div>`;
  toast.classList.add('show');
  document.getElementById('btnConfirmarArchivar').onclick = () => {
    toast.classList.remove('show');
    confirmarArchivar(nombre, direccion, vendedorId);
  };
  document.getElementById('btnCancelarArchivar').onclick = () => {
    toast.classList.remove('show');
  };
}

async function confirmarArchivar(nombre, direccion, vendedorId) {
  try {
    const body = { nombre, direccion, resultado: 'no_interesa' };
    if (vendedorId) body.vendedor_id = parseInt(vendedorId);
    await apiFetch('/marcar-visitado', { method: 'POST', body: JSON.stringify(body) });
    mostrarToast('🗑️ Archivado como No me interesa');
    cargarDashboard();
  } catch (e) {
    mostrarToast('❌ Error al archivar');
  }
}

// ── Chat desde historial ──────────────────────────────────────────────────────

async function chatDesdeHistorial(id) {
  try {
    const res  = await apiFetch('/historial?barrio=Todo%20Montevideo');
    const data = await res.json();
    const n    = (data.negocios || []).find(x => x.id === id);
    if (!n) return;
    negocioActivo = {
      nombre: n.nombre, direccion: n.direccion,
      tipo: n.tipo_negocio || 'negocio', razon: n.notas || 'Cliente visitado',
      telefono: n.telefono, horario: n.horario, email: n.email,
      tipo_negocio: n.tipo_negocio, nivel_operativo: n.nivel_operativo, notas: n.notas,
      barrio: n.barrio,
    };
    historialChat = [];
    activarChat(negocioActivo);
    goTo('chat', document.querySelectorAll('.nav-btn')[3]);
  } catch (e) {
    mostrarToast('❌ Error al abrir chat');
  }
}

// ── Editar visitado ───────────────────────────────────────────────────────────

function editarVisitado(id) {
  const n = window._dashboardNegocios?.find(x => x.id === id);
  if (!n) return;
  window._modalNegocioActivo = { nombre: n.nombre, direccion: n.direccion };
  document.getElementById('modalNombre').textContent         = n.nombre;
  document.getElementById('modalEstado').value               = n.resultado || 'visitado';
  document.getElementById('modalTelefono').value             = n.telefono || '';
  document.getElementById('modalEmail').value                = n.email || '';
  document.getElementById('modalHorario').value              = n.horario || '';
  document.getElementById('modalTipoNegocio').value          = n.tipo_negocio || '';
  document.getElementById('modalNivel').value                = n.nivel_operativo || '';
  document.getElementById('modalRotiseria').checked          = !!n.tiene_rotiseria;
  document.getElementById('modalProduccion').checked         = !!n.tiene_produccion_propia;
  document.getElementById('modalNotas').value                = n.notas || '';
  document.getElementById('modalVisitado').style.display     = 'flex';
}

// ── WPP desde dashboard ───────────────────────────────────────────────────────

async function abrirWppDashboard(id) {
  const n = window._dashboardNegocios?.find(x => x.id === id);
  if (!n || !n.telefono) { mostrarToast('❌ Sin teléfono'); return; }
  if (typeof abrirModalWpp === 'function') abrirModalWpp(n);
}

// ── Exportar Excel ────────────────────────────────────────────────────────────

async function exportarExcel() {
  const res  = await apiFetch('/historial?barrio=Todo%20Montevideo');
  const data = await res.json();
  const negocios = (data.negocios || []).filter(n => n.visitado);
  const filas = negocios.map(n => ({
    'Nombre': n.nombre, 'Dirección': n.direccion, 'Barrio': n.barrio || '',
    'Estado': n.resultado || '', 'Tipo de negocio': n.tipo_negocio || '',
    'Nivel operativo': n.nivel_operativo || '', 'Teléfono': n.telefono || '',
    'Email': n.email || '', 'Notas': n.notas || '',
    'Fecha última visita': n.fecha_ultima_visita ? new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY') : '',
    'Tiene rotisería': n.tiene_rotiseria ? 'Sí' : 'No',
    'Prod. propia': n.tiene_produccion_propia ? 'Sí' : 'No',
  }));
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Visitados');
  XLSX.writeFile(wb, 'negocios-visitados.xlsx');
}

// ── Exportar PDF ──────────────────────────────────────────────────────────────

async function exportarPDF() {
  const res  = await apiFetch('/historial?barrio=Todo%20Montevideo');
  const data = await res.json();
  const negocios = (data.negocios || []).filter(n => n.visitado);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(245, 166, 35);
  doc.rect(0, 0, 297, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('PAN RALLADO — Negocios Visitados', 14, 13);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Exportado: ${new Date().toLocaleDateString('es-UY')}`, 245, 13);
  const clientes = negocios.filter(n => n.resultado === 'cliente').length;
  const inter    = negocios.filter(n => n.resultado === 'interesado').length;
  doc.setTextColor(50, 50, 50); doc.setFontSize(9);
  doc.text(`Total: ${negocios.length}  |  Clientes: ${clientes}  |  Interesados: ${inter}`, 14, 27);
  doc.autoTable({
    startY: 32,
    head: [['Nombre', 'Barrio', 'Estado', 'Tipo', 'Teléfono', 'Notas', 'Fecha']],
    body: negocios.map(n => [
      n.nombre, n.barrio || '', (n.resultado || '').replace('_', ' '),
      n.tipo_negocio || '', n.telefono || '',
      (n.notas || '').slice(0, 50),
      n.fecha_ultima_visita ? new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY') : '',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [245, 166, 35], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [252, 248, 240] },
    columnStyles: { 0: { cellWidth: 55 }, 5: { cellWidth: 60 } },
  });
  doc.save('negocios-visitados.pdf');
}

// ── Formatear horario ─────────────────────────────────────────────────────────

function formatearHorario(horario) {
  if (!horario) return '';
  const dias = { 'Monday':'Lunes','Tuesday':'Martes','Wednesday':'Miércoles','Thursday':'Jueves','Friday':'Viernes','Saturday':'Sábado','Sunday':'Domingo' };
  const parseadas = horario.split(' | ').map(linea => {
    const match = linea.match(/^(\w+):\s*(.+)$/);
    if (!match) return null;
    const dia = dias[match[1]] || match[1];
    let horas = match[2];
    if (horas === 'Closed') return { dia, horas: 'Cerrado' };
    horas = horas.replace(/(\d+):(\d+)\s*(AM|PM)/g, (_, h, m, ampm) => {
      let hora = parseInt(h);
      if (ampm === 'PM' && hora !== 12) hora += 12;
      if (ampm === 'AM' && hora === 12) hora = 0;
      return m === '00' ? `${hora}h` : `${hora}:${m}h`;
    });
    horas = horas.replace(' – ', ' a ').replace(', ', ' / ');
    return { dia, horas };
  }).filter(Boolean);

  const grupos = [];
  parseadas.forEach(({ dia, horas }) => {
    const ult = grupos[grupos.length - 1];
    if (ult && ult.horas === horas) ult.hasta = dia;
    else grupos.push({ desde: dia, hasta: null, horas });
  });

  return grupos.map(g =>
    `<div style="margin-bottom:2px;"><span style="color:var(--text);">${g.hasta ? `${g.desde} a ${g.hasta}` : g.desde}:</span> ${g.horas}</div>`
  ).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
