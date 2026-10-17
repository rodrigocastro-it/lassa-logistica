const express = require('express');
const { pool } = require('../db/pg');
const { asyncHandler } = require('../middleware/asyncHandler');
const { origem } = require('../config/origem');
const {
    obterConfigCusto,
    atualizarConfigCusto,
    calcularMinimo,
    calcularCustoDesvio
} = require('../services/custoLogisticoService');
const { distanciaHaversineKm } = require('../services/routeOptimizer');

const router = express.Router();

// Sem autenticação de motorista (uso interno da torre de controle), igual
// ao dashboard.js -- ver nota de segurança lá.

router.get('/config-custo', asyncHandler(async (req, res) => {
    res.json(await obterConfigCusto());
}));

router.put('/config-custo', asyncHandler(async (req, res) => {
    const { custoKmCaminhao, fatorIdaVolta, margemMultiplicador } = req.body;
    if ([custoKmCaminhao, fatorIdaVolta, margemMultiplicador].some((v) => v == null || isNaN(Number(v)))) {
        return res.status(400).json({ erro: 'Informe custoKmCaminhao, fatorIdaVolta e margemMultiplicador (números).' });
    }
    res.json(await atualizarConfigCusto({ custoKmCaminhao, fatorIdaVolta, margemMultiplicador }));
}));

// Calculadora: dado um ponto (lat/lng) ou uma distância direta em km,
// devolve o mínimo que a entrega (ou grupo de entregas naquele ponto)
// precisa somar pra valer a pena, considerando a rota saindo e voltando
// pra Lassa em Sobral.
router.post('/calcular-minimo', asyncHandler(async (req, res) => {
    const { latitude, longitude, distanciaKm } = req.body;
    const config = await obterConfigCusto();

    let distanciaKmIda = distanciaKm != null ? Number(distanciaKm) : null;
    if (distanciaKmIda == null && latitude != null && longitude != null) {
        distanciaKmIda = distanciaHaversineKm(origem.lat, origem.lng, Number(latitude), Number(longitude));
    }
    if (distanciaKmIda == null) {
        return res.status(400).json({ erro: 'Informe distanciaKm, ou latitude e longitude.' });
    }

    const minimo = calcularMinimo(distanciaKmIda, config);
    res.json({ distanciaKmIda: Number(distanciaKmIda.toFixed(2)), minimo: Number(minimo.toFixed(2)), config });
}));

// Calculadora de desvio: quanto a mais custa (em km e em R$) incluir um
// ponto B numa rota que já vai de A até C direto.
router.post('/calcular-desvio', asyncHandler(async (req, res) => {
    const { pontoA, pontoB, pontoC } = req.body;
    if (!pontoA || !pontoB || !pontoC) {
        return res.status(400).json({ erro: 'Informe pontoA, pontoB e pontoC, cada um com {lat, lng}.' });
    }
    const config = await obterConfigCusto();
    const desvioKm = calcularCustoDesvio(pontoA, pontoB, pontoC);
    const custoDesvio = calcularMinimo(desvioKm, config);
    res.json({ desvioKm: Number(desvioKm.toFixed(2)), custoDesvio: Number(custoDesvio.toFixed(2)), config });
}));

router.get('/regioes', asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM regioes_cronograma ORDER BY dia_semana, nome_regiao');
    res.json(result.rows);
}));

router.post('/regioes', asyncHandler(async (req, res) => {
    const { nomeRegiao, diaSemana } = req.body;
    if (!nomeRegiao || diaSemana == null) {
        return res.status(400).json({ erro: 'Informe nomeRegiao e diaSemana (0=domingo..6=sábado).' });
    }
    const result = await pool.query(
        'INSERT INTO regioes_cronograma (nome_regiao, dia_semana) VALUES ($1, $2) RETURNING *',
        [nomeRegiao, diaSemana]
    );
    res.status(201).json(result.rows[0]);
}));

router.patch('/regioes/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nomeRegiao, diaSemana, ativo } = req.body;
    const result = await pool.query(
        `UPDATE regioes_cronograma
         SET nome_regiao = COALESCE($1, nome_regiao),
             dia_semana = COALESCE($2, dia_semana),
             ativo = COALESCE($3, ativo)
         WHERE id = $4
         RETURNING *`,
        [nomeRegiao ?? null, diaSemana ?? null, ativo ?? null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Região não encontrada.' });
    res.json(result.rows[0]);
}));

router.delete('/regioes/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM regioes_cronograma WHERE id = $1', [id]);
    res.status(204).send();
}));

module.exports = router;
