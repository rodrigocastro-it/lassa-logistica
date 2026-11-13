const express = require('express');
const { pool } = require('../db/pg');
const { obterPosicaoPorPlaca } = require('../services/pointTrackService');
const { montarOuObterRota } = require('../services/montarRotaService');
const { getCargaByNumero, listarCargasAbertas, listarCargasEmEntrega, getCargaParaAvaliacao } = require('../services/wibiCargaService');
const { distanciaHaversineKm } = require('../services/routeOptimizer');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

// Endpoints de leitura pra torre de controle. Sem autenticação de motorista
// (uso interno) — se for exposto fora da rede da empresa, adicionar um
// login próprio de torre de controle antes de ir pra produção.

// A torre de controle monta a rota (puxa do WiBi + otimiza + salva) sem
// precisar de um motorista logado — ele "assume" a rota depois, digitando
// o mesmo número da carga no app dele (ver montarRotaService).
router.post('/rotas/montar', asyncHandler(async (req, res) => {
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
}));

// Lista as cargas em aberto no WiBi (ainda não processadas, prontas pra
// montar rota), até a data informada (padrão: hoje). Substitui o fluxo de
// digitar número de carga um por um — a torre de controle só olha a lista
// e manda montar as que quiser. Cruza com o que já existe localmente pra
// marcar o que já foi montado (e não deixar montar duas vezes à toa).
router.get('/cargas-wibi', asyncHandler(async (req, res) => {
    const dataLimite = req.query.data || new Date().toISOString().slice(0, 10);

    try {
        const cargasWibi = await listarCargasAbertas(dataLimite);
        if (cargasWibi.length === 0) {
            return res.json([]);
        }

        const idsWibi = cargasWibi.map((c) => c.caId);
        const jaMontadas = await pool.query(
            `SELECT wibi_ca_id, id, motorista_id FROM cargas WHERE wibi_ca_id = ANY($1)`,
            [idsWibi]
        );
        const montadasPorId = new Map(jaMontadas.rows.map((r) => [r.wibi_ca_id, r]));

        res.json(cargasWibi.map((c) => ({
            ...c,
            jaMontada: montadasPorId.has(c.caId),
            localId: montadasPorId.get(c.caId)?.id || null,
            temMotorista: !!montadasPorId.get(c.caId)?.motorista_id
        })));
    } catch (err) {
        console.error('Erro ao listar cargas em aberto no WiBi:', err);
        res.status(502).json({ erro: 'Falha ao consultar o WiBi.' });
    }
}));

// Lista as cargas que já estão em entrega no WiBi (status P) hoje,
// independente de terem sido carregadas no nosso sistema ou de ter
// motorista logado nelas -- é só o que já tá rodando na rua, direto do
// WiBi. Cruza com a tabela local só pra mostrar o nome do motorista
// quando ele já tiver assumido a rota aqui dentro.
router.get('/cargas-em-entrega', asyncHandler(async (req, res) => {
    const dataLimite = req.query.data || new Date().toISOString().slice(0, 10);

    try {
        const cargasWibi = await listarCargasEmEntrega(dataLimite);
        if (cargasWibi.length === 0) {
            return res.json([]);
        }

        const idsWibi = cargasWibi.map((c) => c.caId);
        const locais = await pool.query(
            `SELECT c.wibi_ca_id, c.id, m.nome AS motorista_nome
             FROM cargas c
             LEFT JOIN motoristas m ON m.id = c.motorista_id
             WHERE c.wibi_ca_id = ANY($1)`,
            [idsWibi]
        );
        const locaisPorId = new Map(locais.rows.map((r) => [r.wibi_ca_id, r]));

        res.json(cargasWibi.map((c) => ({
            ...c,
            localId: locaisPorId.get(c.caId)?.id || null,
            motoristaNome: locaisPorId.get(c.caId)?.motorista_nome || null
        })));
    } catch (err) {
        console.error('Erro ao listar cargas em entrega no WiBi:', err);
        res.status(502).json({ erro: 'Falha ao consultar o WiBi.' });
    }
}));

router.get('/motoristas', asyncHandler(async (req, res) => {
    const result = await pool.query(
        'SELECT id, nome, usuario FROM motoristas WHERE ativo ORDER BY nome'
    );
    res.json(result.rows);
}));

router.get('/rotas', asyncHandler(async (req, res) => {
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
}));

router.get('/rotas/:id', asyncHandler(async (req, res) => {
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
}));

// Reatribui (ou remove) o motorista responsável por uma carga já carregada
// — útil pra troca de motorista de última hora, ou pra corrigir um teste.
// motoristaId null libera a carga (sem motorista, como se tivesse sido
// montada pela torre de controle e ainda não assumida por ninguém).
router.patch('/rotas/:id/motorista', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const motoristaId = req.body.motoristaId != null ? parseInt(req.body.motoristaId, 10) : null;

    const result = await pool.query(
        `UPDATE cargas SET motorista_id = $1, atualizado_em = now() WHERE id = $2 RETURNING *`,
        [motoristaId, id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Rota não encontrada.' });
    }
    res.json(result.rows[0]);
}));

// Re-consulta o WiBi e atualiza o veículo salvo localmente. O veículo é
// copiado do WiBi só no momento em que a carga é montada/carregada — se
// alguém trocar o veículo no WiBi depois, este sistema não sabe sozinho,
// então esse endpoint existe pra sincronizar sob demanda.
router.patch('/rotas/:id/sincronizar-veiculo', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cargaResult = await pool.query('SELECT wibi_ca_id FROM cargas WHERE id = $1', [id]);
    if (cargaResult.rows.length === 0) {
        return res.status(404).json({ erro: 'Rota não encontrada.' });
    }

    try {
        const cargaWibi = await getCargaByNumero(cargaResult.rows[0].wibi_ca_id);
        if (!cargaWibi) {
            return res.status(404).json({ erro: 'Carga não encontrada mais no WiBi.' });
        }
        const result = await pool.query(
            `UPDATE cargas SET veiculo_placa = $1, atualizado_em = now() WHERE id = $2 RETURNING *`,
            [cargaWibi.veiculo?.placa || null, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao sincronizar veículo com o WiBi:', err);
        res.status(502).json({ erro: 'Falha ao consultar o WiBi.' });
    }
}));

// Define o dia/horário PROGRAMADO de saída e chegada -- quem monta a carga
// (Jacineuda/Nina) digita a meta, pra comparar depois com o real na
// reunião semanal de acompanhamento (pedido da Zuleika em 2026-11-11).
router.patch('/rotas/:id/programado', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { programadoSaidaEm, programadoChegadaEm } = req.body;

    const result = await pool.query(
        `UPDATE cargas
         SET programado_saida_em = COALESCE($1, programado_saida_em),
             programado_chegada_em = COALESCE($2, programado_chegada_em),
             atualizado_em = now()
         WHERE id = $3
         RETURNING *`,
        [programadoSaidaEm || null, programadoChegadaEm || null, id]
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Rota não encontrada.' });
    }
    res.json(result.rows[0]);
}));

// Indicadores pra reunião semanal de acompanhamento de entregas (pedido da
// Zuleika em 2026-11-11, alinhado com a Roberta): uma linha por carga, com
// rota/motorista/placa, programado x real de saída e chegada, quantos
// pedidos, ocorrências e pedidos não entregues. As "cidades da rota" vêm
// direto do WiBi (mesmo serviço do Planejamento de Carga) -- se o WiBi
// falhar pra uma carga específica, essa carga ainda aparece no relatório,
// só sem a lista de cidades (best-effort, não derruba o relatório inteiro).
async function montarIndicadores(inicio, fim) {
    const cargasResult = await pool.query(
        `SELECT c.id, c.wibi_ca_id, c.data_entrega, c.veiculo_placa,
                m.nome AS motorista_nome,
                c.programado_saida_em, c.saida_em, c.saida_hodometro_km,
                c.programado_chegada_em, c.retorno_em,
                COUNT(p.id) AS total_notas,
                COUNT(p.id) FILTER (WHERE p.status = 'problema') AS total_ocorrencias,
                COUNT(p.id) FILTER (WHERE p.status = 'nao_entregue') AS total_nao_entregues,
                array_remove(array_agg(p.problema_descricao) FILTER (WHERE p.status = 'problema'), NULL) AS ocorrencias,
                array_remove(array_agg(p.nao_entregue_motivo) FILTER (WHERE p.status = 'nao_entregue'), NULL) AS motivos_nao_entregues
         FROM cargas c
         LEFT JOIN motoristas m ON m.id = c.motorista_id
         LEFT JOIN paradas p ON p.carga_id = c.id
         WHERE c.data_entrega BETWEEN $1 AND $2
         GROUP BY c.id, m.nome
         ORDER BY c.data_entrega DESC, c.id DESC`,
        [inicio, fim]
    );

    const linhas = [];
    for (const carga of cargasResult.rows) {
        let cidades = [];
        try {
            const cargaWibi = await getCargaParaAvaliacao(carga.wibi_ca_id);
            cidades = [...new Set((cargaWibi?.vendas || []).map((v) => v.cidadeNome).filter(Boolean))];
        } catch (err) {
            console.error(`Erro ao buscar cidades da carga ${carga.wibi_ca_id} no WiBi:`, err);
        }
        linhas.push({ ...carga, cidades });
    }
    return linhas;
}

router.get('/indicadores', asyncHandler(async (req, res) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const inicio = req.query.inicio || seteDiasAtras;
    const fim = req.query.fim || hoje;
    res.json(await montarIndicadores(inicio, fim));
}));

router.get('/indicadores/exportar', asyncHandler(async (req, res) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const inicio = req.query.inicio || seteDiasAtras;
    const fim = req.query.fim || hoje;
    const linhas = await montarIndicadores(inicio, fim);

    const escapar = (v) => String(v ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ');
    const dataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '');
    const csv = [
        [
            'Carga', 'Data entrega', 'Rota (cidades)', 'Placa', 'Motorista',
            'Saída programada', 'Saída real', 'Hodômetro saída',
            'Chegada programada', 'Retorno real',
            'Pedidos (notas)', 'Ocorrências', 'Quais ocorrências',
            'Não entregues', 'Motivos'
        ].join(';'),
        ...linhas.map((l) => [
            l.wibi_ca_id,
            l.data_entrega ? new Date(l.data_entrega).toLocaleDateString('pt-BR') : '',
            escapar(l.cidades.join(', ')),
            escapar(l.veiculo_placa),
            escapar(l.motorista_nome),
            dataHora(l.programado_saida_em),
            dataHora(l.saida_em),
            l.saida_hodometro_km ?? '',
            dataHora(l.programado_chegada_em),
            dataHora(l.retorno_em),
            l.total_notas,
            l.total_ocorrencias,
            escapar((l.ocorrencias || []).join(' | ')),
            l.total_nao_entregues,
            escapar((l.motivos_nao_entregues || []).join(' | '))
        ].join(';'))
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="indicadores-entrega-${inicio}-a-${fim}.csv"`);
    res.send(`﻿${csv.join('\n')}`);
}));

router.get('/rotas/:id/posicao', asyncHandler(async (req, res) => {
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
}));

// Exporta a rota otimizada em CSV (abre direto no Excel/Google Sheets).
router.get('/rotas/:id/exportar', asyncHandler(async (req, res) => {
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
        [
            'Sequência', 'Cliente', 'Endereço', 'Telefone', 'Status',
            'Latitude cadastro', 'Longitude cadastro',
            'Latitude chegada (GPS real)', 'Longitude chegada (GPS real)',
            'Diferença (km)'
        ].join(';'),
        ...paradasResult.rows.map((p) => {
            const temAmbos = p.latitude != null && p.longitude != null && p.chegada_lat != null && p.chegada_lng != null;
            const diferencaKm = temAmbos
                ? distanciaHaversineKm(Number(p.latitude), Number(p.longitude), Number(p.chegada_lat), Number(p.chegada_lng)).toFixed(2)
                : '';
            return [
                p.sequencia,
                escapar(p.cliente_nome),
                escapar(p.cliente_endereco),
                escapar(p.cliente_telefone),
                p.status,
                p.latitude ?? '',
                p.longitude ?? '',
                p.chegada_lat ?? '',
                p.chegada_lng ?? '',
                diferencaKm
            ].join(';');
        })
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rota-carga-${carga.wibi_ca_id}.csv"`);
    // BOM no início pra o Excel reconhecer UTF-8 certinho (acentos não quebram).
    res.send(`﻿${linhas.join('\n')}`);
}));

module.exports = router;
