import React, { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [motorista, setMotorista] = useState(() => {
        const saved = localStorage.getItem('lassa_motorista');
        return saved ? JSON.parse(saved) : null;
    });

    async function login(usuario, senha) {
        const { token, motorista: m } = await api.login(usuario, senha);
        localStorage.setItem('lassa_token', token);
        localStorage.setItem('lassa_motorista', JSON.stringify(m));
        setMotorista(m);
    }

    function logout() {
        localStorage.removeItem('lassa_token');
        localStorage.removeItem('lassa_motorista');
        setMotorista(null);
    }

    return (
        <AuthContext.Provider value={{ motorista, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
