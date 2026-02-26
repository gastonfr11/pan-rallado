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
    const res = await fetch('/barrios');
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
