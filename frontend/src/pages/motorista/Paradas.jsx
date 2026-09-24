import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useCargaAtual } from '../../context/CargaAtualContext';
import MenuMotorista from './MenuMotorista';

function formatarDuracao(inicio, fim) {
    const inicioMs = new Date(inicio).getTime();
    const fimMs = fim ? new Date(fim).getTime() : Date.now();
    const minutos = Math.round((fimMs - inicioMs) / 60000);
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function Paradas() {
    const { cargaAtualId } = useCargaAtual();
    const [paradas, setParadas] = useState([]);
    const [tipo, setTipo] = useState('Almoço');
    const [observacao, setObservacao] = useState('');

    async function carregar() {
        if (!cargaAtualId) {
            setParadas([]);
            return;
        }
        const lista = await api.listarParadasManuais(cargaAtualId);
        setParadas(lista);
    }

    useEffect(() => { carregar(); }, [cargaAtualId]);

    async function adicionarParada(e) {
        e.preventDefault();
        await api.criarParadaManual(cargaAtualId, tipo, observacao);
        setObservacao('');
        carregar();
    }

    async function encerrar(id) {
        await api.encerrarParadaManual(id);
        carregar();
    }

    const tempoTotalMin = paradas.reduce((acc, p) => {
        const fim = p.fim_em ? new Date(p.fim_em).getTime() : Date.now();
        const inicio = new Date(p.inicio_em).getTime();
        return acc + Math.round((fim - inicio) / 60000);
    }, 0);

    return (
        <div className="min-h-screen p-4 pb-24 space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
                <h1 className="text-lg font-bold">Paradas</h1>
                <p className="text-sm text-gray-600">
                    Tempo total: {String(Math.floor(tempoTotalMin / 60)).padStart(2, '0')}:{String(tempoTotalMin % 60).padStart(2, '0')}
                </p>
            </div>

            {!cargaAtualId && (
                <p className="text-gray-500">Carregue uma rota primeiro pra registrar paradas.</p>
            )}

            <ul className="space-y-3">
                {paradas.map((p) => (
                    <li key={p.id} className="bg-white rounded-xl shadow-sm p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold">{p.tipo}</p>
                                <p className="text-sm text-gray-500">
                                    {new Date(p.inicio_em).toLocaleTimeString('pt-BR')}
                                    {p.fim_em && ` - ${new Date(p.fim_em).toLocaleTimeString('pt-BR')}`}
                                </p>
                                {p.observacao && <p className="text-sm text-gray-500">{p.observacao}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-mono">{formatarDuracao(p.inicio_em, p.fim_em)}</p>
                                {!p.fim_em && (
                                    <button onClick={() => encerrar(p.id)} className="text-xs text-red-600 mt-1">
                                        Encerrar
                                    </button>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {cargaAtualId && (
                <form onSubmit={adicionarParada} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                    <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                    >
                        <option>Almoço</option>
                        <option>Abastecimento</option>
                        <option>Descanso</option>
                        <option>Outro</option>
                    </select>
                    <input
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Observação (opcional)"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                    />
                    <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2">
                        + Adicionar parada
                    </button>
                </form>
            )}

            <MenuMotorista />
        </div>
    );
}
