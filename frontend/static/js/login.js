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

  const adminPanel = document.getElementById('adminPanel');
  if (adminPanel) {
    adminPanel.style.display = user.rol === 'admin' ? 'block' : 'none';
  }

  cargarBarrios();

  if (user.rol === 'admin') {
    cargarAdminPanel();
  }
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
  if (!container || !stats.length) return;

  container.innerHTML = stats.map(s => `
    <div class="admin-stat-row">
      <div class="admin-stat-nombre">${s.nombre}</div>
      <div class="admin-stat-nums">
        <span class="admin-stat-num">${s.visitados} visitas</span>
        <span class="admin-stat-num cliente">${s.clientes} clientes</span>
        <span class="admin-stat-num interesado">${s.interesados} interesados</span>
      </div>
    </div>`).join('');
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
