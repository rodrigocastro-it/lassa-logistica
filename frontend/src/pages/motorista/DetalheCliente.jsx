import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { statusDoGrupo } from '../../utils/agruparParadas';

export default function DetalheCliente() {
    const { cargaId, clCodigo } = useParams();
    const [notas, setNotas] = useState(null);
    const [mostrarProblema, setMostrarProblema] = useState(false);
    const [descricaoProblema, setDescricaoProblema] = useState('');
    const [erro, setErro] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargaId, clCodigo]);

    async function carregar() {
        const carga = await api.obterCarga(cargaId);
        const doCliente = carga.paradas.filter((p) => String(p.wibi_cl_codigo) === clCodigo);
        setNotas(doCliente);
    }

    async function marcar(status, problemaDescricao) {
        setErro('');
        try {
            await api.atualizarStatusGrupo(notas.map((n) => n.id), status, problemaDescricao);
            await carregar();
            setMostrarProblema(false);
        } catch (err) {
            setErro(err.message);
        }
    }

    if (!notas || notas.length === 0) {
        return <p className="p-6 text-center text-gray-500">Carregando...</p>;
    }

    const principal = notas[0];
    const status = statusDoGrupo(notas);

    return (
        <div className="min-h-screen p-4 space-y-4">
            <button onClick={() => navigate(-1)} className="text-blue-700 text-sm">← Voltar</button>

            <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
                <h1 className="text-lg font-bold">{principal.cliente_nome || `Venda ${principal.wibi_vd_codigo}`}</h1>
                <p className="text-sm text-gray-600">{principal.cliente_endereco || 'Endereço não disponível'}</p>
                <p className="text-sm text-gray-600">{principal.cliente_telefone || 'Telefone não disponível'}</p>
            </div>

            {notas.length > 1 && (
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">{notas.length} notas deste cliente:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                        {notas.map((n) => (
                            <li key={n.id} className="flex justify-between">
                                <span>Venda {n.wibi_vd_codigo}</span>
                                <span className="text-gray-400">{n.status}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-gray-400 mt-2">
                        Os botões abaixo marcam o status de todas as notas deste cliente de uma vez.
                    </p>
                </div>
            )}

            {erro && <p className="text-red-600 text-sm">{erro}</p>}

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => marcar('chegada')}
                    className="bg-yellow-500 text-white rounded-xl py-3 font-medium"
                >
                    Marcar Chegada
                </button>
                <button
                    onClick={() => marcar('inicio')}
                    className="bg-blue-600 text-white rounded-xl py-3 font-medium"
                >
                    Marcar Início
                </button>
                <button
                    onClick={() => marcar('fim')}
                    className="bg-green-600 text-white rounded-xl py-3 font-medium"
                >
                    Marcar Fim
                </button>
                <button
                    onClick={() => setMostrarProblema(true)}
                    className="bg-red-600 text-white rounded-xl py-3 font-medium"
                >
                    Marcar Problema
                </button>
            </div>

            {mostrarProblema && (
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                    <textarea
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Descreva o problema"
                        value={descricaoProblema}
                        onChange={(e) => setDescricaoProblema(e.target.value)}
                        rows={3}
                        autoFocus
                    />
                    <button
                        onClick={() => marcar('problema', descricaoProblema)}
                        disabled={!descricaoProblema}
                        className="w-full bg-red-600 text-white rounded-lg py-2 disabled:opacity-50"
                    >
                        Confirmar problema
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-4 text-sm text-gray-600 space-y-1">
                <p>Status atual: <strong>{status}</strong></p>
                {principal.chegada_em && <p>Chegada: {new Date(principal.chegada_em).toLocaleString('pt-BR')}</p>}
                {principal.inicio_em && <p>Início: {new Date(principal.inicio_em).toLocaleString('pt-BR')}</p>}
                {principal.fim_em && <p>Fim: {new Date(principal.fim_em).toLocaleString('pt-BR')}</p>}
                {notas.some((n) => n.problema_descricao) && (
                    <p>Problema: {notas.find((n) => n.problema_descricao).problema_descricao}</p>
                )}
            </div>
        </div>
    );
}
