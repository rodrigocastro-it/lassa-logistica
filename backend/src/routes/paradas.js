const express = require('express');
const { pool } = require('../db/pg');
const { autenticar } = require('../middleware/auth');
const { obterPosicaoPorPlaca } = require('../services/pointTrackService');

const router = express.Router();
router.use(autenticar);

const STATUS_VALIDOS = ['pendente', 'chegada', 'inicio', 'fim', 'problema'];
const COLUNA_TIMESTAMP = {
    chegada: 'chegada_em',
    inicio: 'inicio_em',
    fim: 'fim_em',
    problema: 'problema_em'
};

// Marca chegada / início / fim / problema. Cada marcação grava a data/hora
// do servidor no momento da chamada (não confia em horário do dispositivo).
//
// Na "chegada" especificamente, também tenta capturar a posição real do
// veículo na Point Track (pela placa) e grava junto — é o GPS de campo que
// depois alimenta a correção do cadastro de endereço do cliente no WiBi.
// Isso é best-effort: se a Point Track falhar ou o veículo não tiver
// correspondência, a marcação de chegada acontece do mesmo jeito, só sem
// o GPS.
router.patch('/:id/status', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status, problemaDescricao } = req.body;

    if (!STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ erro: `Status inválido. Use um de: ${STATUS_VALIDOS.join(', ')}` });
    }
    if (status === 'problema' && !problemaDescricao) {
        return res.status(400).json({ erro: 'Descreva o problema.' });
    }

    const colunaTimestamp = COLUNA_TIMESTAMP[status];
    const sets = ['status = $1'];
    const valores = [status];

    if (colunaTimestamp) {
        sets.push(`${colunaTimestamp} = now()`);
    }
    if (status === 'problema') {
        sets.push(`problema_descricao = $${valores.length + 1}`);
        valores.push(problemaDescricao);
    }

    if (status === 'chegada') {
        try {
            const cargaResult = await pool.query(
                `SELECT c.veiculo_placa
                 FROM paradas p
                 JOIN cargas c ON c.id = p.carga_id
                 WHERE p.id = $1`,
                [id]
            );
            const placa = cargaResult.rows[0]?.veiculo_placa;
            if (placa) {
                const posicao = await obterPosicaoPorPlaca(placa);
                if (posicao) {
                    sets.push(`chegada_lat = $${valores.length + 1}`, `chegada_lng = $${valores.length + 2}`);
                    valores.push(posicao.latitude, posicao.longitude);
                }
            }
        } catch (err) {
            console.error('Falha ao capturar posição da Point Track na chegada:', err);
        }
    }

    valores.push(id);
    const result = await pool.query(
        `UPDATE paradas SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`,
        valores
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Parada não encontrada.' });
    }
    res.json(result.rows[0]);
});

// Paradas manuais (almoço, abastecimento etc.)
router.post('/manuais', async (req, res) => {
    const { cargaId, tipo, observacao } = req.body;
    if (!cargaId || !tipo) {
        return res.status(400).json({ erro: 'Informe cargaId e tipo.' });
    }
    const result = await pool.query(
        `INSERT INTO paradas_manuais (carga_id, tipo, observacao) VALUES ($1, $2, $3) RETURNING *`,
        [cargaId, tipo, observacao || null]
    );
    res.status(201).json(result.rows[0]);
});

router.patch('/manuais/:id/encerrar', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query(
        `UPDATE paradas_manuais SET fim_em = now() WHERE id = $1 RETURNING *`,
        [id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Parada manual não encontrada.' });
    }
    res.json(result.rows[0]);
});

router.get('/manuais/carga/:cargaId', async (req, res) => {
    const cargaId = parseInt(req.params.cargaId, 10);
    const result = await pool.query(
        `SELECT * FROM paradas_manuais WHERE carga_id = $1 ORDER BY inicio_em`,
        [cargaId]
    );
    res.json(result.rows);
});

module.exports = router;
