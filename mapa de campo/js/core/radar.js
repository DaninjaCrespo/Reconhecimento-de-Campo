// =====================================================================
// RENDERIZAÇÃO DO RADAR TÁTICO
// =====================================================================
function drawRadar() {
    try {
        const canvas = document.getElementById('radarCanvas');
        if (!canvas) return;
        
        canvas.width = 140; 
        canvas.height = 140;
        
        const ctx = canvas.getContext('2d');
        const width = 140; const height = 140;
        const cx = 70; const cy = 70; const radius = 65;

        let radarColor = '#00ff66'; let radarBg = '#021006'; let sweepSpeed = 3000; let alertLevel = 0;
        
        if (posJogador) {
            let closest = Infinity;
            inimigos.forEach(ini => {
                if(ini.tipo === 'obstaculo') return;
                let perigoFactor = (ini.tipo === 'saqueador') ? 1.5 : 1; 
                const dist = map.distance(posJogador, ini.pos) * perigoFactor;
                if (dist < closest) closest = dist;
            });
            if (closest <= 25) { alertLevel = 2; radarColor = '#ff2222'; radarBg = '#1a0505'; sweepSpeed = 1000; } 
            else if (closest <= 50) { alertLevel = 1; radarColor = '#ffaa00'; radarBg = '#140f00'; sweepSpeed = 2000; }
        }

        if (alertLevel > 0) {
            const now = performance.now(); const tickRate = alertLevel === 2 ? 400 : 1200; 
            if (now - lastRadarTick > tickRate) { playSound('click'); lastRadarTick = now; }
        }

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = radarBg; ctx.fill(); ctx.strokeStyle = radarColor; ctx.lineWidth = 2; ctx.stroke();
        for (let r = radius * 0.33; r < radius; r += radius * 0.33) {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = alertLevel === 0 ? 'rgba(0, 255, 102, 0.25)' : alertLevel === 1 ? 'rgba(255, 170, 0, 0.25)' : 'rgba(255, 34, 34, 0.25)';
            ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
        ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
        ctx.strokeStyle = alertLevel === 0 ? 'rgba(0, 255, 102, 0.2)' : alertLevel === 1 ? 'rgba(255, 170, 0, 0.2)' : 'rgba(255, 34, 34, 0.2)';
        ctx.stroke();

        const sweepAngle = (performance.now() / sweepSpeed * Math.PI * 2) % (Math.PI * 2);
        const tailAngle = 0.65; 
        ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius - 1, sweepAngle - tailAngle, sweepAngle, false); ctx.closePath();
        const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        if (alertLevel === 0) { sweepGradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)'); sweepGradient.addColorStop(1, 'rgba(0, 255, 102, 0.0)'); } 
        else if (alertLevel === 1) { sweepGradient.addColorStop(0, 'rgba(255, 170, 0, 0.4)'); sweepGradient.addColorStop(1, 'rgba(255, 170, 0, 0.0)'); } 
        else { sweepGradient.addColorStop(0, 'rgba(255, 34, 34, 0.4)'); sweepGradient.addColorStop(1, 'rgba(255, 34, 34, 0.0)'); }
        ctx.fillStyle = sweepGradient; ctx.fill(); ctx.restore();

        const sweepX = cx + (radius - 2) * Math.cos(sweepAngle); const sweepY = cy + (radius - 2) * Math.sin(sweepAngle);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sweepX, sweepY); ctx.strokeStyle = radarColor; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = radarColor; ctx.fill();

        if (posJogador) {
            const displayRange = 50; 
            ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.clip(); 

            inimigos.forEach(ini => {
                if (ini.tipo === 'screamer' && ini.rastro && ini.rastro.length > 1) {
                    ctx.beginPath(); let firstPoint = true;
                    for (let i = 0; i < ini.rastro.length; i++) {
                        const pt = ini.rastro[i]; const ptDist = map.distance(posJogador, pt);
                        const normDist = ptDist / displayRange; const rPx = normDist * (radius - 12); 
                        const dLat = pt[0] - posJogador.lat; const dLng = pt[1] - posJogador.lng;
                        const angleRad = Math.atan2(dLat, dLng) - currentHeading;
                        const ptX = cx + rPx * Math.cos(angleRad); const ptY = cy - rPx * Math.sin(angleRad);
                        if (firstPoint) { ctx.moveTo(ptX, ptY); firstPoint = false; } else { ctx.lineTo(ptX, ptY); }
                    }
                    ctx.strokeStyle = 'rgba(170, 0, 255, 0.6)'; ctx.lineWidth = 2; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]); 
                }
            });
            ctx.restore();

            inimigos.forEach(ini => {
                if(ini.tipo === 'obstaculo') return;
                const dist = map.distance(posJogador, ini.pos);
                if (dist <= displayRange) {
                    const normDist = dist / displayRange; const rPx = Math.min(normDist, 1.0) * (radius - 12);
                    const dLat = ini.pos.lat - posJogador.lat; const dLng = ini.pos.lng - posJogador.lng;
                    const angleRad = Math.atan2(dLat, dLng) - currentHeading;
                    const blipX = cx + rPx * Math.cos(angleRad); const blipY = cy - rPx * Math.sin(angleRad);
                    
                    let corBlip = '#ff2222';
                    if(ini.tipo === 'screamer') corBlip = '#aa00ff';
                    if(ini.tipo === 'guarda') corBlip = '#ffff00';
                    if(ini.tipo === 'hound_master') corBlip = '#ff8800';
                    if(ini.tipo === 'hound') corBlip = '#00bbff';
                    if(ini.tipo === 'cao_corrente') corBlip = '#00ff00';
                    if(ini.tipo === 'saqueador') corBlip = '#bbbbbb';
                    
                    ctx.save(); ctx.translate(blipX, blipY);
                    const headingRad = (ini.heading || 0) * (Math.PI / 180) - currentHeading;
                    ctx.rotate(headingRad);
                    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(3.5, 3.5); ctx.lineTo(0, 1.5); ctx.lineTo(-3.5, 3.5);
                    ctx.closePath(); ctx.fillStyle = corBlip; ctx.fill(); ctx.restore();
                }
            });
        }
    } catch(err) { console.warn('Radar bloqueado temporariamente', err); }
}