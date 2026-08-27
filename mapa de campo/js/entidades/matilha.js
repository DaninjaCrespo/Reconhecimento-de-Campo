window.IAs = window.IAs || {};

window.IAs.hound_master = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.rota[ini.indexAlvo];
    let velAtual = ini.velPatrulha;
    let headingDeg = ini.heading || 0;
    let alguemAgressivo = false;

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

    let jogadorVisto = estaNoCone(ini.pos, posJogador, headingDeg, ini.raioVisao, 60, obsArray);
    
    // NOVO: Matilha escuta grito
    let escutouGrito = inimigos.some(outro => outro.tipo === 'screamer' && outro.estado === 'SCREAMING' && map.distance(ini.pos, outro.pos) <= outro.raioVisao);

    if ((jogadorVisto || escutouGrito) && ini.estado !== 'wait_for_hounds') {
        ini.estado = 'wait_for_hounds'; playSound('radar');
        inimigos.filter(h => h.masterId === ini.id).forEach(h => h.estado = 'chase');
    }

    if(ini.estado === 'wait_for_hounds') alguemAgressivo = true;

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};

window.IAs.hound = function(ini, posJogador, obsArray, dt) {
    let alvoMovimento = ini.pos;
    let velAtual = 0;
    let headingDeg = ini.heading || 0;
    let alguemAgressivo = false;

    const master = inimigos.find(m => m.id === ini.masterId);
    if (!master) return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
    
    let distPlayer = map.distance(ini.pos, posJogador);
    let playerLoSBloqueado = castRay([ini.pos.lat, ini.pos.lng], [posJogador.lat, posJogador.lng], obsArray) !== null;
    let escutouGrito = inimigos.some(outro => outro.tipo === 'screamer' && outro.estado === 'SCREAMING' && map.distance(ini.pos, outro.pos) <= outro.raioVisao);
    
    if ((distPlayer <= ini.raioFaro && !playerLoSBloqueado) || escutouGrito) {
        if (ini.estado !== 'chase') playSound('radar');
        ini.estado = 'chase'; master.estado = 'wait_for_hounds';
        inimigos.filter(h => h.masterId === master.id).forEach(h => h.estado = 'chase');
    }

    if (ini.estado === 'chase') {
        alvoMovimento = posJogador; velAtual = ini.velPerseguicao; alguemAgressivo = true;
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
            
            const baseOndaX = Math.sin(t * ini.freqX + ini.phaseX) * spread;
            const baseOndaY = Math.cos(t * ini.freqY + ini.phaseY) * spread;
            const tremorX = Math.sin(t * 3.1 + ini.phaseY) * Math.cos(t * 5.2) * (spread * 0.4);
            const tremorY = Math.cos(t * 2.8 + ini.phaseX) * Math.sin(t * 4.5) * (spread * 0.4);
            
            alvoMovimento = L.latLng(master.pos.lat + (baseOndaY + tremorY) * 0.000009, master.pos.lng + (baseOndaX + tremorX) * 0.000009);
            const ritmo = Math.abs(Math.sin(t * 2.0 + ini.speedPhase)); 
            velAtual = master.velPatrulha * (0.2 + (ritmo * 3.0)); 
        }
    }
    headingDeg = Math.atan2(alvoMovimento.lng - ini.pos.lng, alvoMovimento.lat - ini.pos.lat) * 180 / Math.PI;

    return { alvoMovimento, velAtual, headingDeg, alguemAgressivo };
};