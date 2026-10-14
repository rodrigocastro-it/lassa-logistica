import React from 'react';
import { NavLink } from 'react-router-dom';

const ICONES = {
    rota: (ativo) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ativo ? '#3C66AC' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h12" />
        </svg>
    ),
    mapa: (ativo) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ativo ? '#3C66AC' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
    ),
    paradas: (ativo) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ativo ? '#3C66AC' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
        </svg>
    )
};

const itens = [
    { to: '/rota', label: 'Rota', icone: 'rota' },
    { to: '/mapa', label: 'Mapa', icone: 'mapa' },
    { to: '/paradas', label: 'Paradas', icone: 'paradas' }
];

export default function MenuMotorista() {
    return (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
            {itens.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 text-xs px-4 py-1 rounded-lg ${isActive ? 'text-lassa-azul font-semibold' : 'text-gray-500'}`
                    }
                >
                    {({ isActive }) => (
                        <>
                            {ICONES[item.icone](isActive)}
                            {item.label}
                        </>
                    )}
                </NavLink>
            ))}
        </nav>
    );
}
