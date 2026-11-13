import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LogoLassa from '../../components/LogoLassa';

function dataIsoDiasAtras(dias) {
    return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatarDataHora(v) {
    return v ? new Date(v).toLocaleString('pt-BR') : '—';
}

export default function Indicadores() {
    const [inicio, setInicio] = useState(() => dataIsoDiasAtras(7));
    const [fim, setFim] = useState(() => new Date().toISOString().slice(0, 10));
    const [linhas, setLinhas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    async function carregar() {
        setCarregando(true);
        setErro('');
        try {
            const dados = await api.indicadores(inicio, fim);
            setLinhas(dados);
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inicio, fim]);

    return (
        <div className="min-h-screen bg-lassa-branco">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <LogoLassa className="h-9" />
                        <span className="text-gray-300">|</span>
                        <h1 className="text-lg font-semibold text-gray-700">Indicadores de Entrega</h1>
                    </div>
                    <Link to="/dashboard" className="text-lassa-azul text-sm">← Voltar</Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-6 space-y-4">
                <p className="text-sm text-gray-500">
                    Base pra reunião semanal de acompanhamento (pedido da Zuleika em 2026-11-11): rota, motorista, programado × real de saída/chegada, pedidos, ocorrências e não entregues.
                </p>

                <div className="bg-white rounded-xl shadow-sm p-4 flex items-end gap-4 flex-wrap">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">De</label>
                        <input
                            type="date"
                            value={inicio}
                            onChange={(e) => setInicio(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Até</label>
                        <input
                            type="date"
                            value={fim}
                            onChange={(e) => setFim(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <a
                        href={api.exportarIndicadoresUrl(inicio, fim)}
                        className="bg-green-600 hover:bg-green-700 transition-colors text-white rounded-lg px-4 py-2 text-sm"
                    >
                        Exportar CSV
                    </a>
                </div>

                {erro && <p className="text-lassa-vermelho text-sm">{erro}</p>}
                {carregando && <p className="text-sm text-gray-500">Carregando...</p>}

                {!carregando && linhas.length === 0 && (
                    <p className="text-gray-400 text-center py-10">Nenhuma carga nesse período.</p>
                )}

                <div className="space-y-3">
                    {linhas.map((l) => (
                        <div key={l.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                            <div className="flex items-start justify-between flex-wrap gap-3">
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        Carga #{l.wibi_ca_id}
                                        <span className="ml-2 text-sm text-gray-400 font-normal">
                                            {l.data_entrega ? new Date(l.data_entrega).toLocaleDateString('pt-BR') : ''}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {l.cidades?.length > 0 ? l.cidades.join(', ') : 'rota sem cidades identificadas'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {l.motorista_nome || 'sem motorista'} · Veículo {l.veiculo_placa || '—'}
                                    </p>
                                </div>
                                <div className="flex gap-4 text-sm">
                                    <div className="text-center">
                                        <p className="font-semibold text-gray-800">{l.total_notas}</p>
                                        <p className="text-gray-400 text-xs">pedidos</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`font-semibold ${Number(l.total_ocorrencias) > 0 ? 'text-lassa-vermelho' : 'text-gray-800'}`}>
                                            {l.total_ocorrencias}
                                        </p>
                                        <p className="text-gray-400 text-xs">ocorrências</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`font-semibold ${Number(l.total_nao_entregues) > 0 ? 'text-lassa-vermelho' : 'text-gray-800'}`}>
                                            {l.total_nao_entregues}
                                        </p>
                                        <p className="text-gray-400 text-xs">não entregues</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 border-t pt-2">
                                <p>Saída programada: <span className="text-gray-800">{formatarDataHora(l.programado_saida_em)}</span></p>
                                <p>Saída real: <span className="text-gray-800">{formatarDataHora(l.saida_em)}</span>{l.saida_hodometro_km && ` (${l.saida_hodometro_km} km)`}</p>
                                <p>Chegada programada: <span className="text-gray-800">{formatarDataHora(l.programado_chegada_em)}</span></p>
                                <p>Retorno real: <span className="text-gray-800">{formatarDataHora(l.retorno_em)}</span></p>
                            </div>

                            {l.ocorrencias?.length > 0 && (
                                <p className="text-sm text-lassa-vermelho">Ocorrências: {l.ocorrencias.join(' · ')}</p>
                            )}
                            {l.motivos_nao_entregues?.length > 0 && (
                                <p className="text-sm text-gray-700">Não entregues: {l.motivos_nao_entregues.join(' · ')}</p>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
