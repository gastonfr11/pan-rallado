// ── UTILS ─────────────────────────────────────────────

// Escapa HTML para uso seguro dentro de innerHTML
function _esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Escapa para uso en atributos HTML (incluye comillas simples)
function _escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function mapaNocturno() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c54' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c7a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];
}
