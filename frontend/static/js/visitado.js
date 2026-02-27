// ── MODAL VISITADO ────────────────────────────────────
async function marcarVisitado(i) {
  const negocio = negociosData[i];
  const btn = document.getElementById(`visitado-${i}`);
  if (!negocio || btn.classList.contains('marcado')) return;

  negocioParaVisitar = { ...negocio, index: i };
  window._negocioParaVisitar = negocioParaVisitar;

  document.getElementById('modalNombre').textContent = negocio.nombre;
  document.getElementById('modalEstado').value = 'visitado';
  document.getElementById('modalTelefono').value = '';
  document.getElementById('modalHorario').value = '';
  document.getElementById('modalEmail').value = '';
  document.getElementById('modalTipoNegocio').value = negocio.tipo || '';
  document.getElementById('modalNivel').value = '';
  document.getElementById('modalRotiseria').checked = false;
  document.getElementById('modalProduccion').checked = false;
  document.getElementById('modalNotas').value = '';
  document.getElementById('modalVisitado').classList.add('show');

  // Intentar obtener datos de Google Places automáticamente
  try {
    const res = await fetch(`/place-details?nombre=${encodeURIComponent(negocio.nombre)}&direccion=${encodeURIComponent(negocio.direccion)}`);
    const data = await res.json();
    if (data.telefono) document.getElementById('modalTelefono').value = data.telefono;
    if (data.horario) document.getElementById('modalHorario').value = data.horario;
  } catch (e) {}
}

async function editarVisitado(id) {
  try {
    const res = await fetch('/historial');
    const data = await res.json();
    const n = data.negocios.find(x => x.id === id);
    if (!n) return;

    window._negocioParaVisitar = { nombre: n.nombre, direccion: n.direccion, index: null };
    document.getElementById('modalNombre').textContent = n.nombre;
    document.getElementById('modalEstado').value = n.resultado || 'visitado';
    document.getElementById('modalTelefono').value = n.telefono || '';
    document.getElementById('modalEmail').value = n.email || '';
    document.getElementById('modalHorario').value = n.horario || '';
    document.getElementById('modalTipoNegocio').value = n.tipo_negocio || '';
    document.getElementById('modalNivel').value = n.nivel_operativo || '';
    document.getElementById('modalRotiseria').checked = n.tiene_rotiseria || false;
    document.getElementById('modalProduccion').checked = n.tiene_produccion_propia || false;
    document.getElementById('modalNotas').value = n.notas || '';
    document.getElementById('modalVisitado').classList.add('show');
  } catch (e) {
    showToast('❌ Error al cargar datos');
  }
}

function cerrarModal() {
  document.getElementById('modalVisitado').classList.remove('show');
  negocioParaVisitar = null;
  window._negocioParaVisitar = null;
}

async function guardarVisita() {
  const negocioParaVisitar = window._negocioParaVisitar;
  if (!negocioParaVisitar) return;

  const payload = {
    nombre: negocioParaVisitar.nombre,
    direccion: negocioParaVisitar.direccion,
    resultado: document.getElementById('modalEstado').value,
    telefono: document.getElementById('modalTelefono').value || null,
    email: document.getElementById('modalEmail').value || null,
    horario: document.getElementById('modalHorario').value || null,
    nivel_operativo: document.getElementById('modalNivel').value || null,
    tipo_negocio: document.getElementById('modalTipoNegocio').value || null,
    tiene_rotiseria: document.getElementById('modalRotiseria').checked,
    tiene_produccion_propia: document.getElementById('modalProduccion').checked,
    notas: document.getElementById('modalNotas').value || ''
  };

  try {
    const res = await fetch('/marcar-visitado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      if (negocioParaVisitar.index !== null) {
        const btn = document.getElementById(`visitado-${negocioParaVisitar.index}`);
        if (btn) { btn.classList.add('marcado'); btn.disabled = true; btn.textContent = '✅ Visitado'; }
      }
      cerrarModal();
      showToast(`✅ ${negocioParaVisitar.nombre} guardado`);
    } else {
      showToast('❌ Error al guardar');
    }
  } catch (e) {
    showToast('❌ Error al guardar');
  }
}
