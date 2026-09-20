import React from 'react';
import { NavLink } from 'react-router-dom';

const itens = [
    { to: '/rota', label: 'Rota' },
    { to: '/mapa', label: 'Mapa' },
    { to: '/paradas', label: 'Paradas' }
];

export default function MenuMotorista() {
    return (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2">
            {itens.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                        `text-sm px-3 py-1 rounded-lg ${isActive ? 'text-blue-700 font-semibold' : 'text-gray-500'}`
                    }
                >
                    {item.label}
                </NavLink>
            ))}
        </nav>
    );
}
