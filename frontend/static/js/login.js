// ── AUTH ──────────────────────────────────────────────
async function checkAuth() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    mostrarLogin();
    return;
  }
  try {
    const res = await fetch('/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      mostrarLogin();
      return;
    }
    const user = await res.json();
    currentUser = user;
    mostrarApp(user);
  } catch (e) {
    mostrarLogin();
  }
}

async function iniciarSesion() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('btnLogin');
  const error = document.getElementById('loginError');

  if (!email || !password) {
    error.textContent = 'Completá todos los campos';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'ENTRANDO...';
  error.textContent = '';

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      error.textContent = data.detail || 'Error al iniciar sesión';
      return;
    }
    localStorage.setItem('authToken', data.token);
    currentUser = data.usuario;
    mostrarApp(data.usuario);
  } catch (e) {
    error.textContent = 'Error de conexión';
  } finally {
    btn.disabled = false;
    btn.textContent = 'ENTRAR';
  }
}

function mostrarLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent = '';
}

function mostrarApp(user) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('userInfo').style.display = 'flex';
  document.getElementById('userName').textContent = user.nombre;

  const btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) btnAdmin.style.display = user.rol === 'admin' ? 'inline-block' : 'none';

  cargarBarrios();
}

function abrirAdminDrawer() {
  const drawer = document.getElementById('adminDrawer');
  const backdrop = document.getElementById('adminDrawerBackdrop');
  backdrop.style.display = 'block';
  drawer.style.right = '0';
  cargarAdminPanel();
}

function cerrarAdminDrawer() {
  const drawer = document.getElementById('adminDrawer');
  const backdrop = document.getElementById('adminDrawerBackdrop');
  drawer.style.right = '-100%';
  backdrop.style.display = 'none';
}

function logout() {
  localStorage.removeItem('authToken');
  currentUser = null;
  mostrarLogin();
}

async function cargarAdminPanel() {
  try {
    const res = await authFetch('/admin/usuarios');
    const data = await res.json();
    renderAdminUsuarios(data.usuarios);

    const statsRes = await authFetch('/admin/stats');
    const statsData = await statsRes.json();
    renderAdminStats(statsData.stats);
  } catch (e) {}
}

function renderAdminUsuarios(usuarios) {
  const lista = document.getElementById('adminUsuariosList');
  if (!lista) return;

  lista.innerHTML = usuarios.map(u => `
    <div class="admin-user-row">
      <div class="admin-user-info">
        <div class="admin-user-nombre">${u.nombre}</div>
        <div class="admin-user-email">${u.email} <span class="admin-user-rol rol-${u.rol}">${u.rol}</span></div>
      </div>
      ${u.rol !== 'admin' ? `<button class="btn-admin-delete" onclick="eliminarUsuario(${u.id}, '${u.nombre.replace(/'/g, "\\'")}')">✕</button>` : ''}
    </div>`).join('');
}

function renderAdminStats(stats) {
  const container = document.getElementById('adminStatsContainer');
  if (!container) return;

  if (!stats.length) {
    container.innerHTML = '<div style="font-size:0.82rem;color:var(--text-dim);padding:8px 0;">Sin vendedores registrados.</div>';
    return;
  }

  container.innerHTML = stats.map(s => {
    const conversion = s.tasa_conversion != null ? parseFloat(s.tasa_conversion) : 0;
    const ultimaAct = s.ultima_actividad
      ? new Date(s.ultima_actividad).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Sin actividad';

    return `
    <div class="admin-stat-card" id="statCard-${s.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div>
          <div class="admin-stat-nombre">${s.nombre}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px;">${s.email}</div>
        </div>
        <button
          onclick="toggleNegociosVendedor(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')"
          id="btnToggle-${s.id}"
          style="flex-shrink:0;background:var(--surface2);border:1px solid var(--border);color:var(--text-mid);padding:4px 10px;border-radius:8px;font-size:0.72rem;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;">
          Ver negocios ▾
        </button>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
        <span class="admin-stat-num">${s.visitados} visitas</span>
        <span class="admin-stat-num cliente">${s.clientes} clientes</span>
        <span class="admin-stat-num interesado">${s.interesados} interesados</span>
        <span class="admin-stat-num no-int">${s.no_interesados} no int.</span>
        <span class="admin-stat-num barrio">${s.barrios_visitados} barrio${s.barrios_visitados !== 1 ? 's' : ''}</span>
      </div>

      <div style="margin-top:10px;">
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);margin-bottom:4px;">
          <span>Conversión</span><span style="color:${conversion >= 30 ? '#4dff91' : conversion >= 10 ? 'var(--accent)' : 'var(--text-dim)'};">${conversion}%</span>
        </div>
        <div style="height:4px;background:var(--surface2);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(conversion, 100)}%;background:${conversion >= 30 ? '#4dff91' : conversion >= 10 ? 'var(--accent)' : '#555'};border-radius:4px;transition:width 0.4s;"></div>
        </div>
      </div>

      <div style="margin-top:8px;font-size:0.72rem;color:var(--text-dim);">Última actividad: <span style="color:var(--text-mid);">${ultimaAct}</span></div>

      <div id="negociosVendedor-${s.id}" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px;"></div>
    </div>`;
  }).join('');
}

async function toggleNegociosVendedor(vendedorId, nombre) {
  const container = document.getElementById(`negociosVendedor-${vendedorId}`);
  const btn = document.getElementById(`btnToggle-${vendedorId}`);
  if (!container) return;

  const abierto = container.style.display !== 'none';
  if (abierto) {
    container.style.display = 'none';
    btn.textContent = 'Ver negocios ▾';
    return;
  }

  container.style.display = 'block';
  btn.textContent = 'Ocultar ▴';
  container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);">Cargando...</div>';

  try {
    const res = await authFetch(`/admin/vendedor/${vendedorId}/negocios`);
    const data = await res.json();
    const negocios = data.negocios;

    if (!negocios.length) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);text-align:center;padding:8px 0;">Sin negocios visitados aún.</div>';
      return;
    }

    const estadoColor = { cliente: '#4dff91', interesado: '#f5a623', no_interesado: '#ff4d4d', visitado: '#888' };
    const estadoLabel = { cliente: 'Cliente', interesado: 'Interesado', no_interesado: 'No int.', visitado: 'Visitado' };

    container.innerHTML = `
      <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:8px;">${negocios.length} negocio${negocios.length !== 1 ? 's' : ''} visitado${negocios.length !== 1 ? 's' : ''}</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${negocios.map(n => {
          const fecha = n.fecha_ultima_visita
            ? new Date(n.fecha_ultima_visita).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';
          const color = estadoColor[n.resultado] || '#888';
          const label = estadoLabel[n.resultado] || 'Visitado';
          return `
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:9px 12px;display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">
              <div style="font-size:0.82rem;font-weight:600;color:var(--text);line-height:1.3;">${n.nombre}</div>
              <span style="flex-shrink:0;font-size:0.65rem;color:${color};background:${color}1a;border:1px solid ${color}44;padding:2px 7px;border-radius:20px;">${label}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-dim);">📍 ${n.direccion ? n.direccion.split(',')[0] : '—'} ${n.barrio ? '· ' + n.barrio : ''}</div>
            <div style="font-size:0.7rem;color:var(--text-dim);">📅 ${fecha}${n.tipo_negocio ? ' · ' + n.tipo_negocio : ''}</div>
            ${n.notas ? `<div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;line-height:1.4;">💬 ${n.notas}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  } catch(e) {
    container.innerHTML = '<div style="font-size:0.8rem;color:#ff4d4d;">Error al cargar negocios.</div>';
  }
}

async function crearVendedor() {
  const nombre = document.getElementById('nuevoNombre').value.trim();
  const email = document.getElementById('nuevoEmail').value.trim();
  const password = document.getElementById('nuevoPassword').value;
  const error = document.getElementById('adminCreateError');

  if (!nombre || !email || !password) {
    error.textContent = 'Completá todos los campos';
    return;
  }

  error.textContent = '';
  try {
    const res = await authFetch('/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, rol: 'vendedor' })
    });
    const data = await res.json();
    if (!res.ok) {
      error.textContent = data.detail || 'Error al crear usuario';
      return;
    }
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevoEmail').value = '';
    document.getElementById('nuevoPassword').value = '';
    showToast('✅ Vendedor creado');
    cargarAdminPanel();
  } catch (e) {
    error.textContent = 'Error de conexión';
  }
}

async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
  try {
    const res = await authFetch(`/admin/usuarios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('✅ Usuario eliminado');
      cargarAdminPanel();
    } else {
      showToast('❌ Error al eliminar');
    }
  } catch (e) {
    showToast('❌ Error de conexión');
  }
}

window.addEventListener('load', checkAuth);
