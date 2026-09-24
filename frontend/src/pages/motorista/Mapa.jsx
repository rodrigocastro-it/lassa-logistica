import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useCargaAtual } from '../../context/CargaAtualContext';
import MapaVeiculo from '../../components/MapaVeiculo';
import MenuMotorista from './MenuMotorista';

export default function Mapa() {
    const { cargaAtualId } = useCargaAtual();
    const [carga, setCarga] = useState(null);
    const [posicao, setPosicao] = useState(null);
    const [erro, setErro] = useState('');

    useEffect(() => {
        if (!cargaAtualId) {
            setCarga(null);
            return;
        }
        api.obterCarga(cargaAtualId).then(setCarga).catch(() => setCarga(null));
    }, [cargaAtualId]);

    useEffect(() => {
        if (!carga?.veiculo_placa) return;

        async function buscar() {
            try {
                const p = await api.posicaoVeiculo(carga.veiculo_placa);
                setPosicao(p);
                setErro('');
            } catch (err) {
                setErro(err.message);
            }
        }
        buscar();
        const intervalo = setInterval(buscar, 30000);
        return () => clearInterval(intervalo);
    }, [carga]);

    return (
        <div className="min-h-screen p-4 pb-24 space-y-4">
            <h1 className="text-lg font-bold">Mapa</h1>

            {!carga && <p className="text-gray-500">Carregue uma rota primeiro pra ver a posição do veículo.</p>}
            {carga && erro && <p className="text-red-600 text-sm">{erro}</p>}

            {posicao && (
                <>
                    <MapaVeiculo
                        latitude={posicao.latitude}
                        longitude={posicao.longitude}
                        popup={`Veículo ${carga.veiculo_placa}`}
                        altura="60vh"
                    />
                    <div className="bg-white rounded-xl shadow-sm p-4 text-sm text-gray-600 space-y-1">
                        <p>Velocidade: {posicao.velocidadeKmh ?? '—'} km/h</p>
                        <p>Ignição: {posicao.ignicaoLigada ? 'ligada' : 'desligada'}</p>
                        <p>Atualizado em: {posicao.atualizadoEm || '—'}</p>
                    </div>
                </>
            )}

            <MenuMotorista />
        </div>
    );
}
