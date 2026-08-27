// =====================================================================
// INTERFACE DE USUÁRIO (UI) E CRIAÇÃO DE CARDS
// =====================================================================
function vincularEventosUI() {
    const btnTog = document.getElementById('btn-toggle-painel'); if (btnTog) btnTog.addEventListener('click', togglePainelCriacao);
    const btnDes = document.getElementById('btn-desenhar'); if (btnDes) btnDes.addEventListener('click', toggleDesenhoRota);
    const btnSal = document.getElementById('btn-salvar'); if (btnSal) btnSal.addEventListener('click', criarInimigo);
    const drpIn = document.getElementById('tipo-inimigo-criacao'); if (drpIn) drpIn.addEventListener('change', atualizarVisibilidadePainel);
    
    // Eventos de Exportar/Importar
    const btnExp = document.getElementById('btn-exportar'); if (btnExp) btnExp.addEventListener('click', exportarMapa);
    const btnImp = document.getElementById('btn-importar'); 
    const inputImp = document.getElementById('input-importar');
    if (btnImp && inputImp) {
        btnImp.addEventListener('click', () => inputImp.click());
        inputImp.addEventListener('change', importarMapa);
    }

    ['vel-patrulha', 'vel-perseguicao', 'raio-visao', 'tamanho-rastro', 'direcao-guarda', 'faro-caes', 'espalhamento-caes', 'ronda-caes', 'tamanho-corrente'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                let spanId = 'val-' + id.split('-')[0];
                if (id === 'tamanho-rastro') spanId = 'val-rastro';
                else if (id === 'direcao-guarda') spanId = 'val-direcao';
                else if (id === 'espalhamento-caes') spanId = 'val-espalhamento';
                else if (id === 'ronda-caes') spanId = 'val-ronda';
                else if (id === 'tamanho-corrente') spanId = 'val-corrente';
                else if (id === 'vel-perseguicao') spanId = 'val-perseg';
                
                const spanEl = document.getElementById(spanId);
                if (spanEl) spanEl.innerText = el.value;
            });
        }
    });
}

function atualizarVisibilidadePainel() {
    const drop = document.getElementById('tipo-inimigo-criacao');
    if (!drop) return;
    const tipoSel = drop.value;
    
    document.querySelectorAll('.controle-grupo.especial, .controles.especial').forEach(el => el.style.display = 'none');
    
    const isObs = (tipoSel === 'obstaculo');
    const gVel = document.getElementById('grupo-velocidades'); if(gVel) gVel.style.display = isObs ? 'none' : 'grid';
    const gRai = document.getElementById('grupo-raio'); if(gRai) gRai.style.display = isObs ? 'none' : 'flex';
    const bSal = document.getElementById('btn-salvar'); if(bSal) bSal.innerText = isObs ? '🧱 2º - SALVAR ÁREA' : '➕ 2º - GERAR ENTIDADE';
    
    if (tipoSel === 'screamer' && document.getElementById('grupo-rastro')) document.getElementById('grupo-rastro').style.display = 'flex';
    if (tipoSel === 'guarda' && document.getElementById('grupo-direcao')) document.getElementById('grupo-direcao').style.display = 'flex';
    if (tipoSel === 'hound_master' && document.getElementById('grupo-faro')) document.getElementById('grupo-faro').style.display = 'flex';
    if (tipoSel === 'cao_corrente' && document.getElementById('grupo-corrente')) document.getElementById('grupo-corrente').style.display = 'flex';
}

function togglePainelCriacao() {
    playSound('click');
    const conteudo = document.getElementById('painel-conteudo');
    const icone = document.getElementById('icone-toggle');
    if (conteudo && icone) {
        if (conteudo.classList.contains('oculto')) { conteudo.classList.remove('oculto'); icone.innerText = '🔽'; } 
        else { conteudo.classList.add('oculto'); icone.innerText = '🔼'; }
    }
}

function toggleDesenhoRota() {
    playSound('click');
    modoDesenho = !modoDesenho;
    const btn = document.getElementById('btn-desenhar');
    if(modoDesenho) {
        rotaTeste = []; if(linhaRota) layerRotas.removeLayer(linhaRota);
        if(btn) { btn.classList.add('ativo'); btn.innerText = "Toque no mapa... (Clique para parar)"; }
        togglePainelCriacao();
    } else {
        if(btn) { btn.classList.remove('ativo'); btn.innerText = "✏️ Finalizado! Clique em Salvar/Gerar."; }
        togglePainelCriacao(); 
    }
}

// =====================================================================
// EXPORTAÇÃO E IMPORTAÇÃO (DNA DO MAPA)
// =====================================================================
function exportarMapa() {
    const dnaInimigos = inimigos.map(ini => {
        if (ini.tipo === 'hound') return null; 
        
        return {
            id: ini.id,
            tipo: ini.tipo,
            rota: ini.tipo === 'obstaculo' ? ini.coords : ini.rota,
            velPatrulha: ini.velPatrulha,
            velPerseguicao: ini.velPerseguicao,
            raioVisao: ini.raioVisao,
            maxRastro: ini.maxRastro,
            baseHeading: ini.baseHeading,
            raioFaro: ini.raioFaro,
            espalhamento: ini.espalhamento,
            raioRondaCaes: ini.raioRondaCaes,
            tamanhoCorrente: ini.tamanhoCorrente
        };
    }).filter(item => item !== null);

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dnaInimigos));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mapa_paranapiacaba.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    playSound('click');
}

function importarMapa(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dnaInimigos = JSON.parse(e.target.result);
            
            inimigos.forEach(ini => {
                if (ini.marker) layerInimigos.removeLayer(ini.marker);
                if (ini.areaVisual) layerInimigos.removeLayer(ini.areaVisual);
                if (ini.polyline) layerInimigos.removeLayer(ini.polyline);
                if (ini.correnteVisual) layerInimigos.removeLayer(ini.correnteVisual);
                if (ini.linhaCorrente) layerInimigos.removeLayer(ini.linhaCorrente);
                if (ini.layer) layerInimigos.removeLayer(ini.layer); 
            });
            inimigos = [];
            if (layerRotas) layerRotas.clearLayers();
            rotaTeste = [];
            linhaRota = null;
            modoDesenho = false;

            dnaInimigos.forEach(dna => {
                let corBase = '#ff0000';
                if(dna.tipo === 'screamer') corBase = '#aa00ff';
                else if(dna.tipo === 'guarda') corBase = '#ffff00';
                else if(dna.tipo === 'hound_master') corBase = '#ff8800';
                else if(dna.tipo === 'cao_corrente') corBase = '#00ff00';
                else if(dna.tipo === 'saqueador') corBase = '#888888';

                if (dna.tipo === 'obstaculo') {
                    const poly = L.polygon(dna.rota, {color: '#ff0000', fillColor: '#000000', fillOpacity: 0.35, weight: 1.5, dashArray: '4, 4'}).addTo(layerInimigos);
                    inimigos.push({ id: dna.id, tipo: 'obstaculo', coords: dna.rota, layer: poly });
                    return;
                }

                const posOrigem = L.latLng(dna.rota[0].lat, dna.rota[0].lng);
                
                const novoInimigo = {
                    id: dna.id, tipo: dna.tipo, rota: dna.rota,
                    velPatrulha: dna.velPatrulha || 0.5, 
                    velPerseguicao: dna.velPerseguicao || 1.3, 
                    raioVisao: dna.raioVisao || 25, 
                    maxRastro: dna.maxRastro || 300,
                    baseHeading: dna.baseHeading || 0,
                    raioFaro: dna.raioFaro || 15,
                    espalhamento: dna.espalhamento || 15,
                    raioRondaCaes: dna.raioRondaCaes || 25,
                    tamanhoCorrente: dna.tamanhoCorrente || 40,
                    posOrigem: posOrigem, 
                    estado: "PATRULHANDO", pos: posOrigem,
                    indexAlvo: (dna.tipo === 'guarda' || dna.tipo === 'cao_corrente') ? 0 : 1, 
                    rotaDir: 1, 
                    marker: L.circleMarker(posOrigem, { radius: 8, fillColor: corBase, color: '#fff', weight: 2, fillOpacity: 1 }).addTo(layerInimigos), 
                    areaVisual: null, correnteVisual: null, linhaCorrente: null, rastro: [], polyline: null, heading: 0
                };

                if (dna.tipo === 'fiscal' || dna.tipo === 'guarda' || dna.tipo === 'hound_master' || dna.tipo === 'screamer') {
                    novoInimigo.areaVisual = L.polygon([], {color: corBase, fillColor: corBase, fillOpacity: 0.2, weight: 1}).addTo(layerInimigos);
                } else if (dna.tipo === 'cao_corrente') {
                    novoInimigo.areaVisual = L.circle(novoInimigo.posOrigem, {radius: novoInimigo.raioVisao, color: corBase, fillOpacity: 0.1, weight: 1}).addTo(layerInimigos);
                    novoInimigo.correnteVisual = L.circle(novoInimigo.posOrigem, {radius: novoInimigo.tamanhoCorrente, color: '#ffffff', fillOpacity: 0, weight: 1.5, dashArray: '4,4'}).addTo(layerInimigos);
                    novoInimigo.linhaCorrente = L.polyline([novoInimigo.posOrigem, novoInimigo.pos], {color: '#888', weight: 2, dashArray: '3, 4'}).addTo(layerInimigos);
                } 
                
                if (dna.tipo === 'screamer') {
                    novoInimigo.polyline = L.polyline([], {color: '#aa00ff', opacity: 0.9, weight: 8, dashArray: '5, 10'}).addTo(layerInimigos);
                }

                inimigos.push(novoInimigo);

                if (dna.tipo === 'hound_master') {
                    let formAngles = [0, 45, 315]; let formDistRatios = [1.2, 1.0, 1.0]; 
                    for(let i=0; i<3; i++) {
                        let hound = {
                            id: Date.now() + i + 1, tipo: 'hound', masterId: dna.id,
                            velPatrulha: novoInimigo.velPatrulha * 1.5, velPerseguicao: novoInimigo.velPerseguicao * 1.2,
                            raioFaro: novoInimigo.raioFaro, estado: "formation",
                            formAngle: formAngles[i], formDistRatio: formDistRatios[i],
                            phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2, freqX: 0.6 + (Math.random() * 0.8), freqY: 0.5 + (Math.random() * 0.8), speedPhase: Math.random() * Math.PI * 2,
                            pos: L.latLng(novoInimigo.pos.lat, novoInimigo.pos.lng),
                            marker: L.circleMarker(novoInimigo.pos, { radius: 5, fillColor: '#00bbff', color: '#fff', weight: 1, fillOpacity: 1 }).addTo(layerInimigos),
                            areaVisual: L.circle(novoInimigo.pos, {radius: novoInimigo.raioFaro, color: '#00bbff', fillColor: '#00bbff', fillOpacity: 0.1, weight: 1}).addTo(layerInimigos)
                        };
                        inimigos.push(hound);
                    }
                }
            });

            renderizarListaInimigos();
            playSound('radar');
            document.getElementById('btn-desenhar').classList.remove('ativo');
            document.getElementById('btn-desenhar').innerText = "✏️ 1º - Desenhar Rota / Área";

        } catch(err) {
            alert("Erro ao ler o arquivo do mapa.");
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// =====================================================================
// CRIAÇÃO MANUAL DE ENTIDADES
// =====================================================================
function criarInimigo() {
    playSound('click');
    const drop = document.getElementById('tipo-inimigo-criacao');
    if(!drop) return;
    const tipoSel = drop.value;
    
    if (tipoSel === 'obstaculo') {
        if (rotaTeste.length < 3) { alert("Marque pelo menos 3 pontos para formar uma Parede!"); return; }
        const coords = rotaTeste.map(pt => [pt.lat, pt.lng]);
        const poly = L.polygon(rotaTeste, {color: '#ff0000', fillColor: '#000000', fillOpacity: 0.35, weight: 1.5, dashArray: '4, 4'}).addTo(layerInimigos);
        inimigos.push({ id: Date.now(), tipo: 'obstaculo', coords: coords, layer: poly });
        
        layerRotas.clearLayers(); rotaTeste = []; linhaRota = null; modoDesenho = false; 
        const btn = document.getElementById('btn-desenhar'); if (btn) { btn.classList.remove('ativo'); btn.innerText = "✏️ 1º - Desenhar Rota / Área"; }
        const conteudo = document.getElementById('painel-conteudo'); if (conteudo && !conteudo.classList.contains('oculto')) togglePainelCriacao();
        renderizarListaInimigos(); return;
    }

    if ((tipoSel === 'guarda' || tipoSel === 'cao_corrente') && rotaTeste.length < 1) { alert("Dê 1 clique no mapa para definir a base!"); return; }
    if (tipoSel !== 'guarda' && tipoSel !== 'cao_corrente' && rotaTeste.length < 2) { alert("Desenhe uma rota com 2 pontos ou mais!"); return; }

    const vPat = document.getElementById('vel-patrulha') ? parseFloat(document.getElementById('vel-patrulha').value) : 0.5;
    const vPer = document.getElementById('vel-perseguicao') ? parseFloat(document.getElementById('vel-perseguicao').value) : 1.3;
    const rVis = document.getElementById('raio-visao') ? parseFloat(document.getElementById('raio-visao').value) : 25;

    const novoId = Date.now();
    const novoInimigo = {
        id: novoId, tipo: tipoSel, rota: [...rotaTeste],
        velPatrulha: vPat, velPerseguicao: vPer, raioVisao: rVis, 
        maxRastro: document.getElementById('tamanho-rastro') ? parseInt(document.getElementById('tamanho-rastro').value) : 300,
        baseHeading: document.getElementById('direcao-guarda') ? parseInt(document.getElementById('direcao-guarda').value) : 0,
        raioFaro: document.getElementById('faro-caes') ? parseInt(document.getElementById('faro-caes').value) : 15,
        espalhamento: document.getElementById('espalhamento-caes') ? parseInt(document.getElementById('espalhamento-caes').value) : 15,
        raioRondaCaes: document.getElementById('ronda-caes') ? parseInt(document.getElementById('ronda-caes').value) : 25,
        tamanhoCorrente: document.getElementById('tamanho-corrente') ? parseInt(document.getElementById('tamanho-corrente').value) : 40,
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
    
    if (tipoSel === 'fiscal' || tipoSel === 'guarda' || tipoSel === 'hound_master' || tipoSel === 'screamer') {
        novoInimigo.areaVisual = L.polygon([], {color: corBase, fillColor: corBase, fillOpacity: 0.2, weight: 1}).addTo(layerInimigos);
    } else if (tipoSel === 'cao_corrente') {
        novoInimigo.areaVisual = L.circle(novoInimigo.posOrigem, {radius: novoInimigo.raioVisao, color: corBase, fillOpacity: 0.1, weight: 1}).addTo(layerInimigos);
        novoInimigo.correnteVisual = L.circle(novoInimigo.posOrigem, {radius: novoInimigo.tamanhoCorrente, color: '#ffffff', fillOpacity: 0, weight: 1.5, dashArray: '4,4'}).addTo(layerInimigos);
        novoInimigo.linhaCorrente = L.polyline([novoInimigo.posOrigem, novoInimigo.pos], {color: '#888', weight: 2, dashArray: '3, 4'}).addTo(layerInimigos);
    } 
    
    if (tipoSel === 'screamer') {
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
    
    layerRotas.clearLayers(); rotaTeste = []; linhaRota = null; modoDesenho = false; 
    const btnDes = document.getElementById('btn-desenhar'); if (btnDes) { btnDes.classList.remove('ativo'); btnDes.innerText = "✏️ 1º - Desenhar Rota / Área"; }
    const conteudo = document.getElementById('painel-conteudo'); if (conteudo && !conteudo.classList.contains('oculto')) togglePainelCriacao();
    renderizarListaInimigos();
}

function renderizarListaInimigos() {
    const painel = document.getElementById('painel-lateral');
    if(!painel) return;
    painel.innerHTML = ''; 

    inimigos.forEach((ini) => {
        if (ini.tipo === 'hound') return; 

        const idCurto = ini.id.toString().slice(-4);
        let icone = '🔴'; let nome = 'Fiscal'; let classeCss = 'fiscal';
        if (ini.tipo === 'screamer') { icone = '🟣'; nome = 'Atormentado'; classeCss = 'screamer'; }
        if (ini.tipo === 'guarda') { icone = '🟡'; nome = 'Guarda'; classeCss = 'guarda'; }
        if (ini.tipo === 'hound_master') { icone = '🟠'; nome = 'Matilha'; classeCss = 'hound_master'; }
        if (ini.tipo === 'cao_corrente') { icone = '🟢'; nome = 'Cão Base'; classeCss = 'cao_corrente'; }
        if (ini.tipo === 'saqueador') { icone = '⚫'; nome = 'Saqueador'; classeCss = 'saqueador'; }
        if (ini.tipo === 'obstaculo') { icone = '🧱'; nome = 'Parede'; classeCss = 'obstaculo'; }
        
        const card = document.createElement('div');
        card.className = 'card-inimigo';
        const isExpandido = cardExpandidoId === ini.id;

        let corpoHtml = '';
        if (ini.tipo === 'obstaculo') {
            corpoHtml = `<div style="font-size:10px; color:#aaa; margin-bottom:10px; text-align:center;">Área Física: Barreira de colisão.</div><div style="display:flex; gap:5px; margin-top:10px;"><button class="btn-card btn-excluir" onclick="excluirInimigo(${ini.id})">EXCLUIR PAREDE</button></div>`;
        } else {
            // O slider de rastro agora diminui de 10 em 10 para um ajuste fino
            corpoHtml = `
                <div class="controle-grupo"><label>Patrulha: <span class="valor-slider" id="val-pat-${ini.id}">${ini.velPatrulha} m/s</span></label><input type="range" id="pat-${ini.id}" min="0.1" max="10.0" step="0.1" value="${ini.velPatrulha}" oninput="attCard(${ini.id})"></div>
                <div class="controle-grupo"><label>Fuga/Perseg: <span class="valor-slider" id="val-per-${ini.id}">${ini.velPerseguicao} m/s</span></label><input type="range" id="per-${ini.id}" min="0.5" max="10.0" step="0.1" value="${ini.velPerseguicao}" oninput="attCard(${ini.id})"></div>
                <div class="controle-grupo"><label>Aura/Visão: <span class="valor-slider" id="val-raio-${ini.id}">${ini.raioVisao} m</span></label><input type="range" id="raio-${ini.id}" min="5" max="150" step="1" value="${ini.raioVisao}" oninput="attCard(${ini.id})"></div>
                ${ini.tipo === 'screamer' ? `<div class="controle-grupo"><label>Tam. Rastro: <span class="valor-slider" id="val-rastro-${ini.id}">${ini.maxRastro} pt</span></label><input type="range" id="rastro-${ini.id}" min="10" max="2500" step="10" value="${ini.maxRastro}" oninput="attCard(${ini.id})"></div>` : ''}
                ${ini.tipo === 'guarda' ? `<div class="controle-grupo"><label>Direção: <span class="valor-slider" id="val-dir-${ini.id}">${ini.baseHeading}°</span></label><input type="range" id="dir-${ini.id}" min="0" max="360" step="15" value="${ini.baseHeading}" oninput="attCard(${ini.id})"></div>` : ''}
                ${ini.tipo === 'cao_corrente' ? `<div class="controle-grupo"><label>Corrente: <span class="valor-slider" id="val-cor-${ini.id}">${ini.tamanhoCorrente} m</span></label><input type="range" id="cor-${ini.id}" min="10" max="100" step="5" value="${ini.tamanhoCorrente}" oninput="attCard(${ini.id})"></div>` : ''}
                ${ini.tipo === 'hound_master' ? `
                <div style="display:flex; flex-wrap:wrap; gap: 5px;">
                    <div class="controle-grupo" style="flex:1; min-width:45%;"><label>Faro Cães: <span class="valor-slider" id="val-faro-${ini.id}">${ini.raioFaro}m</span></label><input type="range" id="faro-${ini.id}" min="5" max="100" step="1" value="${ini.raioFaro}" oninput="attCard(${ini.id})"></div>
                    <div class="controle-grupo" style="flex:1; min-width:45%;"><label>Espalha: <span class="valor-slider" id="val-espa-${ini.id}">${ini.espalhamento}m</span></label><input type="range" id="espa-${ini.id}" min="5" max="40" step="1" value="${ini.espalhamento}" oninput="attCard(${ini.id})"></div>
                    <div class="controle-grupo" style="flex:1; min-width:100%;"><label>Área Ronda: <span class="valor-slider" id="val-ronda-${ini.id}">${ini.raioRondaCaes}m</span></label><input type="range" id="ronda-${ini.id}" min="5" max="100" step="5" value="${ini.raioRondaCaes}" oninput="attCard(${ini.id})"></div>
                </div>` : ''}
                <div style="display:flex; gap:5px; margin-top:10px;"><button class="btn-card btn-aplicar" onclick="toggleCard(${ini.id})">FECHAR</button><button class="btn-card btn-excluir" onclick="excluirInimigo(${ini.id})">EXCLUIR</button></div>
            `;
        }

        card.innerHTML = `<div class="card-header ${classeCss}" onclick="toggleCard(${ini.id})"><span>${icone} ${nome} #${idCurto}</span><span>${isExpandido ? '🔼' : '⚙️'}</span></div><div class="card-body ${isExpandido ? 'ativo' : ''}" id="body-${ini.id}">${corpoHtml}</div>`;
        painel.appendChild(card);
    });
}

function attCard(id) {
    const ini = inimigos.find(i => i.id === id);
    if (!ini || ini.tipo === 'obstaculo') return;

    if(document.getElementById(`pat-${id}`)) ini.velPatrulha = parseFloat(document.getElementById(`pat-${id}`).value);
    if(document.getElementById(`per-${id}`)) ini.velPerseguicao = parseFloat(document.getElementById(`per-${id}`).value);
    if(document.getElementById(`raio-${id}`)) ini.raioVisao = parseFloat(document.getElementById(`raio-${id}`).value);
    
    if(document.getElementById(`val-pat-${id}`)) document.getElementById(`val-pat-${id}`).innerText = `${ini.velPatrulha} m/s`;
    if(document.getElementById(`val-per-${id}`)) document.getElementById(`val-per-${id}`).innerText = `${ini.velPerseguicao} m/s`;
    if(document.getElementById(`val-raio-${id}`)) document.getElementById(`val-raio-${id}`).innerText = `${ini.raioVisao} m`;

    if (ini.tipo === 'screamer' && document.getElementById(`rastro-${id}`)) { ini.maxRastro = parseInt(document.getElementById(`rastro-${id}`).value); document.getElementById(`val-rastro-${id}`).innerText = `${ini.maxRastro} pt`; }
    if (ini.tipo === 'guarda' && document.getElementById(`dir-${id}`)) { ini.baseHeading = parseInt(document.getElementById(`dir-${id}`).value); document.getElementById(`val-dir-${id}`).innerText = `${ini.baseHeading}°`; }
    if (ini.tipo === 'cao_corrente' && document.getElementById(`cor-${id}`)) {
        ini.tamanhoCorrente = parseInt(document.getElementById(`cor-${id}`).value);
        document.getElementById(`val-cor-${id}`).innerText = `${ini.tamanhoCorrente} m`;
        if (ini.correnteVisual) ini.correnteVisual.setRadius(ini.tamanhoCorrente);
    }
    if (ini.tipo === 'hound_master' && document.getElementById(`faro-${id}`)) {
        ini.raioFaro = parseInt(document.getElementById(`faro-${id}`).value); ini.espalhamento = parseInt(document.getElementById(`espa-${id}`).value); ini.raioRondaCaes = parseInt(document.getElementById(`ronda-${id}`).value);
        document.getElementById(`val-faro-${id}`).innerText = `${ini.raioFaro} m`; document.getElementById(`val-espa-${id}`).innerText = `${ini.espalhamento} m`; document.getElementById(`val-ronda-${id}`).innerText = `${ini.raioRondaCaes} m`;
        inimigos.forEach(h => { if (h.masterId === ini.id) { h.raioFaro = ini.raioFaro; h.velPatrulha = ini.velPatrulha * 1.5; h.velPerseguicao = ini.velPerseguicao * 1.2; if(h.areaVisual) h.areaVisual.setRadius(h.raioFaro); } });
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
            caes.forEach(c => { if(c.marker) layerInimigos.removeLayer(c.marker); if(c.areaVisual) layerInimigos.removeLayer(c.areaVisual); inimigos = inimigos.filter(x => x.id !== c.id); });
        }
        if (ini.marker) layerInimigos.removeLayer(ini.marker); if (ini.areaVisual) layerInimigos.removeLayer(ini.areaVisual);
        if (ini.polyline) layerInimigos.removeLayer(ini.polyline); if (ini.correnteVisual) layerInimigos.removeLayer(ini.correnteVisual);
        if (ini.linhaCorrente) layerInimigos.removeLayer(ini.linhaCorrente); if (ini.layer) layerInimigos.removeLayer(ini.layer); 
        inimigos = inimigos.filter(x => x.id !== id);
        if (cardExpandidoId === id) cardExpandidoId = null;
        renderizarListaInimigos();
    }
}