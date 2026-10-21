const { pool } = require('../db/pg');
const { distanciaHaversineKm, otimizarSequencia } = require('./routeOptimizer');
const { geocodificarCidade } = require('./geocodificacaoService');
const { identificarRotaPorNome, buscarMinimoDoGrupo, parseLocalidade } = require('./rotasConhecidasService');

/**
 * Calcula se uma entrega "vale a pena" com base na distância até o cliente.
 *
 * Fórmula confirmada com o Rodrigo em 2026-10-17 (é como a Erileila/diretoria
 * decidem hoje manualmente, só que sem calculadora):
 *
 *   mínimo = distância (km, só ida) × fator_ida_volta × custo_km_caminhao × margem_multiplicador
 *
 * Exemplo: 15km × 2 × 5 × 10 = R$ 1.500.
 */
async function obterConfigCusto() {
    const result = await pool.query('SELECT * FROM config_custo_logistico WHERE id = 1');
    return result.rows[0];
}

async function atualizarConfigCusto({ custoKmCaminhao, fatorIdaVolta, margemMultiplicador }) {
    const result = await pool.query(
        `UPDATE config_custo_logistico
         SET custo_km_caminhao = $1, fator_ida_volta = $2, margem_multiplicador = $3, atualizado_em = now()
         WHERE id = 1
         RETURNING *`,
        [custoKmCaminhao, fatorIdaVolta, margemMultiplicador]
    );
    return result.rows[0];
}

function calcularMinimo(distanciaKmIda, config) {
    return (
        Number(distanciaKmIda) *
        Number(config.fator_ida_volta) *
        Number(config.custo_km_caminhao) *
        Number(config.margem_multiplicador)
    );
}

/**
 * Custo de "desvio": quanto a mais custa pra rota incluir um ponto B entre
 * um ponto A e um ponto C, comparado a ir direto de A pra C.
 * dist(A,B) + dist(B,C) - dist(A,C)
 */
function calcularCustoDesvio(pontoA, pontoB, pontoC) {
    const ab = distanciaHaversineKm(pontoA.lat, pontoA.lng, pontoB.lat, pontoB.lng);
    const bc = distanciaHaversineKm(pontoB.lat, pontoB.lng, pontoC.lat, pontoC.lng);
    const ac = distanciaHaversineKm(pontoA.lat, pontoA.lng, pontoC.lat, pontoC.lng);
    return ab + bc - ac;
}

/**
 * Dentro de uma rota, o WiBi mistura a cidade-sede (ex: "Camocim",
 * "Barroquinha", "Chaval" -- sempre vai parar lá, é parada obrigatória) com
 * distritos/localidades menores (formato "X (Y)", ex: "Maceió (Camocim)").
 * Confirmado com a Erileila em 2026-10-21: a cidade-sede sempre entra na
 * conta, mas cada distrito pequeno precisa ser avaliado separadamente --
 * alguns são só "passagem" (o caminhão já ia passar perto, desvio quase
 * zero) e outros exigem sair do caminho de verdade (desvio real), e só
 * valem a pena se o valor daquele distrito cobrir o custo do desvio dele,
 * não o mínimo da rota inteira.
 *
 * Pra isso: monta a cadeia Sobral -> (cidades-sede em sequência, pela
 * mesma otimização usada pra montar rota de verdade) -> Sobral, e testa
 * cada distrito em cada trecho dessa cadeia, pegando o trecho de menor
 * desvio (dist(A,distrito)+dist(distrito,B)-dist(A,B)). O custo desse
 * desvio NÃO usa o fator de ida-e-volta -- esse fator é só pra viagem
 * dedicada; o desvio já é o km extra líquido de inserir o ponto no
 * caminho que o caminhão já ia fazer (confirmado com o Rodrigo
 * 2026-10-17, exemplo Miraíma/Amontada/Itapipoca).
 *
 * Se a rota não tiver nenhuma cidade-sede com coordenada (só distritos),
 * não dá pra montar essa cadeia sem inventar -- nesse caso todo mundo
 * entra na conta normal, sem teste de desvio individual.
 */
function avaliarDesviosDaRota(grupoComPonto, origem, config) {
    const ehDistrito = (l) => !!parseLocalidade(l.cidadeNome).parent;
    const sede = grupoComPonto.filter((l) => !ehDistrito(l));
    const distritos = grupoComPonto.filter((l) => ehDistrito(l));

    if (sede.length === 0 || distritos.length === 0) {
        return { incluidos: grupoComPonto, avaliacaoDesvios: [] };
    }

    const sedeOrdenada = otimizarSequencia(
        origem,
        sede.map((l) => ({ ...l, latitude: l.ponto.lat, longitude: l.ponto.lng }))
    );
    const cadeia = [origem, ...sedeOrdenada.map((p) => ({ lat: p.latitude, lng: p.longitude })), origem];

    const avaliacaoDesvios = distritos.map((distrito) => {
        let menorDesvioKm = Infinity;
        for (let i = 0; i < cadeia.length - 1; i++) {
            const desvio = calcularCustoDesvio(cadeia[i], distrito.ponto, cadeia[i + 1]);
            if (desvio < menorDesvioKm) menorDesvioKm = desvio;
        }
        const minimoDesvio = menorDesvioKm * Number(config.custo_km_caminhao) * Number(config.margem_multiplicador);
        return {
            cidadeNome: distrito.cidadeNome,
            uf: distrito.uf,
            valorTotal: Number(distrito.valorTotal.toFixed(2)),
            desvioKm: Number(menorDesvioKm.toFixed(2)),
            minimoDesvio: Number(minimoDesvio.toFixed(2)),
            compensaDesvio: distrito.valorTotal >= minimoDesvio
        };
    });

    const incluidos = [
        ...sede,
        ...distritos.filter((d) => avaliacaoDesvios.find((a) => a.cidadeNome === d.cidadeNome).compensaDesvio)
    ];

    return { incluidos, avaliacaoDesvios };
}

/**
 * Agrupa as vendas de uma carga por cidade/localidade do WiBi, soma o valor
 * de cada grupo e calcula a distância até lá (centróide dos clientes com
 * GPS daquele grupo, a partir da origem da Lassa).
 *
 * O WiBi trata cada distrito/localidade como uma "cidade" separada (ex:
 * "Maceió (Camocim)", "Barroquinha" e "Chaval" aparecem como três cidades
 * diferentes), mas na prática pertencem à mesma rota/viagem da empresa. Por
 * isso, antes de julgar se bateu o mínimo, as localidades que pertencem à
 * mesma rota cadastrada (ver `rotasConhecidasService`) são agrupadas e o
 * valor somado é comparado contra o mínimo daquela rota -- senão toda
 * localidade de uma rota já lucrativa aparece sozinha como "não bate".
 * Localidades sem rota cadastrada continuam sendo avaliadas uma a uma pelo
 * cálculo de distância, como antes.
 *
 * Se nenhum cliente do grupo tiver GPS cadastrado no WiBi, busca o centro
 * da cidade por geocodificação (nome da cidade, não o endereço exato do
 * cliente) como aproximação -- é melhor que não calcular nada, mas fica
 * marcado como `gpsAproximado: true` pra não passar como se fosse exato.
 *
 * Se existir um mínimo REAL cadastrado (folha de rotas da empresa, ver
 * `rotasConhecidasService`), ele tem prioridade sobre o mínimo calculado
 * por distância -- é o valor que a diretoria já negociou de verdade, o
 * cálculo por distância é só uma estimativa genérica de reserva.
 */
async function avaliarPorCidade(vendas, config, origem) {
    const porCidade = new Map();
    for (const venda of vendas) {
        const chave = venda.cidadeId ?? `sem-cidade:${venda.cidadeNome}`;
        if (!porCidade.has(chave)) {
            porCidade.set(chave, { cidadeNome: venda.cidadeNome, uf: venda.uf, vendas: [] });
        }
        porCidade.get(chave).vendas.push(venda);
    }

    const localidades = [];
    for (const grupo of porCidade.values()) {
        const valorTotal = grupo.vendas.reduce((acc, v) => acc + v.valorTotal, 0);
        const comGps = grupo.vendas.filter((v) => v.latitude != null && v.longitude != null);

        let ponto = null;
        let gpsAproximado = false;
        if (comGps.length > 0) {
            ponto = {
                lat: comGps.reduce((acc, v) => acc + v.latitude, 0) / comGps.length,
                lng: comGps.reduce((acc, v) => acc + v.longitude, 0) / comGps.length
            };
        } else {
            ponto = await geocodificarCidade(grupo.cidadeNome, grupo.uf);
            gpsAproximado = !!ponto;
        }

        const distanciaKm = ponto ? distanciaHaversineKm(origem.lat, origem.lng, ponto.lat, ponto.lng) : null;
        const rotaId = await identificarRotaPorNome(grupo.cidadeNome);

        localidades.push({
            cidadeNome: grupo.cidadeNome,
            uf: grupo.uf,
            totalClientes: new Set(grupo.vendas.map((v) => v.clCodigo)).size,
            totalNotas: grupo.vendas.length,
            valorTotal,
            distanciaKm,
            ponto,
            gpsAproximado,
            semGps: !ponto,
            rotaId,
            vendas: grupo.vendas
        });
    }

    const porRota = new Map();
    const semRota = [];
    for (const loc of localidades) {
        if (loc.rotaId != null) {
            if (!porRota.has(loc.rotaId)) porRota.set(loc.rotaId, []);
            porRota.get(loc.rotaId).push(loc);
        } else {
            semRota.push(loc);
        }
    }

    const resultados = [];

    for (const grupo of porRota.values()) {
        const multiplas = grupo.length > 1;

        let incluidos = grupo;
        let avaliacaoDesvios = [];
        if (multiplas) {
            const comPonto = grupo.filter((l) => l.ponto);
            const semPonto = grupo.filter((l) => !l.ponto);
            const resultado = avaliarDesviosDaRota(comPonto, origem, config);
            incluidos = [...resultado.incluidos, ...semPonto];
            avaliacaoDesvios = resultado.avaliacaoDesvios;
        }

        const valorTotal = incluidos.reduce((acc, l) => acc + l.valorTotal, 0);
        const sozinho = incluidos.length === 1;
        const conhecido = await buscarMinimoDoGrupo(grupo[0].rotaId, incluidos.map((l) => l.cidadeNome), { sozinho });
        const minimo = conhecido ? conhecido.minimo : null;
        const diferenca = minimo != null ? valorTotal - minimo : null;
        const atingiuMinimo = diferenca != null ? diferenca >= 0 : null;

        resultados.push({
            cidadeNome: multiplas
                ? (conhecido ? conhecido.rotaNome : grupo.map((l) => l.cidadeNome).join(' + '))
                : grupo[0].cidadeNome,
            uf: grupo[0].uf,
            totalClientes: incluidos.reduce((acc, l) => acc + l.totalClientes, 0),
            totalNotas: incluidos.reduce((acc, l) => acc + l.totalNotas, 0),
            valorTotal: Number(valorTotal.toFixed(2)),
            distanciaKm: !multiplas && grupo[0].distanciaKm != null ? Number(grupo[0].distanciaKm.toFixed(2)) : null,
            minimo: minimo != null ? Number(minimo.toFixed(2)) : null,
            fonteMinimo: conhecido ? conhecido.fonte : null,
            diferenca: diferenca != null ? Number(diferenca.toFixed(2)) : null,
            atingiuMinimo,
            gpsAproximado: incluidos.some((l) => l.gpsAproximado),
            semGps: incluidos.every((l) => l.semGps) && !conhecido,
            localidadesIncluidas: multiplas ? incluidos.map((l) => `${l.cidadeNome}${l.uf ? '/' + l.uf : ''}`) : undefined,
            distritosAvaliados: avaliacaoDesvios.length > 0 ? avaliacaoDesvios : undefined,
            distritosExcluidosPorDesvio: avaliacaoDesvios.filter((d) => !d.compensaDesvio).length > 0
                ? avaliacaoDesvios.filter((d) => !d.compensaDesvio)
                : undefined,
            vendas: incluidos.flatMap((l) => l.vendas)
        });

        // Distritos cujo valor não cobre o desvio continuam aparecendo, só
        // que como item separado -- a venda existe, só não compensa ir
        // nessa carga; melhor mostrar isolado do que sumir da tela.
        const nomesIncluidos = new Set(incluidos.map((l) => l.cidadeNome));
        for (const distrito of grupo.filter((l) => l.ponto && !nomesIncluidos.has(l.cidadeNome))) {
            const avaliacao = avaliacaoDesvios.find((a) => a.cidadeNome === distrito.cidadeNome);
            resultados.push({
                cidadeNome: distrito.cidadeNome,
                uf: distrito.uf,
                totalClientes: distrito.totalClientes,
                totalNotas: distrito.totalNotas,
                valorTotal: Number(distrito.valorTotal.toFixed(2)),
                distanciaKm: null,
                minimo: avaliacao.minimoDesvio,
                fonteMinimo: `desvio pra entrar nessa rota (${avaliacao.desvioKm} km) -- não compensa sozinho, não precisa do mínimo da rota inteira`,
                diferenca: Number((distrito.valorTotal - avaliacao.minimoDesvio).toFixed(2)),
                atingiuMinimo: false,
                gpsAproximado: distrito.gpsAproximado,
                semGps: false,
                vendas: distrito.vendas
            });
        }
    }

    for (const loc of semRota) {
        const minimo = loc.distanciaKm != null ? calcularMinimo(loc.distanciaKm, config) : null;
        const diferenca = minimo != null ? loc.valorTotal - minimo : null;
        const atingiuMinimo = diferenca != null ? diferenca >= 0 : null;

        resultados.push({
            cidadeNome: loc.cidadeNome,
            uf: loc.uf,
            totalClientes: loc.totalClientes,
            totalNotas: loc.totalNotas,
            valorTotal: Number(loc.valorTotal.toFixed(2)),
            distanciaKm: loc.distanciaKm != null ? Number(loc.distanciaKm.toFixed(2)) : null,
            minimo: minimo != null ? Number(minimo.toFixed(2)) : null,
            fonteMinimo: minimo != null ? 'calculado por distância' : null,
            diferenca: diferenca != null ? Number(diferenca.toFixed(2)) : null,
            atingiuMinimo,
            gpsAproximado: loc.gpsAproximado,
            semGps: loc.semGps,
            vendas: loc.vendas
        });
    }

    return resultados.sort((a, b) => (a.atingiuMinimo === b.atingiuMinimo ? 0 : a.atingiuMinimo ? 1 : -1));
}

module.exports = {
    obterConfigCusto,
    atualizarConfigCusto,
    calcularMinimo,
    calcularCustoDesvio,
    avaliarPorCidade
};
