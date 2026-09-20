import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';

const STATUS_COR = {
    pendente: 'bg-gray-200 text-gray-700',
    chegada: 'bg-yellow-100 text-yellow-800',
    inicio: 'bg-blue-100 text-blue-800',
    fim: 'bg-green-100 text-green-800',
    problema: 'bg-red-100 text-red-800'
};

export default function DashboardRotaDetalhe() {
    const { id } = useParams();
    const [rota, setRota] = useState(null);

    useEffect(() => {
        api.dashboardRotaDetalhe(id).then(setRota);
    }, [id]);

    if (!rota) return <p className="p-6 text-center text-gray-500">Carregando...</p>;

    return (
        <div className="min-h-screen p-6 space-y-4">
            <Link to="/dashboard" className="text-blue-700 text-sm">← Voltar</Link>

            <div className="bg-white rounded-xl shadow-sm p-4">
                <h1 className="text-xl font-bold">Carga #{rota.wibi_ca_id}</h1>
                <p className="text-gray-600">Motorista: {rota.motorista_nome || '—'} · Veículo: {rota.veiculo_placa || '—'}</p>
                <p className="text-gray-600">Status: {rota.status}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm divide-y">
                {rota.paradas.map((p) => (
                    <div key={p.id} className="p-4 flex items-center justify-between">
                        <div>
                            <p className="font-semibold">{p.sequencia}. {p.cliente_nome || `Venda ${p.wibi_vd_codigo}`}</p>
                            <p className="text-sm text-gray-500">{p.cliente_endereco}</p>
                            {p.problema_descricao && (
                                <p className="text-sm text-red-600">Problema: {p.problema_descricao}</p>
                            )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COR[p.status]}`}>{p.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
