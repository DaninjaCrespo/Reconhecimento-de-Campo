window.IAs = window.IAs || {};

window.IAs.obstaculo = function(ini, posJogador, obsArray, dt) {
    // Obstáculos físicos não possuem inteligência artificial nem movimento.
    // Apenas servem como barreira de colisão (Raycasting) para os outros inimigos.
    return null;
};