window.IAs = window.IAs || {};

window.IAs.guarda = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.rota[0];
    let velAtual = ini.velPatrulha;
    let headingDeg = ini.heading || ini.baseHeading;
    let alguemAgressivo = false;

    if (ini.estado === 'PATRULHANDO' || ini.estado === 'RETORNANDO') {
        let distHome = map.distance(ini.pos, alvoMovimento);
        if (distHome < 0.5) {
            ini.pos = alvoMovimento; headingDeg = ini.baseHeading; velAtual = 0; ini.estado = 'PATRULHANDO';
        } else {
            velAtual = ini.velPatrulha;
            headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
        }
    }
    
    let jogadorVisto = estaNoCone(ini.pos, posJogador, headingDeg, ini.raioVisao, 60, obsArray);
    
    // NOVO: Sentinela também ouve gritos
    let escutouGrito = inimigos.some(outro => outro.tipo === 'screamer' && outro.estado === 'SCREAMING' && map.distance(ini.pos, outro.pos) <= outro.raioVisao);
    
    if (jogadorVisto || escutouGrito) { 
        ini.estado = 'PERSEGUICAO'; 
        alvoMovimento = posJogador; 
        velAtual = ini.velPerseguicao; 
        alguemAgressivo = true; 
    } else if (ini.estado === 'PERSEGUICAO') {
        if (map.distance(ini.pos, posJogador) > ini.raioVisao * 1.5) {
            ini.estado = 'RETORNANDO';
        } else { 
            alvoMovimento = posJogador; velAtual = ini.velPerseguicao; alguemAgressivo = true; 
        }
    }

    if (ini.estado === 'PERSEGUICAO') {
        headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
    }

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};