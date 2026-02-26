// ── MAPA ──────────────────────────────────────────────
function iniciarMapa(negocios) {
  markers.forEach(m => m.setMap(null));
  markers = [];
  infoWindows = [];

  const centro = { lat: negocios[0].lat, lng: negocios[0].lng };

  if (!mapa) {
    mapa = new google.maps.Map(document.getElementById('mapa'), {
      zoom: 14, center: centro,
      styles: mapaNocturno(),
      mapTypeControl: false, streetViewControl: false,
      fullscreenControl: false, zoomControl: false,
    });
  } else {
    mapa.setCenter(centro);
    mapa.setZoom(14);
  }

  const bounds = new google.maps.LatLngBounds();

  negocios.forEach((n, i) => {
    const pos = { lat: n.lat, lng: n.lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos, map: mapa, title: n.nombre,
      label: { text: String(i + 1), color: '#000', fontWeight: 'bold', fontSize: '12px' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE, scale: 18,
        fillColor: '#f5a623', fillOpacity: 1,
        strokeColor: '#000', strokeWeight: 1.5,
      }
    });

    const iw = new google.maps.InfoWindow({
      content: `<div style="font-family:sans-serif;max-width:180px;padding:4px;">
        <strong style="font-size:13px;">${n.nombre}</strong>
        <p style="color:#555;font-size:11px;margin:4px 0;">${n.direccion.split(',')[0]}</p>
        <a href="https://waze.com/ul?ll=${n.lat},${n.lng}&navigate=yes" target="_blank"
          style="font-size:11px;color:#00b4ff;text-decoration:none;">🚗 Waze</a>
      </div>`
    });

    marker.addListener('click', () => {
      infoWindows.forEach(w => w.close());
      iw.open(mapa, marker);
      seleccionarNegocio(i);
    });

    markers.push(marker);
    infoWindows.push(iw);
  });

  // Marker distribuidora
  const distribuidora = { lat: -34.8731389, lng: -56.1590675 };
  new google.maps.Marker({
    position: distribuidora,
    map: mapa,
    title: 'Distribuidora - Tomás Gomensoro 3027',
    icon: {
      path: google.maps.SymbolPath.CIRCLE, scale: 14,
      fillColor: '#ffffff', fillOpacity: 1,
      strokeColor: '#f5a623', strokeWeight: 3,
    },
    label: { text: '🏠', fontSize: '14px' },
    zIndex: 999
  });

  bounds.extend(distribuidora);
  mapa.fitBounds(bounds);

  // Ruta por calles
  const ds = new google.maps.DirectionsService();
  const dr = new google.maps.DirectionsRenderer({
    map: mapa,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#f5a623', strokeOpacity: 0.6, strokeWeight: 4 }
  });

  ds.route({
    origin: distribuidora,
    destination: distribuidora,
    waypoints: negocios.map(n => ({ location: { lat: n.lat, lng: n.lng }, stopover: true })),
    optimizeWaypoints: false,
    travelMode: google.maps.TravelMode.DRIVING,
  }, (result, status) => {
    if (status === 'OK') {
      dr.setDirections(result);
      mapa.fitBounds(bounds);
    }
  });
}

function seleccionarNegocio(i) {
  if (markers.length > i) {
    infoWindows.forEach(w => w.close());
    infoWindows[i].open(mapa, markers[i]);
    if (mapa) { mapa.panTo(markers[i].getPosition()); mapa.setZoom(16); }
  }

  document.querySelectorAll('.negocio-card').forEach(c => c.classList.remove('activo'));
  const card = document.getElementById(`card-${i}`);
  if (card) card.classList.add('activo');

  document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('activo'));
  const chip = document.getElementById(`chip-${i}`);
  if (chip) { chip.classList.add('activo'); chip.scrollIntoView({ inline: 'center', behavior: 'smooth' }); }

  document.querySelectorAll('.chat-negocio-chip').forEach(c => c.classList.remove('activo'));
  const cc = document.getElementById(`chatChip-${i}`);
  if (cc) cc.classList.add('activo');
}
