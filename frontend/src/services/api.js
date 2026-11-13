const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8788/api';

async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
        const token = localStorage.getItem('lassa_token');
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.erro || `Erro ${res.status}`);
    }
    return data;
}

export const api = {
    login: (usuario, senha) => request('/auth/login', { method: 'POST', body: { usuario, senha }, auth: false }),
    consultarCargaWibi: (caId) => request(`/cargas/wibi/${caId}`),
    carregarCarga: (caId) => request('/cargas/carregar', { method: 'POST', body: { caId } }),
    minhasCargas: () => request('/cargas'),
    obterCarga: (id) => request(`/cargas/${id}`),
    finalizarCarga: (id) => request(`/cargas/${id}/finalizar`, { method: 'PATCH' }),
    registrarSaida: (id, hodometroKm) => request(`/cargas/${id}/saida`, { method: 'PATCH', body: { hodometroKm } }),
    atualizarStatusParada: (id, status, problemaDescricao, naoEntregueMotivo) =>
        request(`/paradas/${id}/status`, { method: 'PATCH', body: { status, problemaDescricao, naoEntregueMotivo } }),
    atualizarStatusGrupo: (paradaIds, status, problemaDescricao, naoEntregueMotivo) =>
        request('/paradas/grupo/status', { method: 'PATCH', body: { paradaIds, status, problemaDescricao, naoEntregueMotivo } }),
    listarParadasManuais: (cargaId) => request(`/paradas/manuais/carga/${cargaId}`),
    criarParadaManual: (cargaId, tipo, observacao) =>
        request('/paradas/manuais', { method: 'POST', body: { cargaId, tipo, observacao } }),
    encerrarParadaManual: (id) => request(`/paradas/manuais/${id}/encerrar`, { method: 'PATCH' }),
    dashboardRotas: (data) => request(`/dashboard/rotas${data ? `?data=${data}` : ''}`),
    dashboardRotaDetalhe: (id) => request(`/dashboard/rotas/${id}`),
    dashboardRotaPosicao: (id) => request(`/dashboard/rotas/${id}/posicao`),
    posicaoVeiculo: (placa) => request(`/pointtrack/posicao/${placa}`),
    montarRota: (caId) => request('/dashboard/rotas/montar', { method: 'POST', body: { caId }, auth: false }),
    cargasWibiAbertas: (data) => request(`/dashboard/cargas-wibi${data ? `?data=${data}` : ''}`, { auth: false }),
    cargasWibiEmEntrega: (data) => request(`/dashboard/cargas-em-entrega${data ? `?data=${data}` : ''}`, { auth: false }),
    exportarRotaUrl: (id) => `${API_BASE_URL}/dashboard/rotas/${id}/exportar`,
    listarMotoristas: () => request('/dashboard/motoristas', { auth: false }),
    reatribuirMotorista: (id, motoristaId) =>
        request(`/dashboard/rotas/${id}/motorista`, { method: 'PATCH', body: { motoristaId }, auth: false }),
    sincronizarVeiculo: (id) =>
        request(`/dashboard/rotas/${id}/sincronizar-veiculo`, { method: 'PATCH', auth: false }),
    definirProgramado: (id, programadoSaidaEm, programadoChegadaEm) =>
        request(`/dashboard/rotas/${id}/programado`, { method: 'PATCH', body: { programadoSaidaEm, programadoChegadaEm }, auth: false }),
    indicadores: (inicio, fim) =>
        request(`/dashboard/indicadores?inicio=${inicio}&fim=${fim}`, { auth: false }),
    exportarIndicadoresUrl: (inicio, fim) => `${API_BASE_URL}/dashboard/indicadores/exportar?inicio=${inicio}&fim=${fim}`,
    marcarNaoEntregueTorre: (paradaId, motivo) =>
        request(`/dashboard/paradas/${paradaId}/nao-entregue`, { method: 'PATCH', body: { motivo }, auth: false }),
    devolucoes: (inicio, fim) =>
        request(`/dashboard/devolucoes?inicio=${inicio}&fim=${fim}`, { auth: false }),
    exportarDevolucoesUrl: (inicio, fim) => `${API_BASE_URL}/dashboard/devolucoes/exportar?inicio=${inicio}&fim=${fim}`,
    obterConfigCusto: () => request('/planejamento/config-custo', { auth: false }),
    atualizarConfigCusto: (config) =>
        request('/planejamento/config-custo', { method: 'PUT', body: config, auth: false }),
    calcularMinimo: (dados) =>
        request('/planejamento/calcular-minimo', { method: 'POST', body: dados, auth: false }),
    calcularDesvio: (dados) =>
        request('/planejamento/calcular-desvio', { method: 'POST', body: dados, auth: false }),
    listarRegioes: () => request('/planejamento/regioes', { auth: false }),
    criarRegiao: (nomeRegiao, diaSemana) =>
        request('/planejamento/regioes', { method: 'POST', body: { nomeRegiao, diaSemana }, auth: false }),
    atualizarRegiao: (id, dados) =>
        request(`/planejamento/regioes/${id}`, { method: 'PATCH', body: dados, auth: false }),
    removerRegiao: (id) =>
        request(`/planejamento/regioes/${id}`, { method: 'DELETE', auth: false }),
    avaliarCarga: (caId) => request(`/planejamento/avaliar-carga/${caId}`, { auth: false }),
    listarRotasConhecidas: () => request('/planejamento/rotas-conhecidas', { auth: false })
};
