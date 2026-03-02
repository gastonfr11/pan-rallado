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
    const res = await fetch('/generar-mensaje-wpp', {
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

  const fecha = new Date().toLocaleDateString('es-UY');
  const total = negocios.length;
  const clientes = negocios.filter(n => n.resultado === 'cliente').length;
  const interesados = negocios.filter(n => n.resultado === 'interesado').length;
  const noInteresados = negocios.filter(n => n.resultado === 'no_interesado').length;
  const conversion = total > 0 ? Math.round((clientes / total) * 100) : 0;

  const estadoColor = { cliente: '#4dff91', interesado: '#f5a623', no_interesado: '#ff4d4d', visitado: '#888' };
  const estadoLabel = { cliente: 'Cliente', interesado: 'Interesado', no_interesado: 'No interesado', visitado: 'Visitado' };

  const filas = negocios.map(n => `
    <tr>
      <td>${n.nombre}</td>
      <td>${n.direccion ? n.direccion.split(',')[0] : '—'}</td>
      <td>${n.barrio || '—'}</td>
      <td><span style="color:${estadoColor[n.resultado] || '#888'};font-weight:600;">${estadoLabel[n.resultado] || 'Visitado'}</span></td>
      <td>${n.telefono || '—'}</td>
      <td>${n.tipo_negocio || '—'}</td>
      <td>${n.notas || '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reporte de Visitas - ${fecha}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #222; padding: 30px; font-size: 12px; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #f5a623; padding-bottom: 16px; }
    .header h1 { font-size: 22px; color: #f5a623; letter-spacing: 2px; }
    .header p { color: #666; margin-top: 4px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat { flex: 1; background: #f8f8f8; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-value { font-size: 22px; font-weight: 700; color: #333; }
    .stat-label { font-size: 10px; color: #888; text-transform: uppercase; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f5a623; color: white; }
    th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; text-align: center; color: #aaa; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🥖 REPORTE DE VISITAS</h1>
    <p>Generado el ${fecha} · Pan Rallado Distribuidora · Montevideo</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Visitados</div></div>
    <div class="stat"><div class="stat-value">${clientes}</div><div class="stat-label">Clientes</div></div>
    <div class="stat"><div class="stat-value">${interesados}</div><div class="stat-label">Interesados</div></div>
    <div class="stat"><div class="stat-value">${noInteresados}</div><div class="stat-label">No interesados</div></div>
    <div class="stat"><div class="stat-value">${conversion}%</div><div class="stat-label">Conversión</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Nombre</th><th>Dirección</th><th>Barrio</th><th>Estado</th>
        <th>Teléfono</th><th>Tipo</th><th>Notas</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="footer">Pan Rallado · Agente de Ventas · ${fecha}</div>
</body>
</html>`;

  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  ventana.onload = () => {
    ventana.print();
  };
}