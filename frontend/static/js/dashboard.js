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
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Barrio</div><div class="dashboard-detalle-valor">${n.barrio || '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Fecha</div><div class="dashboard-detalle-valor">${n.fecha_ultima_visita ? new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY') : '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Teléfono</div><div class="dashboard-detalle-valor">${n.telefono ? `<a href="tel:${n.telefono}" style="color:var(--accent);text-decoration:none;">${n.telefono}</a>` : '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Tipo</div><div class="dashboard-detalle-valor">${n.tipo_negocio || '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Nivel</div><div class="dashboard-detalle-valor">${n.nivel_operativo ? n.nivel_operativo.replace('_',' ') : '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Email</div><div class="dashboard-detalle-valor">${n.email || '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Rotisería propia</div><div class="dashboard-detalle-valor">${n.tiene_rotiseria ? '✅ Sí' : '❌ No'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Producción propia</div><div class="dashboard-detalle-valor">${n.tiene_produccion_propia ? '✅ Sí' : '❌ No'}</div></div>
          <div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Horario</div><div class="dashboard-detalle-valor">${n.horario ? formatearHorario(n.horario) : '—'}</div></div>
          <div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Notas</div><div class="dashboard-detalle-valor">${n.notas || '—'}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <select class="dashboard-select-estado" style="flex:1;" onchange="actualizarEstado('${nombreEsc}','${dirEsc}',this.value)">
            <option value="visitado" ${n.resultado === 'visitado' ? 'selected' : ''}>Visitado</option>
            <option value="interesado" ${n.resultado === 'interesado' ? 'selected' : ''}>Interesado</option>
            <option value="cliente" ${n.resultado === 'cliente' ? 'selected' : ''}>Cliente</option>
            <option value="no_interesado" ${n.resultado === 'no_interesado' ? 'selected' : ''}>No interesado</option>
          </select>
          <button onclick="chatDesdeHistorial(${n.id})" style="background:var(--accent-dim);border:1px solid rgba(245,166,35,0.3);color:var(--accent);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
            💬 Chat
          </button>
          <button onclick="editarVisitado(${n.id})" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
            ✏️ Editar
          </button>
          <button onclick="desmarcarVisitado('${nombreEsc}','${dirEsc}')" style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.25);color:#ff4d4d;padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
            🗑️
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

async function chatDesdeHistorial(id) {
  try {
    const res = await fetch('/historial');
    const data = await res.json();
    const n = data.negocios.find(x => x.id === id);
    if (!n) return;

    // Construir objeto negocio compatible con el chat
    negocioActivo = {
      nombre: n.nombre,
      direccion: n.direccion,
      tipo: n.tipo_negocio || 'negocio',
      razon: n.notas || 'Cliente visitado',
      telefono: n.telefono,
      horario: n.horario,
      email: n.email,
      tipo_negocio: n.tipo_negocio,
      nivel_operativo: n.nivel_operativo,
      notas: n.notas,
    };

    historialChat = [];
    activarChat(negocioActivo);
    goTo('chat', document.querySelectorAll('.nav-btn')[3]);
  } catch(e) {
    showToast('❌ Error al abrir chat');
  }
}

function desmarcarVisitado(nombre, direccion) {
  // Toast de confirmación personalizado
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <span>¿Desmarcar "${nombre}"?</span>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button onclick="confirmarDesmarcar('${nombre.replace(/'/g,"\\'")}','${direccion.replace(/'/g,"\\'")}');this.closest('#toast').classList.remove('show')" 
        style="background:#ff4d4d;border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Confirmar
      </button>
      <button onclick="document.getElementById('toast').classList.remove('show')"
        style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Cancelar
      </button>
    </div>`;
  toast.classList.add('show');
}

async function confirmarDesmarcar(nombre, direccion) {
  try {
    await fetch('/desmarcar-visitado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, direccion })
    });
    showToast('↩️ Negocio desmarcado');
    cargarDashboard();
  } catch(e) {
    showToast('❌ Error al desmarcar');
  }
}

function formatearHorario(horario) {
  if (!horario) return '';

  const dias = {
    'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles',
    'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado', 'Sunday': 'Domingo'
  };

  const lineas = horario.split(' | ');

  const parseadas = lineas.map(linea => {
    // Extraer día y horario
    const match = linea.match(/^(\w+):\s*(.+)$/);
    if (!match) return null;
    const dia = dias[match[1]] || match[1];
    let horas = match[2];

    if (horas === 'Closed') return { dia, horas: 'Cerrado' };

    // Convertir AM/PM a formato 24h
    horas = horas.replace(/(\d+):(\d+)\s*(AM|PM)/g, (_, h, m, ampm) => {
      let hora = parseInt(h);
      if (ampm === 'PM' && hora !== 12) hora += 12;
      if (ampm === 'AM' && hora === 12) hora = 0;
      return m === '00' ? `${hora}h` : `${hora}:${m}h`;
    });

    // Limpiar separadores
    horas = horas.replace(' – ', ' a ').replace(', ', ' / ');

    return { dia, horas };
  }).filter(Boolean);

  // Agrupar días consecutivos con el mismo horario
  const grupos = [];
  parseadas.forEach(({ dia, horas }) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.horas === horas) {
      ultimo.hasta = dia;
    } else {
      grupos.push({ desde: dia, hasta: null, horas });
    }
  });

  return grupos.map(g => {
    const rango = g.hasta ? `${g.desde} a ${g.hasta}` : g.desde;
    return `<div style="margin-bottom:2px;"><span style="color:var(--text);">${rango}:</span> ${g.horas}</div>`;
  }).join('');
}
