const express = require('express');
const { pool } = require('../db/pg');
const { getCargaByNumero } = require('../services/wibiCargaService');
const { otimizarSequencia } = require('../services/routeOptimizer');
const { origem } = require('../config/origem');
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
// antes, apenas retorna o estado atual (não reotimiza nem apaga progresso).
router.post('/carregar', async (req, res) => {
    const caId = parseInt(req.body.caId, 10);
    if (!Number.isInteger(caId)) {
        return res.status(400).json({ erro: 'Número de carga inválido.' });
    }

    const existente = await pool.query('SELECT id FROM cargas WHERE wibi_ca_id = $1', [caId]);
    if (existente.rows.length > 0) {
        return res.redirect(307, `/api/cargas/${existente.rows[0].id}`);
    }

    const cargaWibi = await getCargaByNumero(caId);
    if (!cargaWibi) {
        return res.status(404).json({ erro: `Carga ${caId} não encontrada no WiBi.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const cargaInsert = await client.query(
            `INSERT INTO cargas (wibi_ca_id, data_entrega, veiculo_placa, motorista_id, origem_lat, origem_lng, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'em_rota')
             RETURNING id`,
            [
                cargaWibi.caId,
                cargaWibi.dataEntrega,
                cargaWibi.veiculo?.placa || null,
                req.motorista.id,
                origem.lat,
                origem.lng
            ]
        );
        const cargaId = cargaInsert.rows[0].id;

        const paradasParaOtimizar = cargaWibi.paradas.map((p) => ({
            wibiVdCodigo: p.vdCodigo,
            wibiClCodigo: p.clCodigo,
            clienteNome: p.clienteNome,
            clienteEndereco: p.endereco,
            clienteTelefone: p.telefone,
            latitude: p.latitude,
            longitude: p.longitude
        }));

        const ordenadas = origem.lat != null && origem.lng != null
            ? otimizarSequencia(origem, paradasParaOtimizar)
            : paradasParaOtimizar.map((p, idx) => ({ ...p, sequencia: idx + 1 }));

        for (const p of ordenadas) {
            await client.query(
                `INSERT INTO paradas
                    (carga_id, wibi_vd_codigo, wibi_cl_codigo, sequencia, cliente_nome, cliente_endereco, cliente_telefone, latitude, longitude)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [cargaId, p.wibiVdCodigo, p.wibiClCodigo, p.sequencia, p.clienteNome, p.clienteEndereco, p.clienteTelefone, p.latitude, p.longitude]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: cargaId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao carregar carga:', err);
        res.status(500).json({ erro: 'Falha ao carregar a carga.' });
    } finally {
        client.release();
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
