import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MenuMotorista from './MenuMotorista';

const STATUS_COR = {
    pendente: 'bg-gray-200 text-gray-700',
    chegada: 'bg-yellow-100 text-yellow-800',
    inicio: 'bg-blue-100 text-blue-800',
    fim: 'bg-green-100 text-green-800',
    problema: 'bg-red-100 text-red-800'
};

export default function RotaDoDia() {
    const [carga, setCarga] = useState(null);
    const [numeroCarga, setNumeroCarga] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const { logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        api.minhasCargas().then((cargas) => {
            const emRota = cargas.find((c) => c.status === 'em_rota');
            if (emRota) carregarDetalhe(emRota.id);
        }).catch(() => {});
    }, []);

    async function carregarDetalhe(id) {
        const detalhe = await api.obterCarga(id);
        setCarga(detalhe);
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
            <div className="min-h-screen flex flex-col items-center justify-center px-4">
                <form onSubmit={handleBuscarCarga} className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm space-y-4">
                    <h1 className="text-lg font-bold text-blue-700">Carregar rota do dia</h1>
                    <input
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Número da carga"
                        value={numeroCarga}
                        onChange={(e) => setNumeroCarga(e.target.value)}
                        inputMode="numeric"
                        autoFocus
                    />
                    {erro && <p className="text-red-600 text-sm">{erro}</p>}
                    <button
                        type="submit"
                        disabled={carregando}
                        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50"
                    >
                        {carregando ? 'Buscando...' : 'Buscar carga'}
                    </button>
                    <button type="button" onClick={logout} className="w-full text-sm text-gray-500">
                        Sair
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20">
            <header className="bg-blue-700 text-white p-4 rounded-b-2xl">
                <p className="text-sm opacity-80">Carga #{carga.wibi_ca_id}</p>
                <h1 className="text-xl font-bold">{carga.paradas.length} paradas</h1>
                <p className="text-sm opacity-90">Veículo: {carga.veiculo_placa || '—'}</p>
            </header>

            <ul className="p-4 space-y-3">
                {carga.paradas.map((p) => (
                    <li key={p.id}>
                        <Link
                            to={`/cliente/${carga.id}/${p.id}`}
                            className="block bg-white rounded-xl shadow-sm p-4 flex items-center justify-between"
                        >
                            <div>
                                <p className="font-semibold">{p.sequencia}. {p.cliente_nome || `Venda ${p.wibi_vd_codigo}`}</p>
                                <p className="text-sm text-gray-500">{p.cliente_endereco || 'Endereço não disponível'}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COR[p.status]}`}>
                                {p.status}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>

            <MenuMotorista cargaId={carga.id} />
        </div>
    );
}
