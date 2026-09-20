/**
 * Integração com a API da Point Track (rastreamento GPS).
 * Ver manual "Integracao_pointTrack_V3.2.pdf" e testes reais feitos em
 * 2026-09-20 (histórico do projeto) para os formatos abaixo — nenhum campo
 * aqui foi inventado.
 *
 * Autenticação: PUT /Rest2/login.json (email/senha) -> JWT válido por 4h,
 * mais a lista `rastreados` (cada um com `id` = rastreado_id e
 * `veiculo.placa`). Guardamos token + mapa placa->rastreado_id em memória,
 * renovando antes de expirar.
 */
require('dotenv').config();

const BASE_URL = process.env.POINTTRACK_BASE_URL || 'https://sistema.pointtrack.com.br';
const EMAIL = process.env.POINTTRACK_EMAIL;
const SENHA = process.env.POINTTRACK_SENHA;

// Token dura 4h; renovamos com folga de 10 min.
const MARGEM_RENOVACAO_MS = 10 * 60 * 1000;
const DURACAO_TOKEN_MS = 4 * 60 * 60 * 1000;

let cache = {
    token: null,
    expiraEm: 0,
    placaParaRastreadoId: new Map()
};

async function login() {
    if (!EMAIL || !SENHA) {
        throw new Error('POINTTRACK_EMAIL / POINTTRACK_SENHA não configurados.');
    }

    const res = await fetch(`${BASE_URL}/Rest2/login.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, senha: SENHA })
    });
    const data = await res.json();

    if (data.ret_code !== 200) {
        throw new Error(`Falha no login da Point Track: ${data.ret_msg}`);
    }

    const placaParaRastreadoId = new Map();
    for (const item of data.rastreados || []) {
        const r = item.Rastreado;
        const placa = r?.veiculo?.placa;
        if (placa) {
            placaParaRastreadoId.set(placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(), r.id);
        }
    }

    cache = {
        token: data.token,
        expiraEm: Date.now() + DURACAO_TOKEN_MS,
        placaParaRastreadoId
    };
}

async function garantirLogin() {
    if (!cache.token || Date.now() > cache.expiraEm - MARGEM_RENOVACAO_MS) {
        await login();
    }
}

function rastreadoIdPorPlaca(placa) {
    if (!placa) return null;
    return cache.placaParaRastreadoId.get(placa.replace(/[^A-Z0-9]/gi, '').toUpperCase()) || null;
}

/**
 * Último posicionamento de um veículo, identificado pela placa (como
 * cadastrada no WiBi em t_patrimonio.pm_placa).
 * Retorna null se a placa não estiver cadastrada na Point Track.
 */
async function obterPosicaoPorPlaca(placa) {
    await garantirLogin();

    const rastreadoId = rastreadoIdPorPlaca(placa);
    if (!rastreadoId) return null;

    const res = await fetch(`${BASE_URL}/RestPosicionamento/getPosicionamentos.json`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cache.token}`
        },
        body: JSON.stringify({ rastreado_id: rastreadoId })
    });
    const data = await res.json();

    if (data.ret_code !== 200) {
        throw new Error(`Falha ao consultar posicionamento: ${data.ret_msg}`);
    }

    const posicao = data.ultimoPosicionamento?.[0]?.UltimosPosicionamento
        || data.ultimoPosicionamento?.[0];
    if (!posicao) return null;

    return {
        latitude: parseFloat(posicao.latitude),
        longitude: parseFloat(posicao.longitude),
        velocidadeKmh: posicao.velocidade != null ? parseFloat(posicao.velocidade) : null,
        ignicaoLigada: !!posicao.ignicao,
        direcaoGraus: posicao.direcao != null ? parseFloat(posicao.direcao) : null,
        motorista: posicao.motorista || null,
        atualizadoEm: posicao.transmissao_datahora || null
    };
}

module.exports = { obterPosicaoPorPlaca };
