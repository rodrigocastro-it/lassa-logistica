const { pool } = require('../db/pg');
const { distanciaHaversineKm } = require('./routeOptimizer');

/**
 * Calcula se uma entrega "vale a pena" com base na distância até o cliente.
 *
 * Fórmula confirmada com o Rodrigo em 2026-10-17 (é como a Erileila/diretoria
 * decidem hoje manualmente, só que sem calculadora):
 *
 *   mínimo = distância (km, só ida) × fator_ida_volta × custo_km_caminhao × margem_multiplicador
 *
 * Exemplo: 15km × 2 × 5 × 10 = R$ 1.500.
 */
async function obterConfigCusto() {
    const result = await pool.query('SELECT * FROM config_custo_logistico WHERE id = 1');
    return result.rows[0];
}

async function atualizarConfigCusto({ custoKmCaminhao, fatorIdaVolta, margemMultiplicador }) {
    const result = await pool.query(
        `UPDATE config_custo_logistico
         SET custo_km_caminhao = $1, fator_ida_volta = $2, margem_multiplicador = $3, atualizado_em = now()
         WHERE id = 1
         RETURNING *`,
        [custoKmCaminhao, fatorIdaVolta, margemMultiplicador]
    );
    return result.rows[0];
}

function calcularMinimo(distanciaKmIda, config) {
    return (
        Number(distanciaKmIda) *
        Number(config.fator_ida_volta) *
        Number(config.custo_km_caminhao) *
        Number(config.margem_multiplicador)
    );
}

/**
 * Custo de "desvio": quanto a mais custa pra rota incluir um ponto B entre
 * um ponto A e um ponto C, comparado a ir direto de A pra C.
 * dist(A,B) + dist(B,C) - dist(A,C)
 */
function calcularCustoDesvio(pontoA, pontoB, pontoC) {
    const ab = distanciaHaversineKm(pontoA.lat, pontoA.lng, pontoB.lat, pontoB.lng);
    const bc = distanciaHaversineKm(pontoB.lat, pontoB.lng, pontoC.lat, pontoC.lng);
    const ac = distanciaHaversineKm(pontoA.lat, pontoA.lng, pontoC.lat, pontoC.lng);
    return ab + bc - ac;
}

module.exports = { obterConfigCusto, atualizarConfigCusto, calcularMinimo, calcularCustoDesvio };
