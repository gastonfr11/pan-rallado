// ── CHAT ──────────────────────────────────────────────
async function abrirChatNegocio(i) {
  seleccionarNegocio(i);
  const nuevo = { ...negociosData[i] };

  try {
    const res = await fetch('/historial');
    const data = await res.json();
    const guardado = data.negocios.find(n => n.nombre === nuevo.nombre);
    if (guardado) {
      if (guardado.telefono) nuevo.telefono = guardado.telefono;
      if (guardado.horario) nuevo.horario = guardado.horario;
      if (guardado.email) nuevo.email = guardado.email;
      if (guardado.tipo_negocio) nuevo.tipo_negocio = guardado.tipo_negocio;
      if (guardado.nivel_operativo) nuevo.nivel_operativo = guardado.nivel_operativo;
      if (guardado.notas) nuevo.notas = guardado.notas;
    }
  } catch(e) {}

  if (!nuevo.telefono) {
    try {
      const res = await fetch(`/place-details?nombre=${encodeURIComponent(nuevo.nombre)}&direccion=${encodeURIComponent(nuevo.direccion)}`);
      const data = await res.json();
      if (data.telefono) nuevo.telefono = data.telefono;
      if (data.horario) nuevo.horario = data.horario;
    } catch(e) {}
  }

  if (!negocioActivo || negocioActivo.nombre !== nuevo.nombre) {
    negocioActivo = nuevo;
    historialChat = [];
    activarChat(nuevo);
  }
  goTo('chat', document.querySelectorAll('.nav-btn')[3]);
}

function activarChat(negocio) {
  negocioActivo = negocio || null;
  historialChat = [];
  document.getElementById('chatEmpty').style.display = 'none';
  document.getElementById('chatMessages').style.display = 'flex';
  document.getElementById('chatInputBar').style.display = 'flex';
  document.getElementById('quickActionsBar').style.display = negocio ? 'flex' : 'none';
  document.getElementById('chatMessages').innerHTML = '';
  if (!negocio) {
    document.querySelectorAll('.chat-negocio-chip').forEach(c => c.classList.remove('activo'));
  }
  const msg = negocio
    ? `Listo para ${negocio.nombre}. ¿Qué necesitás?`
    : `Hola, soy tu asistente comercial. Preguntame sobre zonas, estrategias, precios, o lo que necesites.`;
  agregarMensaje('assistant', msg);
}

function resetChat() {
  negocioActivo = null;
  historialChat = [];
  document.getElementById('chatSelector').style.display = 'none';
  document.querySelectorAll('.chat-negocio-chip').forEach(c => c.classList.remove('activo'));
  activarChat(null);
}

function agregarMensaje(role, texto) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.textContent = texto;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  return d;
}

function agregarMensajeAccion(texto) {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'msg assistant';
  d.style.cssText = 'background:rgba(77,255,145,0.08);border:1px solid rgba(77,255,145,0.2);color:#4dff91;';
  d.textContent = texto;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  return d;
}

function agregarTyping() {
  const c = document.getElementById('chatMessages');
  const d = document.createElement('div');
  d.className = 'msg assistant';
  d.id = 'typing-indicator';
  d.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function quitarTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function quickAction(texto) {
  document.getElementById('chatInput').value = texto;
  enviarMensaje();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarMensaje();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

async function enviarMensaje() {
  const input = document.getElementById('chatInput');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('btnSend').disabled = true;

  agregarMensaje('user', texto);
  historialChat.push({ role: 'user', content: texto });
  agregarTyping();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajes: historialChat, negocio: negocioActivo || null })
    });
    const data = await res.json();
    quitarTyping();

    // Manejar tool ejecutada
    if (data.tool_ejecutada) {
      agregarMensajeAccion(data.respuesta);
      historialChat.push({ role: 'assistant', content: data.respuesta });

      // Si la tool fue buscar_negocios, disparar la búsqueda en el frontend
      if (data.tool_ejecutada === 'buscar_negocios') {
        const { barrio, modo } = data.tool_input;
        await ejecutarBusquedaDesdeChat(barrio, modo);
      }

      // Si marcó como visitado, actualizar el botón en la lista si existe
      if (data.tool_ejecutada === 'marcar_visitado' && negocioActivo) {
        const idx = negociosData.findIndex(n => n.nombre === negocioActivo.nombre);
        if (idx >= 0) {
          const btn = document.getElementById(`visitado-${idx}`);
          if (btn) { btn.classList.add('marcado'); btn.disabled = true; btn.textContent = '✅ Visitado'; }
        }
      }
    } else {
      // Respuesta de texto normal
      agregarMensaje('assistant', data.respuesta);
      historialChat.push({ role: 'assistant', content: data.respuesta });
    }

  } catch (e) {
    quitarTyping();
    agregarMensaje('assistant', '❌ Error al conectar.');
  } finally {
    document.getElementById('btnSend').disabled = false;
    input.focus();
  }
}

async function ejecutarBusquedaDesdeChat(barrio, modo) {
  agregarTyping();
  try {
    const res = await fetch('/generar-roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barrio, enviar_whatsapp: false, modo: modo || 'chico' })
    });
    const data = await res.json();
    quitarTyping();

    if (data.error) {
      agregarMensaje('assistant', '⚠️ ' + data.error);
      return;
    }

    negociosData = data.seleccionados;
    resetChat();
    mostrarResultados(data);
    agregarMensajeAccion(`✅ Encontré ${data.seleccionados.length} negocios en ${barrio}. Podés verlos en Lista o Mapa.`);
    showToast(`✅ ${data.seleccionados.length} negocios en ${barrio}`);

  } catch(e) {
    quitarTyping();
    agregarMensaje('assistant', '❌ Error al buscar negocios.');
  }
}