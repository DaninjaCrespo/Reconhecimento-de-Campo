// =====================================================================
// MATEMÁTICA GERAL E INTERSECÇÕES (RAYCASTING)
// =====================================================================
function segmentIntersect(p0, p1, p2, p3) {
    const s1_x = p1[0] - p0[0], s1_y = p1[1] - p0[1];
    const s2_x = p3[0] - p2[0], s2_y = p3[1] - p2[1];
    const denom = (-s2_x * s1_y + s1_x * s2_y);
    if (denom === 0) return null; 
    const s = (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) / denom;
    const t = ( s2_x * (p0[1] - p2[1]) - s2_y * (p0[0] - p2[0])) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return [p0[0] + (t * s1_x), p0[1] + (t * s1_y)];
    }
    return null;
}

function castRay(start, end, obstaculos) {
    let closestHit = null;
    let minDist = Infinity;
    
    obstaculos.forEach(obs => {
        for (let i = 0; i < obs.length; i++) {
            const p2 = obs[i];
            const p3 = obs[(i + 1) % obs.length];
            const hit = segmentIntersect(start, end, p2, p3);
            if (hit) {
                const dist = Math.hypot(hit[0] - start[0], hit[1] - start[1]);
                if (dist < minDist) {
                    minDist = dist;
                    closestHit = hit;
                }
            }
        }
    });
    return closestHit;
}

function isMarkerInsidePolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function calcularDestino(latlng, headingDeg, distMeters) {
    const R = 6378137; const d = distMeters / R;
    const lat1 = latlng.lat * Math.PI / 180; const lng1 = latlng.lng * Math.PI / 180;
    const brng = headingDeg * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
}

function estaNoCone(posInimigo, posPlayer, headingDeg, raioMetros, aberturaDeg, obsArray) {
    let distancia = map.distance(posInimigo, posPlayer);
    if (distancia > raioMetros) return false;
    
    if (castRay([posInimigo.lat, posInimigo.lng], [posPlayer.lat, posPlayer.lng], obsArray)) return false;

    let dy = posPlayer.lat - posInimigo.lat; let dx = (posPlayer.lng - posInimigo.lng) * Math.cos(posInimigo.lat * Math.PI / 180);
    let anguloProJogador = Math.atan2(dx, dy) * 180 / Math.PI;
    let diff = Math.abs(headingDeg - anguloProJogador); if (diff > 180) diff = 360 - diff;
    return diff <= (aberturaDeg / 2);
}