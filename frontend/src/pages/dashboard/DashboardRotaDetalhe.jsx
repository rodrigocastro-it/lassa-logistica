import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import MapaVeiculo from '../../components/MapaVeiculo';

const STATUS_COR = {
    pendente: 'bg-gray-200 text-gray-700',
    chegada: 'bg-yellow-100 text-yellow-800',
    inicio: 'bg-blue-100 text-blue-800',
    fim: 'bg-green-100 text-green-800',
    problema: 'bg-red-100 text-red-800'
};

function distanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DashboardRotaDetalhe() {
    const { id } = useParams();
    const [rota, setRota] = useState(null);
    const [posicao, setPosicao] = useState(null);

    useEffect(() => {
        api.dashboardRotaDetalhe(id).then(setRota);
    }, [id]);

    useEffect(() => {
        function buscarPosicao() {
            api.dashboardRotaPosicao(id).then(setPosicao).catch(() => setPosicao(null));
        }
        buscarPosicao();
        const intervalo = setInterval(buscarPosicao, 30000);
        return () => clearInterval(intervalo);
    }, [id]);

    if (!rota) return <p className="p-6 text-center text-gray-500">Carregando...</p>;

    return (
        <div className="min-h-screen p-6 space-y-4">
            <div className="flex items-center justify-between">
                <Link to="/dashboard" className="text-blue-700 text-sm">← Voltar</Link>
                <a href={api.exportarRotaUrl(rota.id)} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm">
                    Exportar CSV (com GPS de chegada)
                </a>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
                <h1 className="text-xl font-bold">Carga #{rota.wibi_ca_id}</h1>
                <p className="text-gray-600">Motorista: {rota.motorista_nome || '—'} · Veículo: {rota.veiculo_placa || '—'}</p>
                <p className="text-gray-600">Status: {rota.status}</p>
                {rota.distancia_total_km && (
                    <p className="text-gray-600">~{Number(rota.distancia_total_km).toFixed(0)} km (ida e volta, estimado)</p>
                )}
            </div>

            {posicao && (
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                    <MapaVeiculo latitude={posicao.latitude} longitude={posicao.longitude} popup={rota.veiculo_placa} />
                    <p className="text-sm text-gray-600">
                        {posicao.velocidadeKmh ?? '—'} km/h · atualizado em {posicao.atualizadoEm || '—'}
                    </p>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm divide-y">
                {rota.paradas.map((p) => {
                    const temGpsChegada = p.chegada_lat != null && p.chegada_lng != null;
                    const temGpsCadastro = p.latitude != null && p.longitude != null;
                    const diffKm = temGpsChegada && temGpsCadastro
                        ? distanciaKm(Number(p.latitude), Number(p.longitude), Number(p.chegada_lat), Number(p.chegada_lng))
                        : null;

                    return (
                        <div key={p.id} className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">{p.sequencia}. {p.cliente_nome || `Venda ${p.wibi_vd_codigo}`}</p>
                                    <p className="text-sm text-gray-500">{p.cliente_endereco}</p>
                                    {p.problema_descricao && (
                                        <p className="text-sm text-red-600">Problema: {p.problema_descricao}</p>
                                    )}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COR[p.status]}`}>{p.status}</span>
                            </div>

                            {temGpsChegada && (
                                <div className="text-xs bg-gray-50 rounded-lg p-2 space-y-1">
                                    <p className="text-gray-500">
                                        GPS cadastro: {temGpsCadastro ? `${p.latitude}, ${p.longitude}` : 'sem GPS cadastrado'}
                                    </p>
                                    <p className="text-gray-500">
                                        GPS na chegada (Point Track): {p.chegada_lat}, {p.chegada_lng}
                                    </p>
                                    {diffKm != null && (
                                        <p className={diffKm > 0.5 ? 'text-red-600 font-medium' : 'text-green-700'}>
                                            Diferença: {diffKm.toFixed(2)} km
                                            {diffKm > 0.5 && ' — endereço cadastrado pode estar errado'}
                                        </p>
                                    )}
                                    <a
                                        className="text-blue-600 underline"
                                        target="_blank"
                                        rel="noreferrer"
                                        href={`https://www.google.com/maps?q=${p.chegada_lat},${p.chegada_lng}`}
                                    >
                                        Ver no Google Maps
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
