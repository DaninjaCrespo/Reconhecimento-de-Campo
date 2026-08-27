window.IAs = window.IAs || {};

window.IAs.fiscal = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.estado === "PATRULHANDO" ? ini.rota[ini.indexAlvo] : posJogador;
    let velAtual = ini.estado === "PATRULHANDO" ? ini.velPatrulha : ini.velPerseguicao;
    let headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;
    let alguemAgressivo = false;

    let jogadorVisto = estaNoCone(ini.pos, posJogador, headingDeg, ini.raioVisao, 60, obsArray); 
    
    // NOVO: Ele ouviu o grito de um Atormentado?
    let escutouGrito = inimigos.some(outro => outro.tipo === 'screamer' && outro.estado === 'SCREAMING' && map.distance(ini.pos, outro.pos) <= outro.raioVisao);

    if (jogadorVisto || escutouGrito) {
        if (ini.estado !== "PERSEGUICAO") playSound('radar');
        ini.estado = "PERSEGUICAO"; 
        alguemAgressivo = true; 
        alvoMovimento = posJogador; 
        velAtual = ini.velPerseguicao;
    } else {
        ini.estado = "PATRULHANDO";
    }

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};