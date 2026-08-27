window.IAs = window.IAs || {};

window.IAs.screamer = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.estado === "PATRULHANDO" ? ini.rota[ini.indexAlvo] : posJogador;
    let velAtual = ini.estado === "PATRULHANDO" ? ini.velPatrulha : ini.velPerseguicao;
    let headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
    let alguemAgressivo = false;

    // 1. TESOURA EM TEMPO REAL
    let cortouRastro = false;
    while (ini.rastro.length > (ini.maxRastro || 300)) {
        ini.rastro.shift();
        cortouRastro = true; // Avisa que houve um corte no slider
    }

    if (ini.estado !== 'SCREAMING') {
        let deveSalvar = true;
        if (ini.rastro.length > 0) {
            const ultimoPt = ini.rastro[ini.rastro.length - 1];
            // Só salva o ponto se ele andou um pouquinho (0.5m)
            if (map.distance([ini.pos.lat, ini.pos.lng], ultimoPt) < 0.5) deveSalvar = false;
        }
        
        if (deveSalvar) {
            ini.rastro.push([ini.pos.lat, ini.pos.lng]);
        }
        
        // ATENÇÃO: Só aciona o processamento gráfico do mapa se a linha realmente mudou!
        if ((deveSalvar || cortouRastro) && ini.polyline) {
            ini.polyline.setLatLngs(ini.rastro);
        }
        
        let pisouNoRastro = false;
        for (let pt of ini.rastro) {
            if (map.distance(posJogador, pt) < 8) { 
                pisouNoRastro = true; 
                break; 
            }
        }
        
        if (pisouNoRastro) {
            ini.estado = 'SCREAMING'; 
            alvoMovimento = posJogador; 
            velAtual = ini.velPerseguicao; 
            alguemAgressivo = true; 
            playSound('radar');
        }
    } else {
        if (map.distance(ini.pos, posJogador) > ini.raioVisao * 1.5) {
            ini.estado = 'PATRULHANDO'; 
            ini.rastro = []; 
            if (ini.polyline) ini.polyline.setLatLngs([]);
        } else {
            alvoMovimento = posJogador; 
            velAtual = ini.velPerseguicao; 
            alguemAgressivo = true;
            
            // Atualiza visualmente o corte caso você mova o slider enquanto ele grita
            if (cortouRastro && ini.polyline) {
                ini.polyline.setLatLngs(ini.rastro);
            }
        }
    }

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};