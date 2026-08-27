window.IAs = window.IAs || {};

window.IAs.screamer = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.estado === "PATRULHANDO" ? ini.rota[ini.indexAlvo] : posJogador;
    let velAtual = ini.estado === "PATRULHANDO" ? ini.velPatrulha : ini.velPerseguicao;
    let headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
    let alguemAgressivo = false;

    // 1. TESOURA EM TEMPO REAL: Apaga o rastro excedente na mesma hora se o slider diminuir
    while (ini.rastro.length > (ini.maxRastro || 300)) {
        ini.rastro.shift();
    }
    if (ini.polyline) ini.polyline.setLatLngs(ini.rastro);

    if (ini.estado !== 'SCREAMING') {
        let deveSalvar = true;
        if (ini.rastro.length > 0) {
            const ultimoPt = ini.rastro[ini.rastro.length - 1];
            // Só salva o ponto se ele andou um pouquinho, pra não sobrecarregar
            if (map.distance([ini.pos.lat, ini.pos.lng], ultimoPt) < 0.5) deveSalvar = false;
        }
        
        if (deveSalvar) {
            ini.rastro.push([ini.pos.lat, ini.pos.lng]);
            if (ini.polyline) ini.polyline.setLatLngs(ini.rastro);
        }
        
        let pisouNoRastro = false;
        for (let pt of ini.rastro) {
            // Hitbox de 8 metros para compensar a margem de erro do GPS
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
        // ELE ESTÁ GRITANDO E PERSEGUINDO
        if (map.distance(ini.pos, posJogador) > ini.raioVisao * 1.5) {
            ini.estado = 'PATRULHANDO'; 
            ini.rastro = []; // O rastro evapora ao despistar
            if (ini.polyline) ini.polyline.setLatLngs([]);
        } else {
            alvoMovimento = posJogador; 
            velAtual = ini.velPerseguicao; 
            alguemAgressivo = true;
        }
    }

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};