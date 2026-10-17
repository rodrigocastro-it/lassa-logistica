const { pool } = require('../db/pg');
const { distanciaHaversineKm } = require('./routeOptimizer');
const { geocodificarCidade } = require('./geocodificacaoService');

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

/**
 * Agrupa as vendas de uma carga por cidade, soma o valor de cada grupo,
 * calcula a distância até lá (centróide dos clientes com GPS daquele
 * grupo, a partir da origem da Lassa) e o mínimo que o grupo precisa
 * somar pra compensar a viagem. Não decide nada sozinho -- só mostra o
 * número pra quem monta a carga decidir.
 *
 * Se nenhum cliente do grupo tiver GPS cadastrado no WiBi, busca o centro
 * da cidade por geocodificação (nome da cidade, não o endereço exato do
 * cliente) como aproximação -- é melhor que não calcular nada, mas fica
 * marcado como `gpsAproximado: true` pra não passar como se fosse exato.
 */
async function avaliarPorCidade(vendas, config, origem) {
    const porCidade = new Map();
    for (const venda of vendas) {
        const chave = venda.cidadeId ?? `sem-cidade:${venda.cidadeNome}`;
        if (!porCidade.has(chave)) {
            porCidade.set(chave, { cidadeNome: venda.cidadeNome, uf: venda.uf, vendas: [] });
        }
        porCidade.get(chave).vendas.push(venda);
    }

    const resultados = [];
    for (const grupo of porCidade.values()) {
        const valorTotal = grupo.vendas.reduce((acc, v) => acc + v.valorTotal, 0);
        const comGps = grupo.vendas.filter((v) => v.latitude != null && v.longitude != null);

        let distanciaKm = null;
        let minimo = null;
        let diferenca = null;
        let atingiuMinimo = null;
        let gpsAproximado = false;

        let ponto = null;
        if (comGps.length > 0) {
            ponto = {
                lat: comGps.reduce((acc, v) => acc + v.latitude, 0) / comGps.length,
                lng: comGps.reduce((acc, v) => acc + v.longitude, 0) / comGps.length
            };
        } else {
            ponto = await geocodificarCidade(grupo.cidadeNome, grupo.uf);
            gpsAproximado = !!ponto;
        }

        if (ponto) {
            distanciaKm = distanciaHaversineKm(origem.lat, origem.lng, ponto.lat, ponto.lng);
            minimo = calcularMinimo(distanciaKm, config);
            diferenca = valorTotal - minimo;
            atingiuMinimo = diferenca >= 0;
        }

        resultados.push({
            cidadeNome: grupo.cidadeNome,
            uf: grupo.uf,
            totalClientes: new Set(grupo.vendas.map((v) => v.clCodigo)).size,
            totalNotas: grupo.vendas.length,
            valorTotal: Number(valorTotal.toFixed(2)),
            distanciaKm: distanciaKm != null ? Number(distanciaKm.toFixed(2)) : null,
            minimo: minimo != null ? Number(minimo.toFixed(2)) : null,
            diferenca: diferenca != null ? Number(diferenca.toFixed(2)) : null,
            atingiuMinimo,
            gpsAproximado,
            semGps: !ponto,
            vendas: grupo.vendas
        });
    }

    return resultados.sort((a, b) => (a.atingiuMinimo === b.atingiuMinimo ? 0 : a.atingiuMinimo ? 1 : -1));
}

module.exports = {
    obterConfigCusto,
    atualizarConfigCusto,
    calcularMinimo,
    calcularCustoDesvio,
    avaliarPorCidade
};
