const { pool } = require('../db/pg');

/**
 * Procura se existe um mínimo REAL cadastrado (vindo da folha de rotas da
 * empresa, não calculado por distância) pra uma cidade/parada. Prioriza:
 * 1. Parada específica com valor próprio (ex: "Tangente" dentro de Massapê)
 * 2. Combinação de paradas que inclua o nome (ex: "Itapipoca" dentro de
 *    "Itapipoca + Miraíma") -- pega a combinação de maior mínimo que
 *    contenha o nome, já que normalmente é a mais específica/completa.
 * 3. Mínimo base da rota, se o nome da cidade bater com o nome da rota.
 *
 * Retorna null se não achar nada cadastrado -- nesse caso quem chamou deve
 * cair pro cálculo por distância.
 */
async function buscarMinimoConhecido(nomeCidade) {
    if (!nomeCidade) return null;

    const parada = await pool.query(
        `SELECT rp.minimo, rp.nome_parada AS fonte, r.nome AS rota_nome
         FROM rotas_paradas_minimas rp
         JOIN rotas r ON r.id = rp.rota_id
         WHERE rp.nome_parada ILIKE $1
         LIMIT 1`,
        [nomeCidade]
    );
    if (parada.rows.length > 0) {
        return {
            minimo: Number(parada.rows[0].minimo),
            fonte: `parada "${parada.rows[0].fonte}" da rota ${parada.rows[0].rota_nome}`
        };
    }

    const combinacao = await pool.query(
        `SELECT rc.minimo, rc.descricao, r.nome AS rota_nome
         FROM rotas_combinacoes rc
         JOIN rotas r ON r.id = rc.rota_id
         WHERE rc.descricao ILIKE '%' || $1 || '%'
         ORDER BY rc.minimo DESC
         LIMIT 1`,
        [nomeCidade]
    );
    if (combinacao.rows.length > 0) {
        return {
            minimo: Number(combinacao.rows[0].minimo),
            fonte: `combinação "${combinacao.rows[0].descricao}" da rota ${combinacao.rows[0].rota_nome}`
        };
    }

    const rota = await pool.query(
        `SELECT minimo_base, nome FROM rotas WHERE nome ILIKE '%' || $1 || '%' AND minimo_base IS NOT NULL LIMIT 1`,
        [nomeCidade]
    );
    if (rota.rows.length > 0) {
        return { minimo: Number(rota.rows[0].minimo_base), fonte: `rota ${rota.rows[0].nome}` };
    }

    return null;
}

async function listarRotas() {
    const rotas = await pool.query('SELECT * FROM rotas ORDER BY nome');
    const combinacoes = await pool.query('SELECT * FROM rotas_combinacoes ORDER BY rota_id, minimo');
    const paradas = await pool.query('SELECT * FROM rotas_paradas_minimas ORDER BY rota_id, nome_parada');

    return rotas.rows.map((r) => ({
        ...r,
        combinacoes: combinacoes.rows.filter((c) => c.rota_id === r.id),
        paradas: paradas.rows.filter((p) => p.rota_id === r.id)
    }));
}

module.exports = { buscarMinimoConhecido, listarRotas };
