import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setErro('');
        setCarregando(true);
        try {
            await login(usuario, senha);
            navigate('/rota');
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm space-y-4">
                <h1 className="text-xl font-bold text-center text-blue-700">Lassa Logística</h1>
                <p className="text-center text-sm text-gray-500">Acesso do motorista</p>

                <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Usuário"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoFocus
                />
                <input
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                />

                {erro && <p className="text-red-600 text-sm">{erro}</p>}

                <button
                    type="submit"
                    disabled={carregando}
                    className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50"
                >
                    {carregando ? 'Entrando...' : 'Entrar'}
                </button>
            </form>
        </div>
    );
}
