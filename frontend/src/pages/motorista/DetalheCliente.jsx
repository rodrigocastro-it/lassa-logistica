import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';

export default function DetalheCliente() {
    const { cargaId, paradaId } = useParams();
    const [parada, setParada] = useState(null);
    const [mostrarProblema, setMostrarProblema] = useState(false);
    const [descricaoProblema, setDescricaoProblema] = useState('');
    const [erro, setErro] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        api.obterCarga(cargaId).then((carga) => {
            const p = carga.paradas.find((x) => String(x.id) === paradaId);
            setParada(p || null);
        });
    }, [cargaId, paradaId]);

    async function marcar(status, problemaDescricao) {
        setErro('');
        try {
            const atualizada = await api.atualizarStatusParada(paradaId, status, problemaDescricao);
            setParada(atualizada);
            setMostrarProblema(false);
        } catch (err) {
            setErro(err.message);
        }
    }

    if (!parada) {
        return <p className="p-6 text-center text-gray-500">Carregando...</p>;
    }

    return (
        <div className="min-h-screen p-4 space-y-4">
            <button onClick={() => navigate(-1)} className="text-blue-700 text-sm">← Voltar</button>

            <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
                <h1 className="text-lg font-bold">{parada.cliente_nome || `Venda ${parada.wibi_vd_codigo}`}</h1>
                <p className="text-sm text-gray-600">{parada.cliente_endereco || 'Endereço não disponível'}</p>
                <p className="text-sm text-gray-600">{parada.cliente_telefone || 'Telefone não disponível'}</p>
            </div>

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
                <p>Status atual: <strong>{parada.status}</strong></p>
                {parada.chegada_em && <p>Chegada: {new Date(parada.chegada_em).toLocaleString('pt-BR')}</p>}
                {parada.inicio_em && <p>Início: {new Date(parada.inicio_em).toLocaleString('pt-BR')}</p>}
                {parada.fim_em && <p>Fim: {new Date(parada.fim_em).toLocaleString('pt-BR')}</p>}
                {parada.problema_descricao && <p>Problema: {parada.problema_descricao}</p>}
            </div>
        </div>
    );
}
