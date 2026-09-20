import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/motorista/Login';
import RotaDoDia from './pages/motorista/RotaDoDia';
import DetalheCliente from './pages/motorista/DetalheCliente';
import Paradas from './pages/motorista/Paradas';
import Mapa from './pages/motorista/Mapa';

import DashboardRotas from './pages/dashboard/DashboardRotas';
import DashboardRotaDetalhe from './pages/dashboard/DashboardRotaDetalhe';

function RotaPrivada({ children }) {
    const { motorista } = useAuth();
    return motorista ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/rota" element={<RotaPrivada><RotaDoDia /></RotaPrivada>} />
                    <Route path="/cliente/:cargaId/:paradaId" element={<RotaPrivada><DetalheCliente /></RotaPrivada>} />
                    <Route path="/paradas" element={<RotaPrivada><Paradas /></RotaPrivada>} />
                    <Route path="/mapa" element={<RotaPrivada><Mapa /></RotaPrivada>} />

                    <Route path="/dashboard" element={<DashboardRotas />} />
                    <Route path="/dashboard/rotas/:id" element={<DashboardRotaDetalhe />} />

                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
