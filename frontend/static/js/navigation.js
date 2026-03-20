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
  if (name === 'chat' && !negocioActivo) activarChat(null);
}

let departamentosData = {};

async function cargarBarrios() {
  try {
    const res = await authFetch('/departamentos');
    const data = await res.json();
    departamentosData = data.departamentos;

    // Poblar selector de departamento
    const depSelect = document.getElementById('departamento');
    if (depSelect) {
      depSelect.innerHTML = Object.keys(departamentosData)
        .map(d => `<option value="${d}">${d}</option>`)
        .join('');
      depSelect.value = 'Montevideo';
      onDepartamentoChange();
    }

    // Poblar filtro de barrios del dashboard con todos los barrios
    const filtro = document.getElementById('filtroBarrio');
    if (filtro) {
      const todos = Object.values(departamentosData).flat().sort((a, b) => a.localeCompare(b));
      filtro.innerHTML = '<option value="">Todos los barrios</option>' +
        todos.map(b => `<option value="${b}">${b}</option>`).join('');
    }
  } catch (e) {
    document.getElementById('barrio').innerHTML = '<option value="Pocitos">Pocitos</option>';
  }
}

function onDepartamentoChange() {
  const dep = document.getElementById('departamento')?.value;
  const barrios = departamentosData[dep] || [];
  document.getElementById('barrio').innerHTML =
    barrios.map(b => `<option value="${b}">${b}</option>`).join('');
}
