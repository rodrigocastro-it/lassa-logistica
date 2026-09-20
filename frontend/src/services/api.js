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
    atualizarStatusParada: (id, status, problemaDescricao) =>
        request(`/paradas/${id}/status`, { method: 'PATCH', body: { status, problemaDescricao } }),
    listarParadasManuais: (cargaId) => request(`/paradas/manuais/carga/${cargaId}`),
    criarParadaManual: (cargaId, tipo, observacao) =>
        request('/paradas/manuais', { method: 'POST', body: { cargaId, tipo, observacao } }),
    encerrarParadaManual: (id) => request(`/paradas/manuais/${id}/encerrar`, { method: 'PATCH' }),
    dashboardRotas: (data) => request(`/dashboard/rotas${data ? `?data=${data}` : ''}`),
    dashboardRotaDetalhe: (id) => request(`/dashboard/rotas/${id}`),
    dashboardRotaPosicao: (id) => request(`/dashboard/rotas/${id}/posicao`),
    posicaoVeiculo: (placa) => request(`/pointtrack/posicao/${placa}`)
};
