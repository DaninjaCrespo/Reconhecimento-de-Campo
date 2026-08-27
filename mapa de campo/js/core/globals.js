// =====================================================================
// VARIÁVEIS GLOBAIS
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