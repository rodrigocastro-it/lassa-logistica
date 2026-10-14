import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCargaAtual } from '../../context/CargaAtualContext';
import LogoLassa from '../../components/LogoLassa';

export default function Login() {
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const { login } = useAuth();
    const { setCargaAtualId } = useCargaAtual();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setErro('');
        setCarregando(true);
        try {
            await login(usuario, senha);
            // Um login novo nunca deve herdar a carga de outro motorista que
            // usou esse mesmo navegador antes.
            setCargaAtualId(null);
            navigate('/rota');
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-lassa-leve/10 to-lassa-branco">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-5">
                <div className="flex justify-center">
                    <LogoLassa className="h-14" />
                </div>
                <div className="text-center space-y-1">
                    <h1 className="text-lg font-semibold text-gray-800">Logística</h1>
                    <p className="text-sm text-gray-500">Acesso do motorista</p>
                </div>

                <div className="space-y-3">
                    <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                        placeholder="Usuário"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        autoFocus
                    />
                    <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-lassa-leve"
                        placeholder="Senha"
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                    />
                </div>

                {erro && <p className="text-lassa-vermelho text-sm text-center">{erro}</p>}

                <button
                    type="submit"
                    disabled={carregando}
                    className="w-full bg-lassa-azul hover:bg-lassa-profundo transition-colors text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
                >
                    {carregando ? 'Entrando...' : 'Entrar'}
                </button>
            </form>
        </div>
    );
}
