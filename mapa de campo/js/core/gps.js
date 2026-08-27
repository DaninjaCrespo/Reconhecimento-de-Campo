// =====================================================================
// GEOLOCALIZAÇÃO E MARCADORES DO JOGADOR
// =====================================================================
function atualizarGPS(pos) {
    let nLat = pos.coords.latitude; let nLng = pos.coords.longitude;
    if (posJogador && (posJogador.lat !== nLat || posJogador.lng !== nLng)) {
        const dLat = nLat - posJogador.lat; const dLng = nLng - posJogador.lng;
        if (Math.hypot(dLat, dLng) > 0.000001) currentHeading = Math.atan2(dLat, dLng);
    }

    posJogador = L.latLng(nLat, nLng);
    const txtGPS = document.getElementById('txt-gps');
    if(txtGPS) {
        txtGPS.innerText = `GPS: ±${Math.round(pos.coords.accuracy)}m`;
        txtGPS.style.color = "#00ff66";
    }
    
    if (!pinoJogador) {
        pinoJogador = L.circleMarker(posJogador, { radius: 7, fillColor: '#00bbff', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
        anelAlertaLaranja = L.circle(posJogador, { radius: 50, color: '#ffaa00', weight: 1.5, fillOpacity: 0.03, dashArray: '5, 8' }).addTo(map);
        anelAlertaVermelho = L.circle(posJogador, { radius: 25, color: '#ff0000', weight: 1.5, fillOpacity: 0.05, dashArray: '5, 8' }).addTo(map);
        map.setView(posJogador, 18);
    } else {
        pinoJogador.setLatLng(posJogador);
        anelAlertaLaranja.setLatLng(posJogador);
        anelAlertaVermelho.setLatLng(posJogador);
    }
}

function tratarErroGPS() { 
    const txtGPS = document.getElementById('txt-gps');
    if(txtGPS) txtGPS.innerText = "GPS: SINAL PERDIDO"; 
}