import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

function corStatus(rota) {
    if (Number(rota.paradas_com_problema) > 0) return 'border-red-500';
    if (Number(rota.paradas_concluidas) === Number(rota.total_paradas) && Number(rota.total_paradas) > 0) {
        return 'border-green-500';
    }
    return 'border-yellow-500';
}

export default function DashboardRotas() {
    const [rotas, setRotas] = useState([]);
    const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => {
        api.dashboardRotas(data).then(setRotas);
    }, [data]);

    return (
        <div className="min-h-screen p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-blue-700">Dashboard de Rotas</h1>
                <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="border rounded-lg px-3 py-2"
                />
            </div>

            <div className="grid gap-3">
                {rotas.map((rota) => (
                    <Link
                        key={rota.id}
                        to={`/dashboard/rotas/${rota.id}`}
                        className={`bg-white rounded-xl shadow-sm p-4 border-l-4 flex items-center justify-between ${corStatus(rota)}`}
                    >
                        <div>
                            <p className="font-semibold">Carga #{rota.wibi_ca_id} — {rota.motorista_nome || 'sem motorista'}</p>
                            <p className="text-sm text-gray-500">Veículo {rota.veiculo_placa || '—'} · {rota.status}</p>
                        </div>
                        <div className="text-right text-sm">
                            <p>{rota.paradas_concluidas}/{rota.total_paradas} paradas</p>
                            {Number(rota.paradas_com_problema) > 0 && (
                                <p className="text-red-600 font-medium">{rota.paradas_com_problema} com problema</p>
                            )}
                        </div>
                    </Link>
                ))}
                {rotas.length === 0 && (
                    <p className="text-gray-500 text-center py-10">Nenhuma rota para essa data.</p>
                )}
            </div>
        </div>
    );
}
