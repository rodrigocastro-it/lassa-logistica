import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LogoLassa from '../../components/LogoLassa';

function corStatus(rota) {
    if (Number(rota.paradas_com_problema) > 0) return 'border-lassa-vermelho';
    if (Number(rota.paradas_concluidas) === Number(rota.total_paradas) && Number(rota.total_paradas) > 0) {
        return 'border-green-500';
    }
    return 'border-yellow-500';
}

export default function DashboardRotas() {
    const [rotas, setRotas] = useState([]);
    const [emEntrega, setEmEntrega] = useState([]);
    const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => {
        api.dashboardRotas(data).then(setRotas);
        api.cargasWibiEmEntrega(data).then(setEmEntrega);
    }, [data]);

    return (
        <div className="min-h-screen bg-lassa-branco">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <LogoLassa className="h-9" />
                        <span className="text-gray-300">|</span>
                        <h1 className="text-lg font-semibold text-gray-700">Dashboard de Rotas</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="date"
                            value={data}
                            onChange={(e) => setData(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                        />
                        <Link
                            to="/dashboard/planejamento"
                            className="text-lassa-azul hover:underline text-sm font-medium"
                        >
                            Planejamento de carga
                        </Link>
                        <Link
                            to="/dashboard/montar"
                            className="bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-lg px-4 py-2 text-sm font-medium"
                        >
                            + Montar rota
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
                <section className="bg-white rounded-xl shadow-sm">
                    <div className="px-5 py-3 border-b">
                        <p className="font-semibold text-sm text-gray-700">Cargas em entrega hoje</p>
                        <p className="text-xs text-gray-400">Direto do WiBi, independente do nosso sistema</p>
                    </div>
                    <div className="divide-y">
                        {emEntrega.length === 0 && (
                            <p className="text-sm text-gray-400 px-5 py-4">Nenhuma carga em entrega nessa data.</p>
                        )}
                        {emEntrega.map((c) => (
                            <div key={c.caId} className="px-5 py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium text-gray-800">
                                        Carga #{c.caId}
                                        <span className="text-sm text-gray-400 font-normal"> · {c.totalNotas} nota(s)</span>
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {c.motoristaNome || 'motorista ainda não assumiu no sistema'}
                                        {c.veiculo && ` · Veículo ${c.veiculo.placa}`}
                                    </p>
                                </div>
                                {c.localId && (
                                    <Link
                                        to={`/dashboard/rotas/${c.localId}`}
                                        className="bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap"
                                    >
                                        Ver detalhe
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    {rotas.map((rota) => (
                        <Link
                            key={rota.id}
                            to={`/dashboard/rotas/${rota.id}`}
                            className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 border-l-4 flex items-center justify-between ${corStatus(rota)}`}
                        >
                            <div>
                                <p className="font-semibold text-gray-800">
                                    Carga #{rota.wibi_ca_id} <span className="font-normal text-gray-400">—</span> {rota.motorista_nome || 'sem motorista'}
                                </p>
                                <p className="text-sm text-gray-500">Veículo {rota.veiculo_placa || '—'} · {rota.status}</p>
                            </div>
                            <div className="text-right text-sm">
                                <p className="text-gray-600">{rota.paradas_concluidas}/{rota.total_paradas} paradas</p>
                                {Number(rota.paradas_com_problema) > 0 && (
                                    <p className="text-lassa-vermelho font-medium">{rota.paradas_com_problema} com problema</p>
                                )}
                            </div>
                        </Link>
                    ))}
                    {rotas.length === 0 && (
                        <p className="text-gray-400 text-center py-10">Nenhuma rota para essa data.</p>
                    )}
                </section>
            </main>
        </div>
    );
}
