import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCargaAtual } from '../../context/CargaAtualContext';
import { agruparParadasPorCliente } from '../../utils/agruparParadas';
import MenuMotorista from './MenuMotorista';
import LogoLassa from '../../components/LogoLassa';

const STATUS_COR = {
    pendente: 'bg-gray-200 text-gray-700',
    chegada: 'bg-yellow-100 text-yellow-800',
    inicio: 'bg-lassa-leve/20 text-lassa-profundo',
    fim: 'bg-green-100 text-green-800',
    problema: 'bg-lassa-vermelho/10 text-lassa-vermelho'
};

export default function RotaDoDia() {
    const [carga, setCarga] = useState(null);
    const [numeroCarga, setNumeroCarga] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const { logout } = useAuth();
    const { cargaAtualId, setCargaAtualId } = useCargaAtual();
    const navigate = useNavigate();

    useEffect(() => {
        if (cargaAtualId) {
            carregarDetalhe(cargaAtualId).catch(() => setCargaAtualId(null));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function carregarDetalhe(id) {
        const detalhe = await api.obterCarga(id);
        setCarga(detalhe);
        setCargaAtualId(detalhe.id);
    }

    async function handleFinalizar() {
        if (!window.confirm('Finalizar essa rota? Você vai poder carregar outra carga em seguida.')) return;
        try {
            await api.finalizarCarga(carga.id);
        } catch (err) {
            // Mesmo se o servidor recusar (ex.: carga não é mais sua), nunca
            // trava a tela — sai da carga localmente de qualquer jeito.
            console.error('Erro ao finalizar:', err);
        }
        setCarga(null);
        setCargaAtualId(null);
    }

    async function handleBuscarCarga(e) {
        e.preventDefault();
        setErro('');
        setCarregando(true);
        try {
            const { id } = await api.carregarCarga(parseInt(numeroCarga, 10));
            await carregarDetalhe(id);
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    }

    if (!carga) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-lassa-leve/10 to-lassa-branco">
                <form onSubmit={handleBuscarCarga} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-5">
                    <div className="flex justify-center">
                        <LogoLassa className="h-12" />
                    </div>
                    <h1 className="text-base font-semibold text-gray-700 text-center">Carregar rota do dia</h1>
                    <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                        placeholder="Número da carga"
                        value={numeroCarga}
                        onChange={(e) => setNumeroCarga(e.target.value)}
                        inputMode="numeric"
                        autoFocus
                    />
                    {erro && <p className="text-lassa-vermelho text-sm text-center">{erro}</p>}
                    <button
                        type="submit"
                        disabled={carregando}
                        className="w-full bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
                    >
                        {carregando ? 'Buscando...' : 'Buscar carga'}
                    </button>
                    <button type="button" onClick={logout} className="w-full text-sm text-gray-400">
                        Sair
                    </button>
                </form>
            </div>
        );
    }

    const grupos = agruparParadasPorCliente(carga.paradas).sort((a, b) => a.sequencia - b.sequencia);

    return (
        <div className="min-h-screen pb-24 bg-lassa-branco">
            <header className="bg-gradient-to-br from-lassa-azul to-lassa-profundo text-white p-5 rounded-b-3xl flex items-start justify-between shadow-md">
                <div>
                    <p className="text-sm opacity-75">Carga #{carga.wibi_ca_id}</p>
                    <h1 className="text-xl font-bold mt-0.5">{grupos.length} paradas <span className="font-normal opacity-80">({carga.paradas.length} notas)</span></h1>
                    <p className="text-sm opacity-90 mt-1">Veículo: {carga.veiculo_placa || '—'}</p>
                    {carga.distancia_total_km && (
                        <p className="text-sm opacity-90">~{Number(carga.distancia_total_km).toFixed(0)} km (ida e volta)</p>
                    )}
                </div>
                <button onClick={handleFinalizar} className="text-xs bg-white/15 hover:bg-white/25 transition-colors rounded-lg px-3 py-2 whitespace-nowrap">
                    Finalizar rota
                </button>
            </header>

            <ul className="p-4 space-y-3">
                {grupos.map((g) => (
                    <li key={g.clCodigo}>
                        <Link
                            to={`/cliente/${carga.id}/${g.clCodigo}`}
                            className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-3"
                        >
                            <div className="h-8 w-8 shrink-0 rounded-full bg-lassa-leve/20 text-lassa-profundo font-semibold text-sm flex items-center justify-center">
                                {g.sequencia}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 truncate">
                                    {g.paradas[0].cliente_nome || `Venda ${g.paradas[0].wibi_vd_codigo}`}
                                    {g.paradas.length > 1 && (
                                        <span className="ml-2 text-xs font-normal text-lassa-azul bg-lassa-leve/10 px-2 py-0.5 rounded-full">
                                            {g.paradas.length} notas
                                        </span>
                                    )}
                                </p>
                                <p className="text-sm text-gray-500 truncate">{g.paradas[0].cliente_endereco || 'Endereço não disponível'}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COR[g.status]}`}>
                                {g.status}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>

            <MenuMotorista cargaId={carga.id} />
        </div>
    );
}
