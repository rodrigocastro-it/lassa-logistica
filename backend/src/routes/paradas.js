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

// Monta o SET da atualização de status. Na "chegada" especificamente,
// também tenta capturar a posição real do veículo na Point Track (pela
// placa) — é o GPS de campo que depois alimenta a correção do cadastro de
// endereço do cliente no WiBi. Isso é best-effort: se a Point Track falhar
// ou o veículo não tiver correspondência, a marcação acontece do mesmo
// jeito, só sem o GPS.
async function montarAtualizacaoStatus(status, problemaDescricao, placa) {
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
    if (status === 'chegada' && placa) {
        try {
            const posicao = await obterPosicaoPorPlaca(placa);
            if (posicao) {
                sets.push(`chegada_lat = $${valores.length + 1}`, `chegada_lng = $${valores.length + 2}`);
                valores.push(posicao.latitude, posicao.longitude);
            }
        } catch (err) {
            console.error('Falha ao capturar posição da Point Track na chegada:', err);
        }
    }
    return { sets, valores };
}

function validarStatus(status, problemaDescricao, res) {
    if (!STATUS_VALIDOS.includes(status)) {
        res.status(400).json({ erro: `Status inválido. Use um de: ${STATUS_VALIDOS.join(', ')}` });
        return false;
    }
    if (status === 'problema' && !problemaDescricao) {
        res.status(400).json({ erro: 'Descreva o problema.' });
        return false;
    }
    return true;
}

// Marca chegada / início / fim / problema de uma única parada. Cada
// marcação grava a data/hora do servidor no momento da chamada (não confia
// em horário do dispositivo).
router.patch('/:id/status', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status, problemaDescricao } = req.body;
    if (!validarStatus(status, problemaDescricao, res)) return;

    const dono = await pool.query(
        `SELECT c.veiculo_placa
         FROM paradas p
         JOIN cargas c ON c.id = p.carga_id
         WHERE p.id = $1 AND c.motorista_id = $2`,
        [id, req.motorista.id]
    );
    if (dono.rows.length === 0) {
        return res.status(404).json({ erro: 'Parada não encontrada.' });
    }

    const { sets, valores } = await montarAtualizacaoStatus(status, problemaDescricao, dono.rows[0].veiculo_placa);
    valores.push(id);
    const result = await pool.query(
        `UPDATE paradas SET ${sets.join(', ')} WHERE id = $${valores.length} RETURNING *`,
        valores
    );
    res.json(result.rows[0]);
});

// Marca chegada / início / fim / problema pra um GRUPO de paradas de uma
// vez — usado quando o mesmo cliente tem mais de uma nota na carga: o
// motorista chega/sai uma vez só fisicamente, então todas as notas daquele
// cliente mudam de status juntas.
router.patch('/grupo/status', async (req, res) => {
    const { paradaIds, status, problemaDescricao } = req.body;
    if (!Array.isArray(paradaIds) || paradaIds.length === 0) {
        return res.status(400).json({ erro: 'Informe paradaIds (lista de ids).' });
    }
    if (!validarStatus(status, problemaDescricao, res)) return;

    const ids = paradaIds.map((v) => parseInt(v, 10));
    const dono = await pool.query(
        `SELECT DISTINCT c.veiculo_placa
         FROM paradas p
         JOIN cargas c ON c.id = p.carga_id
         WHERE p.id = ANY($1) AND c.motorista_id = $2`,
        [ids, req.motorista.id]
    );
    if (dono.rows.length === 0) {
        return res.status(404).json({ erro: 'Paradas não encontradas.' });
    }

    const { sets, valores } = await montarAtualizacaoStatus(status, problemaDescricao, dono.rows[0].veiculo_placa);
    valores.push(ids);
    const result = await pool.query(
        `UPDATE paradas SET ${sets.join(', ')} WHERE id = ANY($${valores.length}) RETURNING *`,
        valores
    );
    res.json(result.rows);
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
