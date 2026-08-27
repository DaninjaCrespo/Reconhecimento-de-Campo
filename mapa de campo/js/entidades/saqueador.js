window.IAs = window.IAs || {};

window.IAs.saqueador = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.rota[ini.indexAlvo];
    let velAtual = ini.velPatrulha;
    let headingDeg = ini.heading || 0;
    let alguemAgressivo = false;

    let distPlayer = map.distance(ini.pos, posJogador);
    let playerLoSBloqueado = castRay([ini.pos.lat, ini.pos.lng], [posJogador.lat, posJogador.lng], obsArray) !== null;
    
    if (distPlayer <= ini.raioVisao && !playerLoSBloqueado) {
        ini.estado = 'FLEE';
    } else if (distPlayer > ini.raioVisao * 1.5) {
        ini.estado = 'PATRULHANDO';
    }

    if (ini.estado === 'FLEE') {
        velAtual = ini.velPerseguicao; 
        let anguloFuga = Math.atan2(ini.pos.lng - posJogador.lng, ini.pos.lat - posJogador.lat);
        alvoMovimento = L.latLng(ini.pos.lat + Math.cos(anguloFuga) * 0.0005, ini.pos.lng + Math.sin(anguloFuga) * 0.0005);
    } else {
        alvoMovimento = ini.rota[ini.indexAlvo]; 
        velAtual = ini.velPatrulha;
    }
    
    headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};