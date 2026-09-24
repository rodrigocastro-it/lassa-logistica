const express = require('express');
const { pool } = require('../db/pg');
const { obterPosicaoPorPlaca } = require('../services/pointTrackService');
const { montarOuObterRota } = require('../services/montarRotaService');

const router = express.Router();

// Endpoints de leitura pra torre de controle. Sem autenticação de motorista
// (uso interno) — se for exposto fora da rede da empresa, adicionar um
// login próprio de torre de controle antes de ir pra produção.

// A torre de controle monta a rota (puxa do WiBi + otimiza + salva) sem
// precisar de um motorista logado — ele "assume" a rota depois, digitando
// o mesmo número da carga no app dele (ver montarRotaService).
router.post('/rotas/montar', async (req, res) => {
    const caId = parseInt(req.body.caId, 10);
    if (!Number.isInteger(caId)) {
        return res.status(400).json({ erro: 'Número de carga inválido.' });
    }

    try {
        const resultado = await montarOuObterRota(caId, null);
        if (!resultado) {
            return res.status(404).json({ erro: `Carga ${caId} não encontrada no WiBi.` });
        }
        res.status(resultado.jaExistia ? 200 : 201).json({ id: resultado.id });
    } catch (err) {
        console.error('Erro ao montar rota:', err);
        res.status(500).json({ erro: 'Falha ao montar a rota.' });
    }
});

router.get('/rotas', async (req, res) => {
    const { data } = req.query; // YYYY-MM-DD opcional

    const params = [];
    let where = '';
    if (data) {
        params.push(data);
        where = `WHERE c.data_entrega = $${params.length}`;
    }

    const result = await pool.query(
        `SELECT c.id, c.wibi_ca_id, c.data_entrega, c.veiculo_placa, c.status,
                m.nome AS motorista_nome,
                COUNT(p.id) AS total_paradas,
                COUNT(p.id) FILTER (WHERE p.status = 'fim') AS paradas_concluidas,
                COUNT(p.id) FILTER (WHERE p.status = 'problema') AS paradas_com_problema
         FROM cargas c
         LEFT JOIN motoristas m ON m.id = c.motorista_id
         LEFT JOIN paradas p ON p.carga_id = c.id
         ${where}
         GROUP BY c.id, m.nome
         ORDER BY c.criado_em DESC`,
        params
    );
    res.json(result.rows);
});

router.get('/rotas/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cargaResult = await pool.query(
        `SELECT c.*, m.nome AS motorista_nome, m.usuario AS motorista_usuario
         FROM cargas c
         LEFT JOIN motoristas m ON m.id = c.motorista_id
         WHERE c.id = $1`,
        [id]
    );
    if (cargaResult.rows.length === 0) {
        return res.status(404).json({ erro: 'Rota não encontrada.' });
    }
    const paradasResult = await pool.query(
        'SELECT * FROM paradas WHERE carga_id = $1 ORDER BY sequencia',
        [id]
    );
    const paradasManuaisResult = await pool.query(
        'SELECT * FROM paradas_manuais WHERE carga_id = $1 ORDER BY inicio_em',
        [id]
    );
    res.json({
        ...cargaResult.rows[0],
        paradas: paradasResult.rows,
        paradasManuais: paradasManuaisResult.rows
    });
});

router.get('/rotas/:id/posicao', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cargaResult = await pool.query('SELECT veiculo_placa FROM cargas WHERE id = $1', [id]);
    if (cargaResult.rows.length === 0) {
        return res.status(404).json({ erro: 'Rota não encontrada.' });
    }
    const placa = cargaResult.rows[0].veiculo_placa;
    if (!placa) {
        return res.status(404).json({ erro: 'Rota sem veículo cadastrado.' });
    }

    try {
        const posicao = await obterPosicaoPorPlaca(placa);
        if (!posicao) {
            return res.status(404).json({ erro: 'Veículo não encontrado na Point Track.' });
        }
        res.json(posicao);
    } catch (err) {
        console.error('Erro ao consultar Point Track:', err);
        res.status(502).json({ erro: 'Falha ao consultar a Point Track.' });
    }
});

// Exporta a rota otimizada em CSV (abre direto no Excel/Google Sheets).
router.get('/rotas/:id/exportar', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cargaResult = await pool.query('SELECT * FROM cargas WHERE id = $1', [id]);
    if (cargaResult.rows.length === 0) {
        return res.status(404).json({ erro: 'Rota não encontrada.' });
    }
    const carga = cargaResult.rows[0];
    const paradasResult = await pool.query(
        'SELECT * FROM paradas WHERE carga_id = $1 ORDER BY sequencia',
        [id]
    );

    const escapar = (v) => String(v ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ');
    const linhas = [
        ['Sequência', 'Cliente', 'Endereço', 'Telefone', 'Latitude', 'Longitude', 'Status'].join(';'),
        ...paradasResult.rows.map((p) => [
            p.sequencia,
            escapar(p.cliente_nome),
            escapar(p.cliente_endereco),
            escapar(p.cliente_telefone),
            p.latitude ?? '',
            p.longitude ?? '',
            p.status
        ].join(';'))
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rota-carga-${carga.wibi_ca_id}.csv"`);
    // BOM no início pra o Excel reconhecer UTF-8 certinho (acentos não quebram).
    res.send(`﻿${linhas.join('\n')}`);
});

module.exports = router;
