/**
 * Otimização de rota — módulo isolado de propósito.
 *
 * MVP: nearest-neighbor simples por distância em linha reta (haversine) a
 * partir de uma origem. Não considera trânsito, sentido de ruas, janelas de
 * entrega, etc. Trocar o algoritmo aqui dentro não deve exigir mudanças em
 * quem chama `otimizarSequencia`.
 *
 * Paradas sem latitude/longitude (geocodificação ausente ou com erro) ficam
 * no fim da lista, na ordem original em que chegaram — nunca são descartadas
 * nem tratadas como se tivessem coordenada 0,0.
 */

function distanciaHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param {{lat: number, lng: number}} origem
 * @param {Array<object>} paradas - cada parada precisa ter `latitude`/`longitude` (podem ser null)
 * @returns {Array<object>} mesmas paradas, na ordem otimizada, com `sequencia` (1-based) e `distanciaKm` até a parada anterior
 */
function otimizarSequencia(origem, paradas) {
    const comCoordenada = paradas.filter((p) => p.latitude != null && p.longitude != null);
    const semCoordenada = paradas.filter((p) => p.latitude == null || p.longitude == null);

    const restantes = [...comCoordenada];
    const ordenadas = [];
    let atual = origem;

    while (restantes.length > 0) {
        let melhorIdx = 0;
        let melhorDist = Infinity;
        for (let i = 0; i < restantes.length; i++) {
            const d = distanciaHaversineKm(atual.lat, atual.lng, restantes[i].latitude, restantes[i].longitude);
            if (d < melhorDist) {
                melhorDist = d;
                melhorIdx = i;
            }
        }
        const proxima = restantes.splice(melhorIdx, 1)[0];
        ordenadas.push({ ...proxima, distanciaKm: melhorDist });
        atual = { lat: proxima.latitude, lng: proxima.longitude };
    }

    const todas = [...ordenadas, ...semCoordenada.map((p) => ({ ...p, distanciaKm: null }))];
    return todas.map((p, idx) => ({ ...p, sequencia: idx + 1 }));
}

module.exports = { otimizarSequencia, distanciaHaversineKm };
