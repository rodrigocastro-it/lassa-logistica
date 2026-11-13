import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import MapaVeiculo from '../../components/MapaVeiculo';

const STATUS_COR = {
    pendente: 'bg-gray-200 text-gray-700',
    chegada: 'bg-yellow-100 text-yellow-800',
    inicio: 'bg-lassa-leve/20 text-lassa-profundo',
    fim: 'bg-green-100 text-green-800',
    problema: 'bg-lassa-vermelho/10 text-lassa-vermelho',
    nao_entregue: 'bg-gray-700/10 text-gray-700'
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
    const [motoristas, setMotoristas] = useState([]);
    const [reatribuindo, setReatribuindo] = useState(false);
    const [sincronizando, setSincronizando] = useState(false);
    const [programadoSaida, setProgramadoSaida] = useState('');
    const [programadoChegada, setProgramadoChegada] = useState('');
    const [salvandoProgramado, setSalvandoProgramado] = useState(false);
    const [marcandoNaoEntregueId, setMarcandoNaoEntregueId] = useState(null);

    function paraInputDatetime(v) {
        if (!v) return '';
        const d = new Date(v);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    useEffect(() => {
        api.dashboardRotaDetalhe(id).then((detalhe) => {
            setRota(detalhe);
            setProgramadoSaida(paraInputDatetime(detalhe.programado_saida_em));
            setProgramadoChegada(paraInputDatetime(detalhe.programado_chegada_em));
        });
        api.listarMotoristas().then(setMotoristas).catch(() => {});
    }, [id]);

    async function handleSalvarProgramado(e) {
        e.preventDefault();
        setSalvandoProgramado(true);
        try {
            await api.definirProgramado(
                id,
                programadoSaida ? new Date(programadoSaida).toISOString() : null,
                programadoChegada ? new Date(programadoChegada).toISOString() : null
            );
            const detalhe = await api.dashboardRotaDetalhe(id);
            setRota(detalhe);
        } catch (err) {
            alert(err.message);
        } finally {
            setSalvandoProgramado(false);
        }
    }

    async function handleReatribuir(e) {
        const motoristaId = e.target.value || null;
        setReatribuindo(true);
        try {
            await api.reatribuirMotorista(id, motoristaId);
            const detalhe = await api.dashboardRotaDetalhe(id);
            setRota(detalhe);
        } finally {
            setReatribuindo(false);
        }
    }

    async function handleMarcarNaoEntregue(paradaId) {
        const motivo = window.prompt('Por que não foi entregue? (ex: cliente recusou, estabelecimento fechado...)');
        if (!motivo) return;
        setMarcandoNaoEntregueId(paradaId);
        try {
            await api.marcarNaoEntregueTorre(paradaId, motivo);
            const detalhe = await api.dashboardRotaDetalhe(id);
            setRota(detalhe);
        } catch (err) {
            alert(err.message);
        } finally {
            setMarcandoNaoEntregueId(null);
        }
    }

    async function handleSincronizarVeiculo() {
        setSincronizando(true);
        try {
            await api.sincronizarVeiculo(id);
            const detalhe = await api.dashboardRotaDetalhe(id);
            setRota(detalhe);
        } catch (err) {
            alert(err.message);
        } finally {
            setSincronizando(false);
        }
    }

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
        <div className="min-h-screen p-6 space-y-4 bg-lassa-branco">
            <div className="flex items-center justify-between">
                <Link to="/dashboard" className="text-lassa-azul text-sm">← Voltar</Link>
                <a href={api.exportarRotaUrl(rota.id)} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm">
                    Exportar CSV (com GPS de chegada)
                </a>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <h1 className="text-xl font-bold">Carga #{rota.wibi_ca_id}</h1>
                <div className="flex items-center gap-2">
                    <p className="text-gray-600">Veículo: {rota.veiculo_placa || '—'}</p>
                    <button
                        onClick={handleSincronizarVeiculo}
                        disabled={sincronizando}
                        className="text-xs text-lassa-azul underline disabled:opacity-50"
                        title="Busca o veículo atualizado direto do WiBi"
                    >
                        {sincronizando ? 'sincronizando...' : 'sincronizar com o WiBi'}
                    </button>
                </div>
                <p className="text-gray-600">Status: {rota.status}</p>
                {rota.distancia_total_km && (
                    <p className="text-gray-600">~{Number(rota.distancia_total_km).toFixed(0)} km (ida e volta, estimado)</p>
                )}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Motorista:</label>
                    <select
                        value={rota.motorista_id || ''}
                        onChange={handleReatribuir}
                        disabled={reatribuindo}
                        className="border rounded-lg px-2 py-1 text-sm"
                    >
                        <option value="">— sem motorista —</option>
                        {motoristas.map((m) => (
                            <option key={m.id} value={m.id}>{m.nome} ({m.usuario})</option>
                        ))}
                    </select>
                </div>
            </div>

            <form onSubmit={handleSalvarProgramado} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Programado × real (reunião semanal)</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Saída programada</label>
                        <input
                            type="datetime-local"
                            value={programadoSaida}
                            onChange={(e) => setProgramadoSaida(e.target.value)}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Chegada programada</label>
                        <input
                            type="datetime-local"
                            value={programadoChegada}
                            onChange={(e) => setProgramadoChegada(e.target.value)}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={salvandoProgramado}
                    className="bg-lassa-azul text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                    {salvandoProgramado ? 'Salvando...' : 'Salvar programado'}
                </button>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 border-t pt-3">
                    <p>Saída real: <span className="text-gray-800">
                        {rota.saida_em ? new Date(rota.saida_em).toLocaleString('pt-BR') : '—'}
                        {rota.saida_hodometro_km && ` (${rota.saida_hodometro_km} km)`}
                    </span></p>
                    <p>Retorno real: <span className="text-gray-800">
                        {rota.retorno_em ? new Date(rota.retorno_em).toLocaleString('pt-BR') : '—'}
                    </span></p>
                </div>
            </form>

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
                                        <p className="text-sm text-lassa-vermelho">Problema: {p.problema_descricao}</p>
                                    )}
                                    {p.nao_entregue_motivo && (
                                        <p className="text-sm text-gray-700">Não entregue: {p.nao_entregue_motivo}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COR[p.status]}`}>{p.status}</span>
                                    {p.status !== 'nao_entregue' && (
                                        <button
                                            onClick={() => handleMarcarNaoEntregue(p.id)}
                                            disabled={marcandoNaoEntregueId === p.id}
                                            className="text-xs text-gray-500 underline whitespace-nowrap disabled:opacity-50"
                                            title="Reforço da Nina pra quando o motorista esquecer de marcar no app — a obrigação continua sendo dele"
                                        >
                                            {marcandoNaoEntregueId === p.id ? 'marcando...' : 'marcar não entregue'}
                                        </button>
                                    )}
                                </div>
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
                                        <p className={diffKm > 0.5 ? 'text-lassa-vermelho font-medium' : 'text-green-700'}>
                                            Diferença: {diffKm.toFixed(2)} km
                                            {diffKm > 0.5 && ' — endereço cadastrado pode estar errado'}
                                        </p>
                                    )}
                                    <a
                                        className="text-lassa-azul underline"
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
