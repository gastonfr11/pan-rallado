// ── DASHBOARD ─────────────────────────────────────────
function onFiltroFechaChange() {
  const v = document.getElementById('filtroFecha').value;
  document.getElementById('filtroFechaEspecificaWrap').style.display = v === 'especifica' ? 'block' : 'none';
  cargarDashboard();
}

function _fechaSoloFecha(isoStr) {
  // Devuelve string "YYYY-MM-DD" en hora local a partir de un ISO string
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function cargarDashboard() {
  const barrio = document.getElementById('filtroBarrio').value;
  const estado = document.getElementById('filtroEstado').value;
  const busqueda = document.getElementById('filtroBusqueda').value.toLowerCase();
  const filtroFecha = document.getElementById('filtroFecha').value;
  const fechaEspecifica = document.getElementById('filtroFechaEspecifica').value; // "YYYY-MM-DD"

  try {
    const url = barrio ? `/historial?barrio=${encodeURIComponent(barrio)}` : '/historial';
    const res = await authFetch(url);
    const data = await res.json();

    let negocios = data.negocios.filter(n => n.visitado);
    if (estado) negocios = negocios.filter(n => n.resultado === estado);
    if (busqueda) negocios = negocios.filter(n => n.nombre.toLowerCase().includes(busqueda));

    if (filtroFecha) {
      const hoy = new Date();
      const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

      if (filtroFecha === 'hoy') {
        negocios = negocios.filter(n => _fechaSoloFecha(n.fecha_ultima_visita) === hoyStr);
      } else if (filtroFecha === 'semana') {
        // Lunes de la semana actual
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        lunes.setHours(0, 0, 0, 0);
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        domingo.setHours(23, 59, 59, 999);
        negocios = negocios.filter(n => {
          if (!n.fecha_ultima_visita) return false;
          const d = new Date(n.fecha_ultima_visita);
          return d >= lunes && d <= domingo;
        });
      } else if (filtroFecha === 'mes') {
        negocios = negocios.filter(n => {
          if (!n.fecha_ultima_visita) return false;
          const d = new Date(n.fecha_ultima_visita);
          return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
        });
      } else if (filtroFecha === 'especifica' && fechaEspecifica) {
        negocios = negocios.filter(n => _fechaSoloFecha(n.fecha_ultima_visita) === fechaEspecifica);
      }
    }

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

    const lista = document.getElementById('dashboardLista');
    if (negocios.length === 0) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Sin resultados</h3><p>No hay negocios visitados con esos filtros.</p></div>`;
      return;
    }

    lista.innerHTML = negocios.map(n => `
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
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Nivel</div><div class="dashboard-detalle-valor">${n.nivel_operativo ? n.nivel_operativo.replace('_', ' ') : '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Email</div><div class="dashboard-detalle-valor">${n.email || '—'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Rotisería propia</div><div class="dashboard-detalle-valor">${n.tiene_rotiseria ? '✅ Sí' : '❌ No'}</div></div>
          <div class="dashboard-detalle"><div class="dashboard-detalle-label">Producción propia</div><div class="dashboard-detalle-valor">${n.tiene_produccion_propia ? '✅ Sí' : '❌ No'}</div></div>
          <div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Horario</div><div class="dashboard-detalle-valor">${n.horario ? formatearHorario(n.horario) : '—'}</div></div>
          <div class="dashboard-detalle" style="grid-column:1/-1;"><div class="dashboard-detalle-label">Notas</div><div class="dashboard-detalle-valor">${n.notas || '—'}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <select class="dashboard-select-estado" style="flex:1;min-width:100px;" data-id="${n.id}">
            <option value="visitado" ${n.resultado === 'visitado' ? 'selected' : ''}>Visitado</option>
            <option value="interesado" ${n.resultado === 'interesado' ? 'selected' : ''}>Interesado</option>
            <option value="cliente" ${n.resultado === 'cliente' ? 'selected' : ''}>Cliente</option>
            <option value="no_interesado" ${n.resultado === 'no_interesado' ? 'selected' : ''}>No interesado</option>
          </select>
          ${n.telefono ? (esTelefonoMovil(n.telefono)
            ? `<button data-action="wpp" data-id="${n.id}" style="background:rgba(37,211,102,0.1);border:1px solid rgba(37,211,102,0.3);color:#25d366;padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">📲 WhatsApp</button>`
            : `<a href="tel:${n.telefono}" style="background:rgba(100,200,255,0.1);border:1px solid rgba(100,200,255,0.3);color:#64c8ff;padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;">📞 Llamar</a>`
          ) : ''}
          <button data-action="chat" data-id="${n.id}" style="background:var(--accent-dim);border:1px solid rgba(245,166,35,0.3);color:var(--accent);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">💬 Chat</button>
          <button data-action="historial" data-id="${n.id}" style="background:rgba(120,120,255,0.08);border:1px solid rgba(120,120,255,0.25);color:#9090ff;padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">📅 Historial</button>
          <button data-action="editar" data-id="${n.id}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">✏️ Editar</button>
          <button data-action="desmarcar" data-id="${n.id}" style="background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.25);color:#ff4d4d;padding:9px 14px;border-radius:10px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">🗑️</button>
        </div>
      </div>`).join('');

    window._dashboardNegocios = negocios;

    lista.addEventListener('change', e => {
      if (e.target.classList.contains('dashboard-select-estado')) {
        const id = parseInt(e.target.dataset.id);
        const n = window._dashboardNegocios.find(x => x.id === id);
        if (n) actualizarEstado(n.nombre, n.direccion, e.target.value);
      }
    });

    lista.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      const accion = btn.dataset.action;
      if (accion === 'chat') chatDesdeHistorial(id);
      if (accion === 'historial') abrirHistorialVisitas(id);
      if (accion === 'editar') editarVisitado(id);
      if (accion === 'desmarcar') desmarcarVisitado(id);
      if (accion === 'wpp') abrirModalWpp(id);
    });

  } catch (e) {
    document.getElementById('dashboardLista').innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><h3>Error al cargar</h3></div>`;
  }
}

async function actualizarEstado(nombre, direccion, nuevoEstado) {
  try {
    await authFetch('/marcar-visitado', {
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
    const n = window._dashboardNegocios?.find(x => x.id === id);
    if (!n) return;
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

function desmarcarVisitado(id) {
  const n = window._dashboardNegocios?.find(x => x.id === id);
  if (!n) return;
  const toast = document.getElementById('toast');
  toast.innerHTML = `
    <span>¿Desmarcar "${n.nombre}"?</span>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button id="btnConfirmarDesmarcar" style="background:#ff4d4d;border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Confirmar</button>
      <button onclick="document.getElementById('toast').classList.remove('show')" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Cancelar</button>
    </div>`;
  toast.classList.add('show');
  document.getElementById('btnConfirmarDesmarcar').onclick = () => confirmarDesmarcar(n.nombre, n.direccion);
}

async function confirmarDesmarcar(nombre, direccion) {
  document.getElementById('toast').classList.remove('show');
  try {
    await authFetch('/desmarcar-visitado', {
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

// ── WHATSAPP ──────────────────────────────────────────
function abrirModalWpp(id) {
  const n = window._dashboardNegocios?.find(x => x.id === id);
  if (!n) return;
  window._wppNegocio = n;

  // Crear modal si no existe
  let modal = document.getElementById('modalWpp');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalWpp';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);z-index:300;overflow-y:auto;padding:20px 16px;';
    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;width:100%;max-width:440px;margin:auto;display:flex;flex-direction:column;gap:14px;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#25d366;letter-spacing:1.5px;">📲 WHATSAPP</div>
        <div id="wppNombreNegocio" style="font-size:0.95rem;font-weight:600;color:var(--text);padding-bottom:12px;border-bottom:1px solid var(--border);"></div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:0.7rem;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;">Tipo de mensaje</label>
          <div style="position:relative;">
            <select id="wppTipo" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:10px;font-size:0.9rem;font-family:'DM Sans',sans-serif;outline:none;appearance:none;">
              <option value="presentacion">👋 Presentación comercial</option>
              <option value="seguimiento">📋 Seguimiento post-visita</option>
              <option value="oferta">🎯 Oferta o promoción</option>
              <option value="recordatorio">🔔 Recordatorio de pedido</option>
            </select>
            <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-mid);pointer-events:none;">▾</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:0.7rem;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;">Vista previa del mensaje</label>
          <textarea id="wppPreview" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:10px;font-size:0.85rem;font-family:'DM Sans',sans-serif;outline:none;resize:none;line-height:1.5;" placeholder="Generando..."></textarea>
        </div>
        <div style="display:flex;gap:10px;">
          <button id="btnWppCancelar" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:13px;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:1.5px;cursor:pointer;">CANCELAR</button>
          <button id="btnWppGenerar" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:13px;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:1.5px;cursor:pointer;">🔄 GENERAR</button>
          <button id="btnWppEnviar" style="flex:2;background:#25d366;border:none;color:#fff;padding:13px;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:1.5px;cursor:pointer;">ABRIR WPP ↗</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('btnWppCancelar').onclick = cerrarModalWpp;
    document.getElementById('btnWppGenerar').onclick = generarMensajeWpp;
    document.getElementById('btnWppEnviar').onclick = abrirWhatsApp;
  }

  document.getElementById('wppNombreNegocio').textContent = n.nombre;
  modal.style.display = 'flex';
  modal.style.alignItems = 'flex-start';
  modal.style.justifyContent = 'center';
  generarMensajeWpp();
}

function cerrarModalWpp() {
  const modal = document.getElementById('modalWpp');
  if (modal) modal.style.display = 'none';
  window._wppNegocio = null;
}

async function generarMensajeWpp() {
  const n = window._wppNegocio;
  if (!n) return;
  const tipo = document.getElementById('wppTipo').value;
  const preview = document.getElementById('wppPreview');
  const btnGenerar = document.getElementById('btnWppGenerar');

  preview.value = 'Generando...';
  btnGenerar.disabled = true;

  try {
    const res = await authFetch('/generar-mensaje-wpp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio: n, tipo })
    });
    const data = await res.json();
    preview.value = data.mensaje;
  } catch(e) {
    preview.value = 'Error al generar el mensaje.';
  } finally {
    btnGenerar.disabled = false;
  }
}

function abrirWhatsApp() {
  const n = window._wppNegocio;
  if (!n || !n.telefono) return;
  const mensaje = document.getElementById('wppPreview').value;
  if (!mensaje) return;

  // Limpiar teléfono — sacar espacios y guiones, agregar código de país Uruguay si no tiene
  let tel = n.telefono.replace(/[\s\-]/g, '');
  if (!tel.startsWith('+') && !tel.startsWith('598')) tel = '598' + tel;
  tel = tel.replace('+', '');

  const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
  cerrarModalWpp();
}

// ── HISTORIAL DE VISITAS ──────────────────────────────
function _esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function abrirHistorialVisitas(id) {
  const n = window._dashboardNegocios?.find(x => x.id === id);
  if (!n) return;

  let modal = document.getElementById('modalHistorial');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalHistorial';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);z-index:300;overflow-y:auto;padding:20px 16px;';
    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;width:100%;max-width:480px;margin:auto;display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#9090ff;letter-spacing:1.5px;">📅 HISTORIAL</div>
          <button id="btnHistorialCerrar" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:5px 12px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">✕ Cerrar</button>
        </div>
        <div id="historialNombre" style="font-size:0.95rem;font-weight:600;color:var(--text);padding-bottom:12px;border-bottom:1px solid var(--border);"></div>
        <div id="historialLista" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('btnHistorialCerrar').onclick = () => { modal.style.display = 'none'; };
  }

  document.getElementById('historialNombre').textContent = n.nombre;
  document.getElementById('historialLista').innerHTML = '<div style="color:var(--text-mid);font-size:0.85rem;">Cargando...</div>';
  modal.style.display = 'flex';
  modal.style.alignItems = 'flex-start';
  modal.style.justifyContent = 'center';

  try {
    const res = await authFetch(`/visitas?negocio_id=${id}`);
    const data = await res.json();
    const visitas = data.visitas;

    if (visitas.length === 0) {
      document.getElementById('historialLista').innerHTML = `<div style="color:var(--text-mid);font-size:0.85rem;text-align:center;padding:16px 0;">Sin visitas registradas aún.<br><span style="font-size:0.75rem;">Las visitas se guardan a partir de ahora.</span></div>`;
      return;
    }

    document.getElementById('historialLista').innerHTML = visitas.map((v, i) => {
      const fecha = v.fecha ? new Date(v.fecha).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      return `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:0.78rem;color:var(--text-mid);">${i === 0 ? '🔵 Última visita · ' : ''}${fecha}</span>
          ${v.notas
            ? `<div style="font-size:0.85rem;color:var(--text);line-height:1.5;">${_esc(v.notas)}</div>`
            : `<div style="font-size:0.82rem;color:var(--text-mid);font-style:italic;">Sin nota</div>`}
        </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('historialLista').innerHTML = '<div style="color:#ff4d4d;font-size:0.85rem;">Error al cargar historial.</div>';
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

function esTelefonoMovil(tel) {
  if (!tel) return false;
  const limpio = tel.replace(/[\s\-\(\)]/g, '');
  // Uruguay: móviles empiezan con 09 o +5989
  return /^(09|(\+?598)?9)/.test(limpio);
}

// ── EXPORTAR ──────────────────────────────────────────
function exportarExcel() {
  const negocios = window._dashboardNegocios;
  if (!negocios || negocios.length === 0) {
    showToast('❌ No hay datos para exportar');
    return;
  }

  const fecha = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');

  const filas = negocios.map(n => ({
    'Nombre': n.nombre,
    'Dirección': n.direccion || '—',
    'Barrio': n.barrio || '—',
    'Estado': (n.resultado || 'visitado').replace('_', ' '),
    'Teléfono': n.telefono || '—',
    'Email': n.email || '—',
    'Tipo de negocio': n.tipo_negocio || '—',
    'Nivel operativo': n.nivel_operativo ? n.nivel_operativo.replace('_', ' ') : '—',
    'Rotisería propia': n.tiene_rotiseria ? 'Sí' : 'No',
    'Producción propia': n.tiene_produccion_propia ? 'Sí' : 'No',
    'Notas': n.notas || '—',
    'Fecha visita': n.fecha_ultima_visita ? new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY') : '—',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 14 },
    { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Visitas');
  XLSX.writeFile(wb, `reporte-visitas-${fecha}.xlsx`);
  showToast('✅ Excel descargado');
}

function exportarPDF() {
  const negocios = window._dashboardNegocios;
  if (!negocios || negocios.length === 0) {
    showToast('❌ No hay datos para exportar');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fecha = new Date().toLocaleDateString('es-UY');
  const total = negocios.length;
  const clientes = negocios.filter(n => n.resultado === 'cliente').length;
  const interesados = negocios.filter(n => n.resultado === 'interesado').length;
  const noInteresados = negocios.filter(n => n.resultado === 'no_interesado').length;
  const conversion = total > 0 ? Math.round((clientes / total) * 100) : 0;

  // Header
  doc.setFillColor(245, 166, 35);
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REPORTE DE VISITAS — PAN RALLADO', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el ${fecha}`, 240, 12);

  // Stats
  const stats = [
    { v: total, l: 'Visitados' },
    { v: clientes, l: 'Clientes' },
    { v: interesados, l: 'Interesados' },
    { v: noInteresados, l: 'No interesados' },
    { v: conversion + '%', l: 'Conversión' },
  ];
  const boxW = 48, boxH = 16, startX = 14, startY = 24;
  stats.forEach((s, i) => {
    const x = startX + i * (boxW + 4);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(x, startY, boxW, boxH, 2, 2, 'F');
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(s.v), x + boxW / 2, startY + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(s.l.toUpperCase(), x + boxW / 2, startY + 14, { align: 'center' });
  });

  // Tabla
  const estadoLabel = { cliente: 'Cliente', interesado: 'Interesado', no_interesado: 'No interesado', visitado: 'Visitado' };
  const estadoColor = { cliente: [77, 255, 145], interesado: [245, 166, 35], no_interesado: [255, 77, 77], visitado: [150, 150, 150] };

  doc.autoTable({
    startY: 46,
    head: [['Nombre', 'Dirección', 'Barrio', 'Estado', 'Teléfono', 'Tipo', 'Notas']],
    body: negocios.map(n => [
      n.nombre,
      n.direccion ? n.direccion.split(',')[0] : '—',
      n.barrio || '—',
      estadoLabel[n.resultado] || 'Visitado',
      n.telefono || '—',
      n.tipo_negocio || '—',
      n.notas || '—',
    ]),
    headStyles: { fillColor: [245, 166, 35], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 28 },
      6: { cellWidth: 'auto' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const resultado = negocios[data.row.index]?.resultado || 'visitado';
        const [r, g, b] = estadoColor[resultado] || [150, 150, 150];
        data.cell.styles.textColor = [r, g, b];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`Pan Rallado · Agente de Ventas · ${fecha} · Página ${i} de ${pageCount}`, 148, 205, { align: 'center' });
  }

  const fechaArchivo = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');
  doc.save(`reporte-visitas-${fechaArchivo}.pdf`);
  showToast('✅ PDF descargado');
}