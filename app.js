// =====================================================================
// AUDIO E GLOBAIS
// =====================================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let lastRadarTick = 0;

let map;
let posJogador = null;
let currentHeading = -Math.PI / 2;
let pinoJogador = null;
let anelAlertaLaranja = null; 
let anelAlertaVermelho = null; 
        
let inimigos = [];
let cardExpandidoId = null; 
        
let rotaTeste = [];
let linhaRota = null;
let modoDesenho = false;
        
let loopMovimento = null;
let ultimoTempo = 0;

let layerInimigos = L.layerGroup();
let layerRotas = L.layerGroup();

function getAudioCtx() {
    if (!audioCtx && AudioCtx) audioCtx = new AudioCtx();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (type === 'click') {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
            gain.gain.setValueAtTime(0.15, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'radar') {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.6);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.6);
        } else if (type === 'spark') {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
            gain.gain.setValueAtTime(0.35, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.25);
        }
    } catch(e) {}
}

// =====================================================================
// MATEMÁTICA DE INTERSECÇÃO E RAYCASTING
// =====================================================================
function segmentIntersect(p0, p1, p2, p3) {
    const s1_x = p1[0] - p0[0], s1_y = p1[1] - p0[1];
    const s2_x = p3[0] - p2[0], s2_y = p3[1] - p2[1];
    const denom = (-s2_x * s1_y + s1_x * s2_y);
    if (denom === 0) return null; 
    const s = (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) / denom;
    const t = ( s2_x * (p0[1] - p2[1]) - s2_y * (p0[0] - p2[0])) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return [p0[0] + (t * s1_x), p0[1] + (t * s1_y)];
    }
    return null;
}

function castRay(start, end, obstaculos) {
    let closestHit = null;
    let minDist = Infinity;
    
    obstaculos.forEach(obs => {
        for (let i = 0; i < obs.length; i++) {
            const p2 = obs[i];
            const p3 = obs[(i + 1) % obs.length];
            const hit = segmentIntersect(start, end, p2, p3);
            if (hit) {
                const dist = Math.hypot(hit[0] - start[0], hit[1] - start[1]);
                if (dist < minDist) {
                    minDist = dist;
                    closestHit = hit;
                }
            }
        }
    });
    return closestHit;
}

function isMarkerInsidePolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// =====================================================================
// INICIALIZAÇÃO E GPS
// =====================================================================
window.onload = () => {
    map = L.map('mapa', { zoomControl: false }).setView([-23.5505, -46.6333], 18);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    layerRotas.addTo(map);
    layerInimigos.addTo(map);

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(atualizarGPS, tratarErroGPS, { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 });
    }

    map.on('click', function(e) {
        if(modoDesenho) {
            rotaTeste.push(e.latlng);
            if(linhaRota) layerRotas.removeLayer(linhaRota);
            linhaRota = L.polyline(rotaTeste, {color: '#888', dashArray: '5,5', weight: 3}).addTo(layerRotas);
            L.circleMarker(e.latlng, {radius: 4, color: '#fff', fillColor: '#555', fillOpacity:1}).addTo(layerRotas);
            
            const tp = document.getElementById('tipo-inimigo-criacao').value;
            if (tp === 'guarda' || tp === 'cao_corrente') toggleDesenhoRota(); 
        }
    });

    document.body.addEventListener('click', getAudioCtx, {once:true});
    vincularEventosUI();
    atualizarVisibilidadePainel(); 

    ultimoTempo = performance.now();
    loopMovimento = requestAnimationFrame(motorFisico);
};

function atualizarGPS(pos) {
    let nLat = pos.coords.latitude; let nLng = pos.coords.longitude;
    if (posJogador && (posJogador.lat !== nLat || posJogador.lng !== nLng)) {
        const dLat = nLat - posJogador.lat; const dLng = nLng - posJogador.lng;
        if (Math.hypot(dLat, dLng) > 0.000001) currentHeading = Math.atan2(dLat, dLng);
    }

    posJogador = L.latLng(nLat, nLng);
    document.getElementById('txt-gps').innerText = `GPS: ±${Math.round(pos.coords.accuracy)}m`;
    
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
function tratarErroGPS() { document.getElementById('txt-gps').innerText = "GPS: SINAL PERDIDO"; }

// =====================================================================
// INTERFACE DE CRIAÇÃO E CARDS
// =====================================================================
function vincularEventosUI() {
    document.getElementById('btn-toggle-painel').addEventListener('click', togglePainelCriacao);
    document.getElementById('btn-desenhar').addEventListener('click', toggleDesenhoRota);
    document.getElementById('btn-salvar').addEventListener('click', criarInimigo);
    document.getElementById('tipo-inimigo-criacao').addEventListener('change', atualizarVisibilidadePainel);
    
    ['vel-patrulha', 'vel-perseguicao', 'raio-visao', 'tamanho-rastro', 'direcao-guarda', 'faro-caes', 'espalhamento-caes', 'ronda-caes', 'tamanho-corrente'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            let spanId = 'val-' + id.split('-')[0];
            if (id === 'tamanho-rastro') spanId = 'val-rastro';
            else if (id === 'direcao-guarda') spanId = 'val-direcao';
            else if (id === 'espalhamento-caes') spanId = 'val-espalhamento';
            else if (id === 'ronda-caes') spanId = 'val-ronda';
            else if (id === 'tamanho-corrente') spanId = 'val-corrente';
            else if (id === 'vel-perseguicao') spanId = 'val-perseg';
            document.getElementById(spanId).innerText = document.getElementById(id).value;
        });
    });
}

function atualizarVisibilidadePainel() {
    const tipoSel = document.getElementById('tipo-inimigo-criacao').value;
    document.querySelectorAll('.controle-grupo.especial, .controles.especial').forEach(el => el.style.display = 'none');
    
    const isObs = (tipoSel === 'obstaculo');
    document.getElementById('grupo-velocidades').style.display = isObs ? 'none' : 'grid';
    document.getElementById('grupo-raio').style.display = isObs ? 'none' : 'flex';
    document.getElementById('btn-salvar').innerText = isObs ? '🧱 2º - SALVAR ÁREA' : '➕ 2º - GERAR ENTIDADE';
    
    if (tipoSel === 'screamer') document.getElementById('grupo-rastro').style.display = 'flex';
    if (tipoSel === 'guarda') document.getElementById('grupo-direcao').style.display = 'flex';
    if (tipoSel === 'hound_master') document.getElementById('grupo-faro').style.display = 'flex';
    if (tipoSel === 'cao_corrente') document.getElementById('grupo-corrente').style.display = 'flex';
}

function togglePainelCriacao() {
    playSound('click');
    const conteudo = document.getElementById('painel-conteudo');
    const icone = document.getElementById('icone-toggle');
    if (conteudo.classList.contains('oculto')) {
        conteudo.classList.remove('oculto'); icone.innerText = '🔽';
    } else {
        conteudo.classList.add('oculto'); icone.innerText = '🔼';
    }
}

function toggleDesenhoRota() {
    playSound('click');
    modoDesenho = !modoDesenho;
    const btn = document.getElementById('btn-desenhar');
    if(modoDesenho) {
        rotaTeste = [];
        if(linhaRota) layerRotas.removeLayer(linhaRota);
        btn.classList.add('ativo'); btn.innerText = "Toque no mapa... (Clique para parar)";
        togglePainelCriacao();
    } else {
        btn.classList.remove('ativo'); btn.innerText = "✏️ Finalizado! Clique em Salvar/Gerar.";
        togglePainelCriacao(); 
    }
}

function criarInimigo() {
    playSound('click');
    const tipoSel = document.getElementById('tipo-inimigo-criacao').value;
    
    // LÓGICA DE CRIAÇÃO DO OBSTÁCULO
    if (tipoSel === 'obstaculo') {
        if (rotaTeste.length < 3) { alert("Marque pelo menos 3 pontos para formar uma Parede!"); return; }
        const coords = rotaTeste.map(pt => [pt.lat, pt.lng]);
        const poly = L.polygon(rotaTeste, {color: '#ff0000', fillColor: '#000000', fillOpacity: 0.35, weight: 1.5, dashArray: '4, 4'}).addTo(layerInimigos);
        
        inimigos.push({ id: Date.now(), tipo: 'obstaculo', coords: coords, layer: poly });
        
        layerRotas.clearLayers(); rotaTeste = []; linhaRota = null;
        modoDesenho = false; document.getElementById('btn-desenhar').classList.remove('ativo');
        document.getElementById('btn-desenhar').innerText = "✏️ 1º - Desenhar Rota / Área";
        
        const conteudo = document.getElementById('painel-conteudo');
        if (!conteudo.classList.contains('oculto')) togglePainelCriacao();
        renderizarListaInimigos();
        return;
    }

    if ((tipoSel === 'guarda' || tipoSel === 'cao_corrente') && rotaTeste.length < 1) { alert("Dê 1 clique no mapa para definir a base!"); return; }
    if (tipoSel !== 'guarda' && tipoSel !== 'cao_corrente' && rotaTeste.length < 2) { alert("Desenhe uma rota com 2 pontos ou mais!"); return; }

    const novoId = Date.now();
    const novoInimigo = {
        id: novoId, tipo: tipoSel, rota: [...rotaTeste],
        velPatrulha: parseFloat(document.getElementById('vel-patrulha').value),
        velPerseguicao: parseFloat(document.getElementById('vel-perseguicao').value),
        raioVisao: parseFloat(document.getElementById('raio-visao').value), 
        maxRastro: parseInt(document.getElementById('tamanho-rastro').value),
        baseHeading: parseInt(document.getElementById('direcao-guarda').value),
        raioFaro: parseInt(document.getElementById('faro-caes').value),
        espalhamento: parseInt(document.getElementById('espalhamento-caes').value),
        raioRondaCaes: parseInt(document.getElementById('ronda-caes').value),
        tamanhoCorrente: parseInt(document.getElementById('tamanho-corrente').value),
        posOrigem: L.latLng(rotaTeste[0].lat, rotaTeste[0].lng), 
        estado: "PATRULHANDO", pos: L.latLng(rotaTeste[0].lat, rotaTeste[0].lng),
        indexAlvo: (tipoSel === 'guarda' || tipoSel === 'cao_corrente') ? 0 : 1, rotaDir: 1, 
        marker: null, areaVisual: null, correnteVisual: null, linhaCorrente: null, rastro: [], polyline: null, heading: 0
    };

    let corBase = '#ff0000';
    if(tipoSel === 'screamer') corBase = '#aa00ff';
    else if(tipoSel === 'guarda') corBase = '#ffff00';
    else if(tipoSel === 'hound_master') corBase = '#ff8800';
    else if(tipoSel === 'cao_corrente') corBase = '#00ff00';
    else if(tipoSel === 'saqueador') corBase = '#888888';

    novoInimigo.marker = L.circleMarker(novoInimigo.pos, { radius: 8, fillColor: corBase, color: '#fff', weight: 2, fillOpacity: 1 }).addTo(layerInimigos);
    
    if (tipoSel === 'fiscal' || tipoSel === 'guarda' || tipoSel === 'hound_master') {
        novoInimigo.areaVisual = L.polygon([], {color: corBase, fillColor: corBase, fillOpacity: 0.2, weight: 1}).addTo(layerInimigos);
    } else if (tipoSel === 'cao_corrente') {
        novoInimigo.areaVisual = L.circle(novoInimigo.posOrigem, {radius: novoInimigo.raioVisao, color: corBase, fillOpacity: 0.1, weight: 1}).addTo(layerInimigos);
        novoInimigo.correnteVisual = L.circle(novoInimigo.posOrigem, {radius: novoInimigo.tamanhoCorrente, color: '#ffffff', fillOpacity: 0, weight: 1.5, dashArray: '4,4'}).addTo(layerInimigos);
        novoInimigo.linhaCorrente = L.polyline([novoInimigo.posOrigem, novoInimigo.pos], {color: '#888', weight: 2, dashArray: '3, 4'}).addTo(layerInimigos);
    } else if (tipoSel === 'screamer') {
        novoInimigo.polyline = L.polyline([], {color: '#aa00ff', opacity: 0.9, weight: 8, dashArray: '5, 10'}).addTo(layerInimigos);
    }

    inimigos.push(novoInimigo);

    if (tipoSel === 'hound_master') {
        let formAngles = [0, 45, 315]; let formDistRatios = [1.2, 1.0, 1.0]; 
        for(let i=0; i<3; i++) {
            let roamPhaseX = Math.random() * Math.PI * 2; let roamPhaseY = Math.random() * Math.PI * 2;
            let roamFreqX = 0.6 + (Math.random() * 0.8); let roamFreqY = 0.5 + (Math.random() * 0.8);
            let roamSpeedPhase = Math.random() * Math.PI * 2;

            let hound = {
                id: Date.now() + i + 1, tipo: 'hound', masterId: novoId,
                velPatrulha: novoInimigo.velPatrulha * 1.5, velPerseguicao: novoInimigo.velPerseguicao * 1.2,
                raioFaro: novoInimigo.raioFaro, estado: "formation",
                formAngle: formAngles[i], formDistRatio: formDistRatios[i],
                phaseX: roamPhaseX, phaseY: roamPhaseY, freqX: roamFreqX, freqY: roamFreqY, speedPhase: roamSpeedPhase,
                pos: L.latLng(novoInimigo.pos.lat, novoInimigo.pos.lng),
                marker: L.circleMarker(novoInimigo.pos, { radius: 5, fillColor: '#00bbff', color: '#fff', weight: 1, fillOpacity: 1 }).addTo(layerInimigos),
                areaVisual: L.circle(novoInimigo.pos, {radius: novoInimigo.raioFaro, color: '#00bbff', fillColor: '#00bbff', fillOpacity: 0.1, weight: 1}).addTo(layerInimigos)
            };
            inimigos.push(hound);
        }
    }
    
    layerRotas.clearLayers(); rotaTeste = []; linhaRota = null;
    modoDesenho = false; document.getElementById('btn-desenhar').classList.remove('ativo');
    document.getElementById('btn-desenhar').innerText = "✏️ 1º - Desenhar Rota / Área";
    
    const conteudo = document.getElementById('painel-conteudo');
    if (!conteudo.classList.contains('oculto')) togglePainelCriacao();
    renderizarListaInimigos();
}

function renderizarListaInimigos() {
    const painel = document.getElementById('painel-lateral');
    painel.innerHTML = ''; 

    inimigos.forEach((ini) => {
        if (ini.tipo === 'hound') return; 

        const idCurto = ini.id.toString().slice(-4);
        let icone = '🔴'; let nome = 'Fiscal'; let classeCss = 'fiscal';
        if (ini.tipo === 'screamer') { icone = '🟣'; nome = 'Atormentado'; classeCss = 'screamer'; }
        if (ini.tipo === 'guarda') { icone = '🟡'; nome = 'Guarda'; classeCss = 'guarda'; }
        if (ini.tipo === 'hound_master') { icone = '🟠'; nome = 'Matilha'; classeCss = 'hound_master'; }
        if (ini.tipo === 'cao_corrente') { icone = '🟢'; nome = 'Cão de Base'; classeCss = 'cao_corrente'; }
        if (ini.tipo === 'saqueador') { icone = '⚫'; nome = 'Saqueador'; classeCss = 'saqueador'; }
        if (ini.tipo === 'obstaculo') { icone = '🧱'; nome = 'Parede'; classeCss = 'obstaculo'; }
        
        const card = document.createElement('div');
        card.className = 'card-inimigo';
        const isExpandido = cardExpandidoId === ini.id;

        let corpoHtml = '';
        if (ini.tipo === 'obstaculo') {
            corpoHtml = `
                <div style="font-size:10px; color:#aaa; margin-bottom:10px; text-align:center;">
                    Área Física: Bloqueia visão e serve de barreira.
                </div>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button class="btn-card btn-excluir" onclick="excluirInimigo(${ini.id})">EXCLUIR PAREDE</button>
                </div>
            `;
        } else {
            corpoHtml = `
                <div class="controle-grupo">
                    <label>Patrulha: <span class="valor-slider" id="val-pat-${ini.id}">${ini.velPatrulha} m/s</span></label>
                    <input type="range" id="pat-${ini.id}" min="0.1" max="10.0" step="0.1" value="${ini.velPatrulha}" oninput="attCard(${ini.id})">
                </div>
                
                <div class="controle-grupo">
                    <label>Fuga/Perseg: <span class="valor-slider" id="val-per-${ini.id}">${ini.velPerseguicao} m/s</span></label>
                    <input type="range" id="per-${ini.id}" min="0.5" max="10.0" step="0.1" value="${ini.velPerseguicao}" oninput="attCard(${ini.id})">
                </div>
                
                <div class="controle-grupo">
                    <label>Raio Atuação: <span class="valor-slider" id="val-raio-${ini.id}">${ini.raioVisao} m</span></label>
                    <input type="range" id="raio-${ini.id}" min="5" max="150" step="1" value="${ini.raioVisao}" oninput="attCard(${ini.id})">
                </div>

                ${ini.tipo === 'screamer' ? `
                <div class="controle-grupo">
                    <label>Tam. Rastro: <span class="valor-slider" id="val-rastro-${ini.id}">${ini.maxRastro} pt</span></label>
                    <input type="range" id="rastro-${ini.id}" min="100" max="2500" step="100" value="${ini.maxRastro}" oninput="attCard(${ini.id})">
                </div>` : ''}

                ${ini.tipo === 'guarda' ? `
                <div class="controle-grupo">
                    <label>Direção: <span class="valor-slider" id="val-dir-${ini.id}">${ini.baseHeading}°</span></label>
                    <input type="range" id="dir-${ini.id}" min="0" max="360" step="15" value="${ini.baseHeading}" oninput="attCard(${ini.id})">
                </div>` : ''}
                
                ${ini.tipo === 'cao_corrente' ? `
                <div class="controle-grupo">
                    <label>Tamanho Corrente: <span class="valor-slider" id="val-cor-${ini.id}">${ini.tamanhoCorrente} m</span></label>
                    <input type="range" id="cor-${ini.id}" min="10" max="100" step="5" value="${ini.tamanhoCorrente}" oninput="attCard(${ini.id})">
                </div>` : ''}

                ${ini.tipo === 'hound_master' ? `
                <div style="display:flex; flex-wrap:wrap; gap: 5px;">
                    <div class="controle-grupo" style="flex:1; min-width:45%;">
                        <label>Faro Cães: <span class="valor-slider" id="val-faro-${ini.id}">${ini.raioFaro}m</span></label>
                        <input type="range" id="faro-${ini.id}" min="5" max="100" step="1" value="${ini.raioFaro}" oninput="attCard(${ini.id})">
                    </div>
                    <div class="controle-grupo" style="flex:1; min-width:45%;">
                        <label>Espalha: <span class="valor-slider" id="val-espa-${ini.id}">${ini.espalhamento}m</span></label>
                        <input type="range" id="espa-${ini.id}" min="5" max="40" step="1" value="${ini.espalhamento}" oninput="attCard(${ini.id})">
                    </div>
                    <div class="controle-grupo" style="flex:1; min-width:100%;">
                        <label>Área Ronda: <span class="valor-slider" id="val-ronda-${ini.id}">${ini.raioRondaCaes}m</span></label>
                        <input type="range" id="ronda-${ini.id}" min="5" max="100" step="5" value="${ini.raioRondaCaes}" oninput="attCard(${ini.id})">
                    </div>
                </div>` : ''}

                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button class="btn-card btn-aplicar" onclick="toggleCard(${ini.id})">FECHAR</button>
                    <button class="btn-card btn-excluir" onclick="excluirInimigo(${ini.id})">EXCLUIR</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="card-header ${classeCss}" onclick="toggleCard(${ini.id})">
                <span>${icone} ${nome} #${idCurto}</span>
                <span>${isExpandido ? '🔼' : '⚙️'}</span>
            </div>
            <div class="card-body ${isExpandido ? 'ativo' : ''}" id="body-${ini.id}">
                ${corpoHtml}
            </div>
        `;
        painel.appendChild(card);
    });
}

function attCard(id) {
    const ini = inimigos.find(i => i.id === id);
    if (!ini || ini.tipo === 'obstaculo') return;

    ini.velPatrulha = parseFloat(document.getElementById(`pat-${id}`).value);
    ini.velPerseguicao = parseFloat(document.getElementById(`per-${id}`).value);
    ini.raioVisao = parseFloat(document.getElementById(`raio-${id}`).value);
    
    document.getElementById(`val-pat-${id}`).innerText = `${ini.velPatrulha} m/s`;
    document.getElementById(`val-per-${id}`).innerText = `${ini.velPerseguicao} m/s`;
    document.getElementById(`val-raio-${id}`).innerText = `${ini.raioVisao} m`;

    if (ini.tipo === 'screamer') {
        ini.maxRastro = parseInt(document.getElementById(`rastro-${id}`).value);
        document.getElementById(`val-rastro-${id}`).innerText = `${ini.maxRastro} pt`;
    }
    if (ini.tipo === 'guarda') {
        ini.baseHeading = parseInt(document.getElementById(`dir-${id}`).value);
        document.getElementById(`val-dir-${id}`).innerText = `${ini.baseHeading}°`;
    }
    if (ini.tipo === 'cao_corrente') {
        ini.tamanhoCorrente = parseInt(document.getElementById(`cor-${id}`).value);
        document.getElementById(`val-cor-${id}`).innerText = `${ini.tamanhoCorrente} m`;
        if (ini.correnteVisual) ini.correnteVisual.setRadius(ini.tamanhoCorrente);
    }
    if (ini.tipo === 'hound_master') {
        ini.raioFaro = parseInt(document.getElementById(`faro-${id}`).value);
        ini.espalhamento = parseInt(document.getElementById(`espa-${id}`).value);
        ini.raioRondaCaes = parseInt(document.getElementById(`ronda-${id}`).value);
        
        document.getElementById(`val-faro-${id}`).innerText = `${ini.raioFaro} m`;
        document.getElementById(`val-espa-${id}`).innerText = `${ini.espalhamento} m`;
        document.getElementById(`val-ronda-${id}`).innerText = `${ini.raioRondaCaes} m`;
        
        inimigos.forEach(h => {
            if (h.masterId === ini.id) {
                h.raioFaro = ini.raioFaro; h.velPatrulha = ini.velPatrulha * 1.5; h.velPerseguicao = ini.velPerseguicao * 1.2;
                if(h.areaVisual) h.areaVisual.setRadius(h.raioFaro);
            }
        });
    }
}

function toggleCard(id) { playSound('click'); cardExpandidoId = (cardExpandidoId === id) ? null : id; renderizarListaInimigos(); }

function excluirInimigo(id) {
    playSound('click');
    const index = inimigos.findIndex(i => i.id === id);
    if (index > -1) {
        const ini = inimigos[index];
        if (ini.tipo === 'hound_master') {
            const caes = inimigos.filter(h => h.masterId === ini.id);
            caes.forEach(c => {
                if(c.marker) layerInimigos.removeLayer(c.marker); if(c.areaVisual) layerInimigos.removeLayer(c.areaVisual);
                inimigos = inimigos.filter(x => x.id !== c.id);
            });
        }
        if (ini.marker) layerInimigos.removeLayer(ini.marker);
        if (ini.areaVisual) layerInimigos.removeLayer(ini.areaVisual);
        if (ini.polyline) layerInimigos.removeLayer(ini.polyline);
        if (ini.correnteVisual) layerInimigos.removeLayer(ini.correnteVisual);
        if (ini.linhaCorrente) layerInimigos.removeLayer(ini.linhaCorrente);
        if (ini.layer) layerInimigos.removeLayer(ini.layer); 
        
        inimigos = inimigos.filter(x => x.id !== id);
        if (cardExpandidoId === id) cardExpandidoId = null;
        renderizarListaInimigos();
    }
}

// =====================================================================
// MATEMÁTICA E RADAR TÁTICO
// =====================================================================
function calcularDestino(latlng, headingDeg, distMeters) {
    const R = 6378137; const d = distMeters / R;
    const lat1 = latlng.lat * Math.PI / 180; const lng1 = latlng.lng * Math.PI / 180;
    const brng = headingDeg * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
}

function estaNoCone(posInimigo, posPlayer, headingDeg, raioMetros, aberturaDeg, obsArray) {
    let distancia = map.distance(posInimigo, posPlayer);
    if (distancia > raioMetros) return false;
    
    if (castRay([posInimigo.lat, posInimigo.lng], [posPlayer.lat, posPlayer.lng], obsArray)) return false;

    let dy = posPlayer.lat - posInimigo.lat; let dx = (posPlayer.lng - posInimigo.lng) * Math.cos(posInimigo.lat * Math.PI / 180);
    let anguloProJogador = Math.atan2(dx, dy) * 180 / Math.PI;
    let diff = Math.abs(headingDeg - anguloProJogador); if (diff > 180) diff = 360 - diff;
    return diff <= (aberturaDeg / 2);
}

function drawRadar() {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width; const height = canvas.height;
    const cx = width / 2; const cy = height / 2; const radius = cx - 5;

    let radarColor = '#00ff66'; let radarBg = '#021006'; let sweepSpeed = 3000; let alertLevel = 0;
    
    if (posJogador) {
        let closest = Infinity;
        inimigos.forEach(ini => {
            if(ini.tipo === 'obstaculo') return;
            let perigoFactor = (ini.tipo === 'saqueador') ? 1.5 : 1; 
            const dist = map.distance(posJogador, ini.pos) * perigoFactor;
            if (dist < closest) closest = dist;
        });
        if (closest <= 25) { alertLevel = 2; radarColor = '#ff2222'; radarBg = '#1a0505'; sweepSpeed = 1000; } 
        else if (closest <= 50) { alertLevel = 1; radarColor = '#ffaa00'; radarBg = '#140f00'; sweepSpeed = 2000; }
    }

    if (alertLevel > 0) {
        const now = performance.now(); const tickRate = alertLevel === 2 ? 400 : 1200; 
        if (now - lastRadarTick > tickRate) { playSound('click'); lastRadarTick = now; }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = radarBg; ctx.fill(); ctx.strokeStyle = radarColor; ctx.lineWidth = 2; ctx.stroke();
    for (let r = radius * 0.33; r < radius; r += radius * 0.33) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = alertLevel === 0 ? 'rgba(0, 255, 102, 0.25)' : alertLevel === 1 ? 'rgba(255, 170, 0, 0.25)' : 'rgba(255, 34, 34, 0.25)';
        ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.strokeStyle = alertLevel === 0 ? 'rgba(0, 255, 102, 0.2)' : alertLevel === 1 ? 'rgba(255, 170, 0, 0.2)' : 'rgba(255, 34, 34, 0.2)';
    ctx.stroke();

    const sweepAngle = (performance.now() / sweepSpeed * Math.PI * 2) % (Math.PI * 2);
    const tailAngle = 0.65; 
    ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius - 1, sweepAngle - tailAngle, sweepAngle, false); ctx.closePath();
    const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    if (alertLevel === 0) { sweepGradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)'); sweepGradient.addColorStop(1, 'rgba(0, 255, 102, 0.0)'); } 
    else if (alertLevel === 1) { sweepGradient.addColorStop(0, 'rgba(255, 170, 0, 0.4)'); sweepGradient.addColorStop(1, 'rgba(255, 170, 0, 0.0)'); } 
    else { sweepGradient.addColorStop(0, 'rgba(255, 34, 34, 0.4)'); sweepGradient.addColorStop(1, 'rgba(255, 34, 34, 0.0)'); }
    ctx.fillStyle = sweepGradient; ctx.fill(); ctx.restore();

    const sweepX = cx + (radius - 2) * Math.cos(sweepAngle); const sweepY = cy + (radius - 2) * Math.sin(sweepAngle);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sweepX, sweepY); ctx.strokeStyle = radarColor; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = radarColor; ctx.fill();

    if (posJogador) {
        const displayRange = 50; 
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.clip(); 

        inimigos.forEach(ini => {
            if (ini.tipo === 'screamer' && ini.rastro && ini.rastro.length > 1) {
                ctx.beginPath(); let firstPoint = true;
                for (let i = 0; i < ini.rastro.length; i++) {
                    const pt = ini.rastro[i]; const ptDist = map.distance(posJogador, pt);
                    const normDist = ptDist / displayRange; const rPx = normDist * (radius - 12); 
                    const dLat = pt[0] - posJogador.lat; const dLng = pt[1] - posJogador.lng;
                    const angleRad = Math.atan2(dLat, dLng) - currentHeading;
                    const ptX = cx + rPx * Math.cos(angleRad); const ptY = cy - rPx * Math.sin(angleRad);
                    if (firstPoint) { ctx.moveTo(ptX, ptY); firstPoint = false; } else { ctx.lineTo(ptX, ptY); }
                }
                ctx.strokeStyle = 'rgba(170, 0, 255, 0.6)'; ctx.lineWidth = 2; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]); 
            }
        });
        ctx.restore();

        inimigos.forEach(ini => {
            if(ini.tipo === 'obstaculo') return;
            const dist = map.distance(posJogador, ini.pos);
            if (dist <= displayRange) {
                const normDist = dist / displayRange; const rPx = Math.min(normDist, 1.0) * (radius - 12);
                const dLat = ini.pos.lat - posJogador.lat; const dLng = ini.pos.lng - posJogador.lng;
                const angleRad = Math.atan2(dLat, dLng) - currentHeading;
                const blipX = cx + rPx * Math.cos(angleRad); const blipY = cy - rPx * Math.sin(angleRad);
                
                let corBlip = '#ff2222';
                if(ini.tipo === 'screamer') corBlip = '#aa00ff';
                if(ini.tipo === 'guarda') corBlip = '#ffff00';
                if(ini.tipo === 'hound_master') corBlip = '#ff8800';
                if(ini.tipo === 'hound') corBlip = '#00bbff';
                if(ini.tipo === 'cao_corrente') corBlip = '#00ff00';
                if(ini.tipo === 'saqueador') corBlip = '#bbbbbb';
                
                ctx.save(); ctx.translate(blipX, blipY);
                const headingRad = (ini.heading || 0) * (Math.PI / 180) - currentHeading;
                ctx.rotate(headingRad);
                ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(3.5, 3.5); ctx.lineTo(0, 1.5); ctx.lineTo(-3.5, 3.5);
                ctx.closePath(); ctx.fillStyle = corBlip; ctx.fill(); ctx.restore();
            }
        });
    }
}

// =====================================================================
// MOTOR FÍSICO E INTELIGÊNCIA ARTIFICIAL
// =====================================================================
function motorFisico(tempoAtual) {
    let dt = (tempoAtual - ultimoTempo) / 1000; ultimoTempo = tempoAtual; if (dt > 0.1) dt = 0.1; 
    let alguemAgressivo = false;

    const obsArray = inimigos.filter(i => i.tipo === 'obstaculo').map(i => i.coords);

    inimigos.forEach(ini => {
        if (ini.tipo === 'obstaculo') return;

        if (!posJogador) return;

        let alvoMovimento = ini.estado === "PATRULHANDO" ? ini.rota[ini.indexAlvo] : posJogador;
        let velAtual = ini.estado === "PATRULHANDO" ? ini.velPatrulha : ini.velPerseguicao;
        let headingDeg = ini.heading || 0;
        let jogadorVisto = false;

        let playerLoSBloqueado = castRay([ini.pos.lat, ini.pos.lng], [posJogador.lat, posJogador.lng], obsArray) !== null;

        // 1. ATORMENTADO
        if (ini.tipo === 'screamer') {
            headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
            if (ini.estado !== 'PERSEGUICAO') {
                let deveSalvar = true;
                if (ini.rastro.length > 0) {
                    const ultimoPt = ini.rastro[ini.rastro.length - 1];
                    if (map.distance([ini.pos.lat, ini.pos.lng], ultimoPt) < 0.5) deveSalvar = false;
                }
                if (deveSalvar) {
                    ini.rastro.push([ini.pos.lat, ini.pos.lng]);
                    if (ini.rastro.length > (ini.maxRastro || 300)) ini.rastro.shift();
                    if (ini.polyline) ini.polyline.setLatLngs(ini.rastro);
                }
                for (let pt of ini.rastro) {
                    if (map.distance(posJogador, pt) < 2.5) { jogadorVisto = true; playSound('radar'); break; }
                }
            } else {
                if (map.distance(ini.pos, posJogador) > ini.raioVisao) {
                    ini.estado = 'PATRULHANDO'; ini.rastro = []; if (ini.polyline) ini.polyline.setLatLngs([]);
                } else jogadorVisto = true;
            }
        } 
        
        // 2. GUARDA FIXO
        else if (ini.tipo === 'guarda') {
            if (ini.estado === 'PATRULHANDO' || ini.estado === 'RETORNANDO') {
                alvoMovimento = ini.rota[0];
                let distHome = map.distance(ini.pos, alvoMovimento);
                if (distHome < 0.5) {
                    ini.pos = alvoMovimento; headingDeg = ini.baseHeading; velAtual = 0; ini.estado = 'PATRULHANDO';
                } else {
                    velAtual = ini.velPatrulha;
                    headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
                }
            }
            jogadorVisto = estaNoCone(ini.pos, posJogador, headingDeg, ini.raioVisao, 60, obsArray);
            if (jogadorVisto) { ini.estado = 'PERSEGUICAO'; alvoMovimento = posJogador; velAtual = ini.velPerseguicao; }
            else if (ini.estado === 'PERSEGUICAO') {
                if (map.distance(ini.pos, posJogador) > ini.raioVisao * 1.5) ini.estado = 'RETORNANDO';
            }
        }

        // 3. CÃO DE PROPRIEDADE
        else if (ini.tipo === 'cao_corrente') {
            let distDaBase = map.distance(ini.pos, ini.posOrigem);
            let distPlayerDaBase = map.distance(posJogador, ini.posOrigem);
            
            if (distPlayerDaBase <= ini.raioVisao && !playerLoSBloqueado) {
                ini.estado = 'PERSEGUICAO';
            } else if (ini.estado === 'PERSEGUICAO') {
                ini.estado = 'RETORNANDO';
            }

            if (ini.estado === 'PATRULHANDO' || ini.estado === 'RETORNANDO') {
                alvoMovimento = ini.posOrigem;
                if (distDaBase < 0.5) {
                    ini.pos = L.latLng(ini.posOrigem.lat, ini.posOrigem.lng); 
                    velAtual = 0; 
                    ini.estado = 'PATRULHANDO';
                } else {
                    velAtual = ini.velPatrulha; 
                }
            } 
            
            if (ini.estado === 'PERSEGUICAO') {
                velAtual = ini.velPerseguicao;
                jogadorVisto = true;
                
                if (distPlayerDaBase > ini.tamanhoCorrente) {
                    let angleToPlayer = Math.atan2(posJogador.lng - ini.posOrigem.lng, posJogador.lat - ini.posOrigem.lat) * 180 / Math.PI;
                    alvoMovimento = calcularDestino(ini.posOrigem, angleToPlayer, ini.tamanhoCorrente);
                } else {
                    alvoMovimento = posJogador; 
                }
            }
            headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
        }

        // 4. SAQUEADOR
        else if (ini.tipo === 'saqueador') {
            let distPlayer = map.distance(ini.pos, posJogador);
            if (distPlayer <= ini.raioVisao && !playerLoSBloqueado) ini.estado = 'FLEE';
            else if (distPlayer > ini.raioVisao * 1.5) ini.estado = 'PATRULHANDO';

            if (ini.estado === 'FLEE') {
                velAtual = ini.velPerseguicao; 
                let anguloFuga = Math.atan2(ini.pos.lng - posJogador.lng, ini.pos.lat - posJogador.lat);
                alvoMovimento = L.latLng(ini.pos.lat + Math.cos(anguloFuga) * 0.0005, ini.pos.lng + Math.sin(anguloFuga) * 0.0005);
            } else {
                alvoMovimento = ini.rota[ini.indexAlvo]; velAtual = ini.velPatrulha;
            }
            headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
        }
        
        // 5. HOUND MASTER
        else if (ini.tipo === 'hound_master') {
            if (ini.estado !== 'pause' && ini.estado !== 'wait_for_hounds') {
                headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
            }
            
            if (ini.estado === 'pause') {
                velAtual = 0; alvoMovimento = ini.pos;
                if (performance.now() - ini.pauseTimer > 8000) {
                    ini.estado = 'PATRULHANDO'; alvoMovimento = ini.rota[ini.indexAlvo]; velAtual = ini.velPatrulha;
                }
            } else if (ini.estado === 'wait_for_hounds') {
                velAtual = 0; alvoMovimento = ini.pos;
                let houndsCaçando = inimigos.some(h => h.masterId === ini.id && h.estado === 'chase');
                if (!houndsCaçando) {
                    ini.estado = 'PATRULHANDO'; alvoMovimento = ini.rota[ini.indexAlvo]; velAtual = ini.velPatrulha;
                }
            }

            jogadorVisto = estaNoCone(ini.pos, posJogador, headingDeg, ini.raioVisao, 60, obsArray);
            if (jogadorVisto && ini.estado !== 'wait_for_hounds') {
                ini.estado = 'wait_for_hounds'; playSound('radar');
                inimigos.filter(h => h.masterId === ini.id).forEach(h => h.estado = 'chase');
            }
        }

        // 6. HOUND (Cachorros)
        else if (ini.tipo === 'hound') {
            const master = inimigos.find(m => m.id === ini.masterId);
            if (!master) return;
            
            let distPlayer = map.distance(ini.pos, posJogador);
            if (distPlayer <= ini.raioFaro && !playerLoSBloqueado) {
                if (ini.estado !== 'chase') playSound('radar');
                ini.estado = 'chase'; master.estado = 'wait_for_hounds';
                inimigos.filter(h => h.masterId === master.id).forEach(h => h.estado = 'chase');
            }

            if (ini.estado === 'chase') {
                alvoMovimento = posJogador; velAtual = ini.velPerseguicao;
                if (distPlayer > 60) ini.estado = 'return';
            } else if (ini.estado === 'return') {
                const distFrente = master.espalhamento * ini.formDistRatio;
                alvoMovimento = calcularDestino(master.pos, master.heading + ini.formAngle, distFrente);
                velAtual = ini.velPatrulha * 3;
                if (map.distance(ini.pos, alvoMovimento) < 2) {
                    ini.estado = master.estado === 'pause' ? 'investigate' : 'formation';
                }
            } else {
                if (master.estado === 'pause' && ini.estado === 'formation') ini.estado = 'investigate';
                if (master.estado === 'PATRULHANDO' && ini.estado === 'investigate') ini.estado = 'formation';

                if (ini.estado === 'formation') {
                    const distFrente = master.espalhamento * ini.formDistRatio;
                    alvoMovimento = calcularDestino(master.pos, master.heading + ini.formAngle, distFrente);
                    velAtual = master.velPatrulha * 1.5;
                } else if (ini.estado === 'investigate') {
                    const t = (performance.now() - (master.pauseTimer || 0)) / 1000;
                    const spread = master.raioRondaCaes || 25; 
                    const radAngle = ini.formAngle * Math.PI / 180;
                    
                    const baseOndaX = Math.sin(t * ini.freqX + ini.phaseX) * spread;
                    const baseOndaY = Math.cos(t * ini.freqY + ini.phaseY) * spread;
                    const tremorX = Math.sin(t * 3.1 + ini.phaseY) * Math.cos(t * 5.2) * (spread * 0.4);
                    const tremorY = Math.cos(t * 2.8 + ini.phaseX) * Math.sin(t * 4.5) * (spread * 0.4);
                    
                    const offsetX = baseOndaX + tremorX;
                    const offsetY = baseOndaY + tremorY;
                    
                    alvoMovimento = L.latLng(master.pos.lat + offsetY * 0.000009, master.pos.lng + offsetX * 0.000009);
                    const ritmo = Math.abs(Math.sin(t * 2.0 + ini.speedPhase)); 
                    velAtual = master.velPatrulha * (0.2 + (ritmo * 3.0)); 
                }
            }
            headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
        }

        // 7. FISCAL PADRÃO
        else if (ini.tipo === 'fiscal') {
            headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
            jogadorVisto = estaNoCone(ini.pos, posJogador, headingDeg, ini.raioVisao, 60, obsArray); 
            if (jogadorVisto) {
                if(ini.estado !== "PERSEGUICAO") playSound('radar');
                ini.estado = "PERSEGUICAO"; alguemAgressivo = true; alvoMovimento = posJogador; velAtual = ini.velPerseguicao;
            } else ini.estado = "PATRULHANDO";
        }

        // --- MOVIMENTAÇÃO COM CONTORNO ANGULAR (A I.A. DAS FORMIGAS) ---
        let distProAlvo = map.distance(ini.pos, alvoMovimento);
        let passo = velAtual * dt;

        if (velAtual > 0) {
            if (distProAlvo <= passo) {
                ini.pos = alvoMovimento;
                if (ini.estado === "PATRULHANDO") {
                    if (ini.tipo === 'hound_master') {
                        ini.estado = 'pause'; ini.pauseTimer = performance.now();
                    }
                    ini.indexAlvo += ini.rotaDir;
                    if (ini.indexAlvo >= ini.rota.length) {
                        ini.rotaDir = -1; ini.indexAlvo = ini.rota.length - 2;
                        if (ini.indexAlvo < 0) ini.indexAlvo = 0;
                    } else if (ini.indexAlvo < 0) {
                        ini.rotaDir = 1; ini.indexAlvo = 1;
                        if (ini.indexAlvo >= ini.rota.length) ini.indexAlvo = 0;
                    }
                }
            } else {
                let angleBase = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat);
                let resolveu = false;
                
                // CORREÇÃO AQUI: Ampliamos o ângulo de busca para até 170 graus! 
                // Assim ele contorna muros retos, quinas e até sai de becos sem saída.
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

        // --- ATUALIZAR GRÁFICOS LEAFLET E CLIPPING DE LUZ ---
        ini.marker.setLatLng(ini.pos);
        
        let corEstado = '#ff0000';
        if (ini.estado !== 'PERSEGUICAO' && ini.estado !== 'chase' && ini.estado !== 'wait_for_hounds') {
            if (ini.tipo === 'screamer') corEstado = '#aa00ff';
            else if (ini.tipo === 'guarda') corEstado = '#ffff00';
            else if (ini.tipo === 'hound_master') corEstado = '#ff8800';
            else if (ini.tipo === 'fiscal') corEstado = '#ffaa00';
            else if (ini.tipo === 'cao_corrente') corEstado = (ini.estado === 'RETORNANDO') ? '#ffaa00' : '#00ff66';
            else if (ini.tipo === 'saqueador') corEstado = '#888888';
        }
        
        if (ini.tipo === 'fiscal' || ini.tipo === 'guarda' || ini.tipo === 'hound_master') {
            ini.marker.setStyle({fillColor: corEstado});
            if (ini.estado === 'wait_for_hounds') corEstado = '#ff0000';
            
            const raioGraus = ini.raioVisao * 0.000009; 
            const rayCount = 20; 
            const startAng = (ini.heading - 30) * (Math.PI / 180);
            const endAng = (ini.heading + 30) * (Math.PI / 180);
            const step = (endAng - startAng) / rayCount;
            
            const conePoints = [[ini.pos.lat, ini.pos.lng]]; 
            for(let i=0; i<=rayCount; i++){
                const ang = startAng + (i * step);
                const endPt = [ini.pos.lat + Math.cos(ang) * raioGraus, ini.pos.lng + Math.sin(ang) * raioGraus];
                const hit = castRay([ini.pos.lat, ini.pos.lng], endPt, obsArray);
                conePoints.push(hit || endPt); 
            }
            
            ini.areaVisual.setLatLngs([conePoints]);
            ini.areaVisual.setStyle({color: corEstado, fillColor: corEstado});
            
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
        
        if (ini.estado === 'PERSEGUICAO') alguemAgressivo = true;
    });

    document.getElementById('alerta').style.display = alguemAgressivo ? 'block' : 'none';
    drawRadar();
    loopMovimento = requestAnimationFrame(motorFisico);
}