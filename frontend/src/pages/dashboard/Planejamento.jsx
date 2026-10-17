import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LogoLassa from '../../components/LogoLassa';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Planejamento() {
    const [config, setConfig] = useState(null);
    const [salvandoConfig, setSalvandoConfig] = useState(false);

    const [regioes, setRegioes] = useState([]);
    const [nomeRegiao, setNomeRegiao] = useState('');
    const [diaRegiao, setDiaRegiao] = useState('1');

    const [distanciaKm, setDistanciaKm] = useState('');
    const [resultadoMinimo, setResultadoMinimo] = useState(null);
    const [valorTotalCarga, setValorTotalCarga] = useState('');

    useEffect(() => {
        api.obterConfigCusto().then(setConfig);
        api.listarRegioes().then(setRegioes);
    }, []);

    async function salvarConfig(e) {
        e.preventDefault();
        setSalvandoConfig(true);
        try {
            const atualizado = await api.atualizarConfigCusto({
                custoKmCaminhao: config.custo_km_caminhao,
                fatorIdaVolta: config.fator_ida_volta,
                margemMultiplicador: config.margem_multiplicador
            });
            setConfig(atualizado);
        } finally {
            setSalvandoConfig(false);
        }
    }

    async function calcular(e) {
        e.preventDefault();
        const resultado = await api.calcularMinimo({ distanciaKm: parseFloat(distanciaKm) });
        setResultadoMinimo(resultado);
    }

    async function adicionarRegiao(e) {
        e.preventDefault();
        if (!nomeRegiao) return;
        await api.criarRegiao(nomeRegiao, parseInt(diaRegiao, 10));
        setNomeRegiao('');
        setRegioes(await api.listarRegioes());
    }

    async function removerRegiao(id) {
        await api.removerRegiao(id);
        setRegioes(await api.listarRegioes());
    }

    if (!config) return <p className="p-6 text-center text-gray-400">Carregando...</p>;

    const valorNumerico = parseFloat(valorTotalCarga);
    const diferenca = resultadoMinimo && !isNaN(valorNumerico) ? valorNumerico - resultadoMinimo.minimo : null;

    return (
        <div className="min-h-screen bg-lassa-branco">
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
                    <LogoLassa className="h-9" />
                    <span className="text-gray-300">|</span>
                    <h1 className="text-lg font-semibold text-gray-700">Planejamento de Carga</h1>
                    <Link to="/dashboard" className="ml-auto text-sm text-lassa-azul">← Acompanhamento de entregas</Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
                <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <div>
                        <p className="font-semibold text-gray-700">Calculadora: vale a pena entregar?</p>
                        <p className="text-sm text-gray-400">
                            Informa a distância (só ida, Sobral até o cliente ou região) e descobre o mínimo que a carga
                            precisa somar pra compensar o custo da viagem.
                        </p>
                    </div>
                    <form onSubmit={calcular} className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Distância até lá (km, só ida)</label>
                            <input
                                className="border border-gray-200 rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                value={distanciaKm}
                                onChange={(e) => setDistanciaKm(e.target.value)}
                                inputMode="decimal"
                                placeholder="ex: 15"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!distanciaKm}
                            className="bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-lg px-4 py-2 disabled:opacity-50"
                        >
                            Calcular mínimo
                        </button>
                    </form>

                    {resultadoMinimo && (
                        <div className="bg-lassa-leve/10 rounded-lg p-4 space-y-3">
                            <p className="text-sm text-gray-600">
                                {resultadoMinimo.distanciaKmIda} km de ida × {config.fator_ida_volta} (ida e volta) ×
                                R$ {Number(config.custo_km_caminhao).toFixed(2)}/km × {config.margem_multiplicador}x de margem
                            </p>
                            <p className="text-2xl font-bold text-lassa-profundo">
                                Mínimo: R$ {resultadoMinimo.minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>

                            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-lassa-leve/30">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Valor total dessa região/carga (opcional)</label>
                                    <input
                                        className="border border-gray-200 rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                        value={valorTotalCarga}
                                        onChange={(e) => setValorTotalCarga(e.target.value)}
                                        inputMode="decimal"
                                        placeholder="ex: 1406"
                                    />
                                </div>
                            </div>
                            {diferenca != null && (
                                <p className={`font-semibold ${diferenca >= 0 ? 'text-green-700' : 'text-lassa-vermelho'}`}>
                                    {diferenca >= 0
                                        ? `Vale a pena — passou do mínimo em R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                        : `Não atingiu o mínimo — faltam R$ ${Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                </p>
                            )}
                        </div>
                    )}
                </section>

                <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <div>
                        <p className="font-semibold text-gray-700">Custo e margem</p>
                        <p className="text-sm text-gray-400">Usado na conta acima. Só mexe aqui se a diretoria mudar os valores.</p>
                    </div>
                    <form onSubmit={salvarConfig} className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Custo por km do caminhão (R$)</label>
                            <input
                                className="border border-gray-200 rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                value={config.custo_km_caminhao}
                                onChange={(e) => setConfig({ ...config, custo_km_caminhao: e.target.value })}
                                inputMode="decimal"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Fator ida e volta</label>
                            <input
                                className="border border-gray-200 rounded-lg px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                value={config.fator_ida_volta}
                                onChange={(e) => setConfig({ ...config, fator_ida_volta: e.target.value })}
                                inputMode="decimal"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Margem (x)</label>
                            <input
                                className="border border-gray-200 rounded-lg px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                value={config.margem_multiplicador}
                                onChange={(e) => setConfig({ ...config, margem_multiplicador: e.target.value })}
                                inputMode="decimal"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={salvandoConfig}
                            className="bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-lg px-4 py-2 disabled:opacity-50"
                        >
                            {salvandoConfig ? 'Salvando...' : 'Salvar'}
                        </button>
                    </form>
                </section>

                <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <div>
                        <p className="font-semibold text-gray-700">Cronograma de regiões</p>
                        <p className="text-sm text-gray-400">Qual cidade/região entrega em qual dia da semana, combinado com a diretoria.</p>
                    </div>

                    <div className="divide-y">
                        {regioes.length === 0 && <p className="text-sm text-gray-400 py-2">Nenhuma região cadastrada ainda.</p>}
                        {regioes.map((r) => (
                            <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                                <div>
                                    <span className="font-medium text-gray-800">{r.nome_regiao}</span>
                                    <span className="ml-2 text-sm text-gray-500">{DIAS[r.dia_semana]}</span>
                                </div>
                                <button onClick={() => removerRegiao(r.id)} className="text-sm text-lassa-vermelho">
                                    Remover
                                </button>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={adicionarRegiao} className="flex flex-wrap items-end gap-3 pt-2 border-t">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Cidade/região</label>
                            <input
                                className="border border-gray-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                value={nomeRegiao}
                                onChange={(e) => setNomeRegiao(e.target.value)}
                                placeholder="ex: Crateús"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Dia da semana</label>
                            <select
                                className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                                value={diaRegiao}
                                onChange={(e) => setDiaRegiao(e.target.value)}
                            >
                                {DIAS.map((d, idx) => (
                                    <option key={idx} value={idx}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={!nomeRegiao}
                            className="bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-lg px-4 py-2 disabled:opacity-50"
                        >
                            + Adicionar
                        </button>
                    </form>
                </section>
            </main>
        </div>
    );
}
