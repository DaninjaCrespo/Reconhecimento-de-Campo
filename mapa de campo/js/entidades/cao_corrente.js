window.IAs = window.IAs || {};

window.IAs.cao_corrente = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.posOrigem;
    let velAtual = 0;
    let headingDeg = ini.heading || 0;
    let alguemAgressivo = false;

    let distDaBase = map.distance(ini.pos, ini.posOrigem);
    let distPlayerDaBase = map.distance(posJogador, ini.posOrigem);
    let playerLoSBloqueado = castRay([ini.pos.lat, ini.pos.lng], [posJogador.lat, posJogador.lng], obsArray) !== null;
    
    // NOVO: Cão reage ao grito
    let escutouGrito = inimigos.some(outro => outro.tipo === 'screamer' && outro.estado === 'SCREAMING' && map.distance(ini.pos, outro.pos) <= outro.raioVisao);

    if ((distPlayerDaBase <= ini.raioVisao && !playerLoSBloqueado) || escutouGrito) {
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
        alguemAgressivo = true;
        if (distPlayerDaBase > ini.tamanhoCorrente) {
            let angleToPlayer = Math.atan2(posJogador.lng - ini.posOrigem.lng, posJogador.lat - ini.posOrigem.lat) * 180 / Math.PI;
            alvoMovimento = calcularDestino(ini.posOrigem, angleToPlayer, ini.tamanhoCorrente);
        } else { 
            alvoMovimento = posJogador; 
        }
    }
    
    headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
    
    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};