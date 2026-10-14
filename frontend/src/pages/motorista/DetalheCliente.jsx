import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { statusDoGrupo } from '../../utils/agruparParadas';

const ICONE = {
    chegada: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
        </svg>
    ),
    inicio: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
    ),
    fim: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    ),
    problema: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
    )
};

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
        return <p className="p-6 text-center text-gray-400">Carregando...</p>;
    }

    const principal = notas[0];
    const status = statusDoGrupo(notas);

    return (
        <div className="min-h-screen p-4 space-y-4 bg-lassa-branco">
            <button onClick={() => navigate(-1)} className="text-lassa-azul text-sm font-medium flex items-center gap-1">
                ← Voltar
            </button>

            <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                <h1 className="text-lg font-bold text-gray-800">{principal.cliente_nome || `Venda ${principal.wibi_vd_codigo}`}</h1>
                {principal.cliente_endereco ? (
                    <a
                        className="text-sm text-lassa-azul underline block"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps?q=${encodeURIComponent(principal.cliente_endereco)}`}
                    >
                        {principal.cliente_endereco}
                    </a>
                ) : (
                    <p className="text-sm text-gray-500">Endereço não disponível</p>
                )}
                {principal.cliente_telefone ? (
                    <a className="text-sm text-lassa-azul underline block" href={`tel:${principal.cliente_telefone}`}>
                        {principal.cliente_telefone}
                    </a>
                ) : (
                    <p className="text-sm text-gray-500">Telefone não disponível</p>
                )}
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

            {erro && <p className="text-lassa-vermelho text-sm">{erro}</p>}

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => marcar('chegada')}
                    className="bg-yellow-500 hover:bg-yellow-600 transition-colors text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                >
                    {ICONE.chegada} Chegada
                </button>
                <button
                    onClick={() => marcar('inicio')}
                    className="bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                >
                    {ICONE.inicio} Início
                </button>
                <button
                    onClick={() => marcar('fim')}
                    className="bg-green-600 hover:bg-green-700 transition-colors text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                >
                    {ICONE.fim} Fim
                </button>
                <button
                    onClick={() => setMostrarProblema(true)}
                    className="bg-lassa-vermelho hover:bg-red-800 transition-colors text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                >
                    {ICONE.problema} Problema
                </button>
            </div>

            {mostrarProblema && (
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                    <textarea
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                        placeholder="Descreva o problema"
                        value={descricaoProblema}
                        onChange={(e) => setDescricaoProblema(e.target.value)}
                        rows={3}
                        autoFocus
                    />
                    <button
                        onClick={() => marcar('problema', descricaoProblema)}
                        disabled={!descricaoProblema}
                        className="w-full bg-lassa-vermelho text-white rounded-lg py-2 disabled:opacity-50"
                    >
                        Confirmar problema
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-4 text-sm text-gray-600 space-y-1">
                <p>Status atual: <strong className="text-gray-800">{status}</strong></p>
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
