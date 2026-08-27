// =====================================================================
// ENGINE: INICIALIZAÇÃO DO LEAFLET E LOOP FÍSICO PRINCIPAL
// =====================================================================
window.onload = () => {
    map = L.map('mapa', { zoomControl: false, doubleClickZoom: false }).setView([-23.5505, -46.6333], 18);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    layerRotas.addTo(map); layerInimigos.addTo(map);

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(atualizarGPS, tratarErroGPS, { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 });
    }

    map.on('click', function(e) {
        if(modoDesenho) {
            rotaTeste.push(e.latlng);
            if(linhaRota) layerRotas.removeLayer(linhaRota);
            linhaRota = L.polyline(rotaTeste, {color: '#888', dashArray: '5,5', weight: 3}).addTo(layerRotas);
            L.circleMarker(e.latlng, {radius: 4, color: '#fff', fillColor: '#555', fillOpacity:1}).addTo(layerRotas);
            
            const drop = document.getElementById('tipo-inimigo-criacao');
            if (drop) {
                const tp = drop.value;
                if (tp === 'guarda' || tp === 'cao_corrente') toggleDesenhoRota(); 
            }
        }
    });

    // ATALHO: DUPLO CLIQUE PARA SIMULAR O GPS 
    map.on('dblclick', function(e) {
        if (!posJogador) {
            posJogador = e.latlng;
            pinoJogador = L.circleMarker(posJogador, { radius: 7, fillColor: '#00bbff', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
            anelAlertaLaranja = L.circle(posJogador, { radius: 50, color: '#ffaa00', weight: 1.5, fillOpacity: 0.03, dashArray: '5, 8' }).addTo(map);
            anelAlertaVermelho = L.circle(posJogador, { radius: 25, color: '#ff0000', weight: 1.5, fillOpacity: 0.05, dashArray: '5, 8' }).addTo(map);
        } else {
            const dLat = e.latlng.lat - posJogador.lat; 
            const dLng = e.latlng.lng - posJogador.lng;
            if (Math.hypot(dLat, dLng) > 0.000001) currentHeading = Math.atan2(dLat, dLng);
            
            posJogador = e.latlng;
            pinoJogador.setLatLng(posJogador);
            anelAlertaLaranja.setLatLng(posJogador);
            anelAlertaVermelho.setLatLng(posJogador);
        }
        const txtGPS = document.getElementById('txt-gps');
        if (txtGPS) {
            txtGPS.innerText = "GPS: SIMULADO (Duplo Clique)";
            txtGPS.style.color = "#ffaa00";
        }
    });

    document.body.addEventListener('click', getAudioCtx, {once:true});
    vincularEventosUI(); 
    atualizarVisibilidadePainel(); 
    ultimoTempo = performance.now(); 
    loopMovimento = requestAnimationFrame(motorFisico);
};

function motorFisico(tempoAtual) {
    let dt = (tempoAtual - ultimoTempo) / 1000; ultimoTempo = tempoAtual; if (dt > 0.1) dt = 0.1; 
    let alguemAgressivoGlobal = false;

    const obsArray = inimigos.filter(i => i.tipo === 'obstaculo').map(i => i.coords);

    inimigos.forEach(ini => {
        if (ini.tipo === 'obstaculo') return;
        if (!posJogador) return;

        // ---------------------------------------------------------------------
        // DELEGAÇÃO DE I.A. 
        // ---------------------------------------------------------------------
        const moduloIA = window.IAs && window.IAs[ini.tipo];
        if (!moduloIA) return; 

        const decisao = moduloIA(ini, posJogador, obsArray, dt);
        if (!decisao) return; 

        let { alvoMovimento, velAtual, headingDeg, alguemAgressivo } = decisao;
        
        if (alguemAgressivo) alguemAgressivoGlobal = true;

        // ---------------------------------------------------------------------
        // FÍSICA DE MOVIMENTO E COLISÃO (CONTORNO DE PAREDES - 170 GRAUS)
        // ---------------------------------------------------------------------
        let distProAlvo = map.distance(ini.pos, alvoMovimento);
        let passo = velAtual * dt;

        if (velAtual > 0) {
            if (distProAlvo <= passo) {
                ini.pos = alvoMovimento;
                if (ini.estado === "PATRULHANDO") {
                    if (ini.tipo === 'hound_master') { ini.estado = 'pause'; ini.pauseTimer = performance.now(); }
                    
                    if (ini.tipo !== 'guarda' && ini.tipo !== 'cao_corrente') {
                        ini.indexAlvo += ini.rotaDir;
                        if (ini.indexAlvo >= ini.rota.length) {
                            ini.rotaDir = -1; ini.indexAlvo = ini.rota.length - 2;
                            if (ini.indexAlvo < 0) ini.indexAlvo = 0;
                        } else if (ini.indexAlvo < 0) {
                            ini.rotaDir = 1; ini.indexAlvo = 1;
                            if (ini.indexAlvo >= ini.rota.length) ini.indexAlvo = 0;
                        }
                    }
                }
            } else {
                let angleBase = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat);
                let resolveu = false;
                
                for (let desvio = 0; desvio <= 170; desvio += 10) {
                    for (let sinal of [1, -1]) {
                        if (desvio === 0 && sinal === -1) continue; 
                        
                        let angleTest = angleBase + (desvio * sinal * Math.PI / 180);
                        let nLat = ini.pos.lat + Math.cos(angleTest) * (passo * 0.000009);
                        let nLng = ini.pos.lng + Math.sin(angleTest) * (passo * 0.000009);
                        
                        let bateu = false;
                        for (let obs of obsArray) {
                            if (isMarkerInsidePolygon([nLat, nLng], obs)) { bateu = true; break; }
                        }
                        
                        if (!bateu) {
                            ini.pos = L.latLng(nLat, nLng);
                            ini.heading = angleTest * 180 / Math.PI; 
                            resolveu = true;
                            break;
                        }
                    }
                    if (resolveu) break;
                }
            }
        }

        // ---------------------------------------------------------------------
        // ATUALIZAÇÃO DOS GRÁFICOS DO LEAFLET E CLIPPING DE LUZ (RAYCASTING)
        // ---------------------------------------------------------------------
        ini.marker.setLatLng(ini.pos);
        
        let corEstado = '#ff0000';
        if (ini.estado !== 'PERSEGUICAO' && ini.estado !== 'chase' && ini.estado !== 'wait_for_hounds' && ini.estado !== 'SCREAMING') {
            if (ini.tipo === 'screamer') corEstado = '#aa00ff';
            else if (ini.tipo === 'guarda') corEstado = '#ffff00';
            else if (ini.tipo === 'hound_master') corEstado = '#ff8800';
            else if (ini.tipo === 'fiscal') corEstado = '#ffaa00';
            else if (ini.tipo === 'cao_corrente') corEstado = (ini.estado === 'RETORNANDO') ? '#ffaa00' : '#00ff66';
            else if (ini.tipo === 'saqueador') corEstado = '#888888';
        }
        
        if (ini.tipo === 'fiscal' || ini.tipo === 'guarda' || ini.tipo === 'hound_master' || ini.tipo === 'screamer') {
            ini.marker.setStyle({fillColor: corEstado});
            if (ini.estado === 'wait_for_hounds') corEstado = '#ff0000';
            
            // SE O SCREAMER ESTIVER GRITANDO, A COR É AZUL/CIANO!
            if (ini.tipo === 'screamer' && ini.estado === 'SCREAMING') corEstado = '#00bbff';

            const raioGraus = ini.raioVisao * 0.000009; 
            
            const rayCount = (ini.tipo === 'screamer' && ini.estado === 'SCREAMING') ? 32 : 20; 
            const startAng = (ini.tipo === 'screamer' && ini.estado === 'SCREAMING') ? 0 : (ini.heading - 30) * (Math.PI / 180);
            const endAng = (ini.tipo === 'screamer' && ini.estado === 'SCREAMING') ? (Math.PI * 2) : (ini.heading + 30) * (Math.PI / 180);
            const step = (endAng - startAng) / rayCount;
            
            const conePoints = (ini.tipo === 'screamer' && ini.estado === 'SCREAMING') ? [] : [[ini.pos.lat, ini.pos.lng]]; 
            
            for(let i=0; i<=rayCount; i++){
                if (ini.tipo === 'screamer' && ini.estado === 'SCREAMING' && i === rayCount) continue;

                const ang = startAng + (i * step);
                const endPt = [ini.pos.lat + Math.cos(ang) * raioGraus, ini.pos.lng + Math.sin(ang) * raioGraus];
                const hit = castRay([ini.pos.lat, ini.pos.lng], endPt, obsArray);
                conePoints.push(hit || endPt); 
            }
            
            if (ini.areaVisual) {
                ini.areaVisual.setLatLngs([conePoints]);
                ini.areaVisual.setStyle({color: corEstado, fillColor: corEstado});
                
                // ESCONDER A ÁREA se for um Atormentado patrulhando
                if (ini.tipo === 'screamer' && ini.estado !== 'SCREAMING') {
                    ini.areaVisual.setLatLngs([]);
                }
            }
            
        } 
        else if (ini.tipo === 'cao_corrente') {
            ini.marker.setStyle({fillColor: corEstado});
            ini.areaVisual.setLatLng(ini.posOrigem); 
            ini.areaVisual.setRadius(ini.raioVisao);
            ini.areaVisual.setStyle({color: corEstado, fillColor: corEstado});
            
            if (ini.linhaCorrente) {
                if (ini.estado === 'PATRULHANDO' && map.distance(ini.posOrigem, ini.pos) < 0.5) {
                    ini.linhaCorrente.setLatLngs([]); 
                } else {
                    ini.linhaCorrente.setLatLngs([ini.posOrigem, ini.pos]); 
                }
            }
        }
        else if (ini.tipo === 'hound') {
            ini.marker.setStyle({fillColor: (ini.estado === 'chase' ? '#ff0000' : '#00bbff')});
            ini.areaVisual.setLatLng(ini.pos);
        } else {
            ini.marker.setStyle({fillColor: corEstado});
        }
    });

    const elAlerta = document.getElementById('alerta');
    if(elAlerta) elAlerta.style.display = alguemAgressivoGlobal ? 'block' : 'none';

    drawRadar();
    loopMovimento = requestAnimationFrame(motorFisico);
}