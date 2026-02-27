// ── CHAT ──────────────────────────────────────────────
function abrirChatNegocio(i) {
  seleccionarNegocio(i);
  const nuevo = negociosData[i];
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
    historialChat.push({ role: 'assistant', content: data.respuesta });
    agregarMensaje('assistant', data.respuesta);
  } catch (e) {
    quitarTyping();
    agregarMensaje('assistant', '❌ Error al conectar.');
  } finally {
    document.getElementById('btnSend').disabled = false;
    input.focus();
  }
}
