import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

export default function MontarRota() {
    const [numeroCarga, setNumeroCarga] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const [rota, setRota] = useState(null);

    async function handleMontar(e) {
        e.preventDefault();
        setErro('');
        setCarregando(true);
        setRota(null);
        try {
            const { id } = await api.montarRota(parseInt(numeroCarga, 10));
            const detalhe = await api.dashboardRotaDetalhe(id);
            setRota(detalhe);
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    }

    const paradasSemGps = rota?.paradas.filter((p) => p.latitude == null || p.longitude == null).length || 0;

    return (
        <div className="min-h-screen p-6 space-y-4">
            <Link to="/dashboard" className="text-blue-700 text-sm">← Voltar</Link>
            <h1 className="text-2xl font-bold text-blue-700">Montar Rota</h1>
            <p className="text-sm text-gray-500">
                Digita o número da carga, a rota já vem otimizada e salva — o motorista só precisa
                digitar o mesmo número no app dele pra assumir essa rota pronta.
            </p>

            <form onSubmit={handleMontar} className="bg-white rounded-xl shadow-sm p-4 flex gap-3 items-end">
                <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">Número da carga</label>
                    <input
                        className="w-full border rounded-lg px-3 py-2"
                        value={numeroCarga}
                        onChange={(e) => setNumeroCarga(e.target.value)}
                        inputMode="numeric"
                        autoFocus
                    />
                </div>
                <button
                    type="submit"
                    disabled={carregando || !numeroCarga}
                    className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
                >
                    {carregando ? 'Montando...' : 'Montar rota'}
                </button>
            </form>

            {erro && <p className="text-red-600 text-sm">{erro}</p>}

            {rota && (
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                            <p className="font-semibold">Carga #{rota.wibi_ca_id} — {rota.paradas.length} paradas</p>
                            <p className="text-sm text-gray-500">Veículo: {rota.veiculo_placa || '—'}</p>
                            {rota.distancia_total_km && (
                                <p className="text-sm text-gray-500">
                                    ~{Number(rota.distancia_total_km).toFixed(0)} km (ida e volta, estimado)
                                </p>
                            )}
                            {paradasSemGps > 0 && (
                                <p className="text-sm text-yellow-700">
                                    {paradasSemGps} parada(s) sem GPS confiável — ordenadas por CEP, não pela rota real.
                                </p>
                            )}
                        </div>
                        <a
                            href={api.exportarRotaUrl(rota.id)}
                            className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm h-fit"
                        >
                            Exportar CSV
                        </a>
                    </div>

                    <div className="divide-y">
                        {rota.paradas.map((p) => (
                            <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">{p.sequencia}. {p.cliente_nome || `Venda ${p.wibi_vd_codigo}`}</p>
                                    <p className="text-sm text-gray-500">{p.cliente_endereco || 'Endereço não disponível'}</p>
                                </div>
                                {(p.latitude == null || p.longitude == null) && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full whitespace-nowrap">
                                        sem GPS
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
