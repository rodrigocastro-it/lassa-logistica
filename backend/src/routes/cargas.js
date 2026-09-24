const express = require('express');
const { pool } = require('../db/pg');
const { getCargaByNumero } = require('../services/wibiCargaService');
const { montarOuObterRota } = require('../services/montarRotaService');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// Consulta a carga no WiBi sem gravar nada — usado pra pré-visualizar antes
// de "carregar" a rota de fato.
router.get('/wibi/:caId', async (req, res) => {
    const caId = parseInt(req.params.caId, 10);
    if (!Number.isInteger(caId)) {
        return res.status(400).json({ erro: 'Número de carga inválido.' });
    }

    try {
        const carga = await getCargaByNumero(caId);
        if (!carga) {
            return res.status(404).json({ erro: `Carga ${caId} não encontrada no WiBi.` });
        }
        res.json(carga);
    } catch (err) {
        console.error('Erro ao consultar carga no WiBi:', err);
        res.status(502).json({ erro: 'Falha ao consultar o WiBi.' });
    }
});

// Carrega a carga do WiBi, otimiza a sequência de paradas e grava localmente
// vinculada ao motorista logado. Idempotente: se a carga já foi carregada
// antes (inclusive montada pela torre de controle sem motorista ainda),
// apenas retorna o estado atual e assume a rota pra esse motorista.
router.post('/carregar', async (req, res) => {
    const caId = parseInt(req.body.caId, 10);
    if (!Number.isInteger(caId)) {
        return res.status(400).json({ erro: 'Número de carga inválido.' });
    }

    try {
        const resultado = await montarOuObterRota(caId, req.motorista.id);
        if (!resultado) {
            return res.status(404).json({ erro: `Carga ${caId} não encontrada no WiBi.` });
        }
        res.status(resultado.jaExistia ? 200 : 201).json({ id: resultado.id });
    } catch (err) {
        console.error('Erro ao carregar carga:', err);
        res.status(500).json({ erro: 'Falha ao carregar a carga.' });
    }
});

router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cargaResult = await pool.query('SELECT * FROM cargas WHERE id = $1', [id]);
    if (cargaResult.rows.length === 0) {
        return res.status(404).json({ erro: 'Carga não encontrada.' });
    }
    const paradasResult = await pool.query(
        'SELECT * FROM paradas WHERE carga_id = $1 ORDER BY sequencia',
        [id]
    );
    res.json({ ...cargaResult.rows[0], paradas: paradasResult.rows });
});

// Encerra a carga atual (libera o motorista pra carregar outra em /rota).
// Não exige que todas as paradas estejam concluídas — o motorista pode
// precisar encerrar mesmo com pendências/problemas registrados.
router.patch('/:id/finalizar', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query(
        `UPDATE cargas SET status = 'finalizada', atualizado_em = now()
         WHERE id = $1 AND motorista_id = $2
         RETURNING *`,
        [id, req.motorista.id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Carga não encontrada.' });
    }
    res.json(result.rows[0]);
});

router.get('/', async (req, res) => {
    const result = await pool.query(
        `SELECT c.*, m.nome AS motorista_nome
         FROM cargas c
         LEFT JOIN motoristas m ON m.id = c.motorista_id
         WHERE c.motorista_id = $1
         ORDER BY c.criado_em DESC
         LIMIT 20`,
        [req.motorista.id]
    );
    res.json(result.rows);
});

module.exports = router;
