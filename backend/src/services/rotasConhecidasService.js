const { pool } = require('../db/pg');

/**
 * O WiBi guarda muitas localidades no formato "X (Y)" -- ex: "Maceió
 * (Camocim)", "Santa Terezinha (Granja)" -- onde X é a localidade/distrito
 * e Y é o município ao qual ela pertence oficialmente. Pra decidir de qual
 * rota uma entrega faz parte, o nome do município (Y) costuma ser mais
 * confiável que o nome da localidade (X): ex. existe um "Mucambo" cadastrado
 * dentro da rota Groaíras/Cariré, mas "Mucambo (Chaval)" é um distrito de
 * Chaval, que pertence à rota Camocim -- bater só pelo nome "Mucambo" dava
 * rota errada.
 */
function parseLocalidade(nome) {
    if (!nome) return { core: null, parent: null };
    const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(nome.trim());
    if (match) {
        return { core: match[1].trim(), parent: match[2].trim() };
    }
    return { core: nome.trim(), parent: null };
}

function termosDeBusca(nomeLocalidade) {
    const { core, parent } = parseLocalidade(nomeLocalidade);
    // Parent primeiro: é o município oficial, mais confiável pra identificar a rota.
    return parent ? [parent, core] : [core];
}

/**
 * Identifica a qual rota cadastrada uma localidade do WiBi pertence,
 * sem se preocupar com o valor mínimo exato -- só "de qual rota é isso".
 * Usado pra agrupar localidades da mesma carga antes de avaliar o mínimo
 * (ver `avaliarPorCidade` em custoLogisticoService), já que o WiBi trata
 * cada localidade/distrito como uma "cidade" separada, mas na prática elas
 * compartilham a mesma viagem/rota.
 */
async function identificarRotaPorNome(nomeCidade) {
    if (!nomeCidade) return null;
    for (const termo of termosDeBusca(nomeCidade)) {
        if (!termo) continue;

        const parada = await pool.query(
            `SELECT rota_id FROM rotas_paradas_minimas WHERE nome_parada ILIKE $1 LIMIT 1`,
            [termo]
        );
        if (parada.rows.length > 0) return parada.rows[0].rota_id;

        const combinacao = await pool.query(
            `SELECT rota_id FROM rotas_combinacoes WHERE descricao ILIKE '%' || $1 || '%' LIMIT 1`,
            [termo]
        );
        if (combinacao.rows.length > 0) return combinacao.rows[0].rota_id;

        const rota = await pool.query(`SELECT id FROM rotas WHERE nome ILIKE '%' || $1 || '%' LIMIT 1`, [termo]);
        if (rota.rows.length > 0) return rota.rows[0].id;
    }
    return null;
}

/**
 * Procura se existe um mínimo REAL cadastrado (vindo da folha de rotas da
 * empresa, não calculado por distância) pra uma localidade isolada. Prioriza:
 * 1. Parada específica com valor próprio (ex: "Tangente" dentro de Massapê)
 * 2. Combinação de paradas que inclua o nome (ex: "Itapipoca" dentro de
 *    "Itapipoca + Miraíma") -- pega a combinação de maior mínimo que
 *    contenha o nome, já que normalmente é a mais específica/completa.
 * 3. Mínimo base da rota, se o nome bater com o nome da rota.
 *
 * Algumas paradas têm dois valores (confirmado com o Rodrigo em
 * 2026-10-18, caso da Bilheira): um mais baixo quando a parada "pega
 * carona" numa rota que já vai passar por lá, e um mais alto quando é uma
 * viagem dedicada só pra ela. `sozinho=true` pede o valor de viagem
 * dedicada, quando existir cadastrado.
 *
 * Retorna null se não achar nada cadastrado -- nesse caso quem chamou deve
 * cair pro cálculo por distância.
 */
async function buscarMinimoConhecido(nomeCidade, { sozinho = false } = {}) {
    if (!nomeCidade) return null;

    for (const termo of termosDeBusca(nomeCidade)) {
        if (!termo) continue;

        const parada = await pool.query(
            `SELECT rp.minimo, rp.minimo_sozinho, rp.nome_parada AS fonte, r.id AS rota_id, r.nome AS rota_nome
             FROM rotas_paradas_minimas rp
             JOIN rotas r ON r.id = rp.rota_id
             WHERE rp.nome_parada ILIKE $1
             LIMIT 1`,
            [termo]
        );
        if (parada.rows.length > 0) {
            const row = parada.rows[0];
            const usaSozinho = sozinho && row.minimo_sozinho != null;
            return {
                rotaId: row.rota_id,
                rotaNome: row.rota_nome,
                minimo: Number(usaSozinho ? row.minimo_sozinho : row.minimo),
                fonte: `parada "${row.fonte}" da rota ${row.rota_nome}${usaSozinho ? ' (entrega avulsa, sem o resto da rota)' : ''}`
            };
        }

        const combinacao = await pool.query(
            `SELECT rc.minimo, rc.descricao, r.id AS rota_id, r.nome AS rota_nome
             FROM rotas_combinacoes rc
             JOIN rotas r ON r.id = rc.rota_id
             WHERE rc.descricao ILIKE '%' || $1 || '%'
             ORDER BY rc.minimo DESC
             LIMIT 1`,
            [termo]
        );
        if (combinacao.rows.length > 0) {
            return {
                rotaId: combinacao.rows[0].rota_id,
                rotaNome: combinacao.rows[0].rota_nome,
                minimo: Number(combinacao.rows[0].minimo),
                fonte: `combinação "${combinacao.rows[0].descricao}" da rota ${combinacao.rows[0].rota_nome}`
            };
        }

        const rota = await pool.query(
            `SELECT id, minimo_base, nome FROM rotas WHERE nome ILIKE '%' || $1 || '%' AND minimo_base IS NOT NULL LIMIT 1`,
            [termo]
        );
        if (rota.rows.length > 0) {
            return {
                rotaId: rota.rows[0].id,
                rotaNome: rota.rows[0].nome,
                minimo: Number(rota.rows[0].minimo_base),
                fonte: `rota ${rota.rows[0].nome}`
            };
        }
    }

    return null;
}

/**
 * Mesma lógica de `buscarMinimoConhecido`, mas pra um GRUPO de localidades
 * já identificadas como sendo da mesma rota (ver `identificarRotaPorNome`).
 * Isso é o que resolve o problema de localidades do WiBi serem tratadas uma
 * por uma: quando várias paradas da mesma rota aparecem juntas numa carga,
 * o mínimo precisa ser avaliado pela SOMA delas contra o mínimo da rota (ou
 * de uma combinação que cubra exatamente esse conjunto), não uma por uma.
 */
async function buscarMinimoDoGrupo(rotaId, nomesLocalidades, { sozinho = false } = {}) {
    if (!rotaId) return null;

    if (nomesLocalidades.length === 1) {
        return buscarMinimoConhecido(nomesLocalidades[0], { sozinho });
    }

    const rotaResult = await pool.query('SELECT id, nome, minimo_base FROM rotas WHERE id = $1', [rotaId]);
    const rota = rotaResult.rows[0];
    if (!rota) return null;

    const termosPorLocalidade = nomesLocalidades.map((nome) => termosDeBusca(nome));

    const combinacoes = await pool.query(
        'SELECT descricao, minimo FROM rotas_combinacoes WHERE rota_id = $1 ORDER BY minimo ASC',
        [rotaId]
    );
    for (const combo of combinacoes.rows) {
        const componentes = combo.descricao.split('+').map((p) => p.trim().toLowerCase());
        const cobreTodasAsLocalidades = termosPorLocalidade.every((termos) =>
            termos.some((termo) => {
                const termoLower = termo.toLowerCase();
                return componentes.some((comp) => comp.includes(termoLower) || termoLower.includes(comp));
            })
        );
        if (cobreTodasAsLocalidades) {
            return {
                rotaId: rota.id,
                rotaNome: rota.nome,
                minimo: Number(combo.minimo),
                fonte: `combinação "${combo.descricao}" da rota ${rota.nome}`
            };
        }
    }

    if (rota.minimo_base != null) {
        return {
            rotaId: rota.id,
            rotaNome: rota.nome,
            minimo: Number(rota.minimo_base),
            fonte: `rota ${rota.nome} (agrupando ${nomesLocalidades.join(', ')})`
        };
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

module.exports = {
    parseLocalidade,
    identificarRotaPorNome,
    buscarMinimoConhecido,
    buscarMinimoDoGrupo,
    listarRotas
};
