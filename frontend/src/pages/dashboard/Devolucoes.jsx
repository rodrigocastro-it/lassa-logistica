import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LogoLassa from '../../components/LogoLassa';

function dataIsoDiasAtras(dias) {
    return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatarValor(v) {
    return v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';
}

export default function Devolucoes() {
    const [inicio, setInicio] = useState(() => dataIsoDiasAtras(7));
    const [fim, setFim] = useState(() => new Date().toISOString().slice(0, 10));
    const [grupos, setGrupos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');

    async function carregar() {
        setCarregando(true);
        setErro('');
        try {
            setGrupos(await api.devolucoes(inicio, fim));
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inicio, fim]);

    const totalQuantidade = grupos.reduce((acc, g) => acc + g.quantidade, 0);
    const totalValor = grupos.reduce((acc, g) => acc + (g.valor || 0), 0);

    return (
        <div className="min-h-screen bg-lassa-branco">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <LogoLassa className="h-9" />
                        <span className="text-gray-300">|</span>
                        <h1 className="text-lg font-semibold text-gray-700">Devoluções</h1>
                    </div>
                    <Link to="/dashboard" className="text-lassa-azul text-sm">← Voltar</Link>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
                <p className="text-sm text-gray-500">
                    Mesmo controle que a Nina já mantinha na planilha (rota, quantidade, valor, motivo) — agora alimentado
                    pelo que o motorista marca como "não entregue" no app, com reforço aqui no detalhe da rota quando ele esquecer.
                </p>

                <div className="bg-white rounded-xl shadow-sm p-4 flex items-end gap-4 flex-wrap">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">De</label>
                        <input
                            type="date"
                            value={inicio}
                            onChange={(e) => setInicio(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Até</label>
                        <input
                            type="date"
                            value={fim}
                            onChange={(e) => setFim(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <a
                        href={api.exportarDevolucoesUrl(inicio, fim)}
                        className="bg-green-600 hover:bg-green-700 transition-colors text-white rounded-lg px-4 py-2 text-sm"
                    >
                        Exportar CSV
                    </a>
                </div>

                {erro && <p className="text-lassa-vermelho text-sm">{erro}</p>}
                {carregando && <p className="text-sm text-gray-500">Carregando...</p>}

                {!carregando && grupos.length === 0 && (
                    <p className="text-gray-400 text-center py-10">Nenhuma devolução registrada nesse período.</p>
                )}

                {!carregando && grupos.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-left">
                                <tr>
                                    <th className="px-4 py-2">Rota</th>
                                    <th className="px-4 py-2">Quantidade</th>
                                    <th className="px-4 py-2">Valor</th>
                                    <th className="px-4 py-2">Motivo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {grupos.map((g) => (
                                    <tr key={g.rota}>
                                        <td className="px-4 py-2 font-medium text-gray-800">{g.rota}</td>
                                        <td className="px-4 py-2">{g.quantidade}</td>
                                        <td className="px-4 py-2">{formatarValor(g.valor)}</td>
                                        <td className="px-4 py-2 text-gray-600">{g.motivos.join(' · ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-semibold text-gray-700">
                                <tr>
                                    <td className="px-4 py-2">Total</td>
                                    <td className="px-4 py-2">{totalQuantidade}</td>
                                    <td className="px-4 py-2">{formatarValor(totalValor)}</td>
                                    <td className="px-4 py-2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
