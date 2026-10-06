// Agrupa as paradas (uma por nota/venda) de uma carga por cliente
// (wibi_cl_codigo) — quando o mesmo cliente tem mais de uma nota na carga,
// o motorista chega/sai fisicamente uma vez só, então o app trata esse
// conjunto como um bloco único (uma linha na lista, um conjunto de botões
// de status que afeta todas as notas de uma vez).

// pior-caso primeiro: se qualquer nota do cliente estiver com problema, o
// bloco inteiro aparece como problema; senão, mostra o estágio mais atrasado.
const ORDEM_STATUS = { problema: 0, pendente: 1, chegada: 2, inicio: 3, fim: 4 };

export function agruparParadasPorCliente(paradas) {
    const grupos = [];
    const indicePorCliente = new Map();

    for (const p of paradas) {
        if (indicePorCliente.has(p.wibi_cl_codigo)) {
            grupos[indicePorCliente.get(p.wibi_cl_codigo)].paradas.push(p);
        } else {
            indicePorCliente.set(p.wibi_cl_codigo, grupos.length);
            grupos.push({ clCodigo: p.wibi_cl_codigo, paradas: [p] });
        }
    }

    return grupos.map((g) => ({
        ...g,
        sequencia: Math.min(...g.paradas.map((p) => p.sequencia)),
        status: statusDoGrupo(g.paradas)
    }));
}

export function statusDoGrupo(paradasDoGrupo) {
    if (paradasDoGrupo.some((p) => p.status === 'problema')) return 'problema';
    return paradasDoGrupo.reduce(
        (pior, p) => (ORDEM_STATUS[p.status] < ORDEM_STATUS[pior] ? p.status : pior),
        paradasDoGrupo[0].status
    );
}
