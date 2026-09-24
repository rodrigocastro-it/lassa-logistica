import React, { createContext, useContext, useState } from 'react';

// Guarda qual carga está aberta agora pro motorista — Rota, Mapa e Paradas
// usam essa mesma referência em vez de cada tela perguntar separadamente
// "qual carga está em rota?" pro servidor (o que podia divergir entre telas).
const CargaAtualContext = createContext(null);

export function CargaAtualProvider({ children }) {
    const [cargaAtualId, setCargaAtualIdState] = useState(() => {
        const salvo = localStorage.getItem('lassa_carga_atual_id');
        return salvo ? parseInt(salvo, 10) : null;
    });

    function setCargaAtualId(id) {
        if (id == null) {
            localStorage.removeItem('lassa_carga_atual_id');
        } else {
            localStorage.setItem('lassa_carga_atual_id', String(id));
        }
        setCargaAtualIdState(id);
    }

    return (
        <CargaAtualContext.Provider value={{ cargaAtualId, setCargaAtualId }}>
            {children}
        </CargaAtualContext.Provider>
    );
}

export function useCargaAtual() {
    return useContext(CargaAtualContext);
}
