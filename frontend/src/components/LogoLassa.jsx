import React from 'react';

// Símbolo oficial da marca (extraído do brandbook da Lassa no Google Drive,
// pasta "Arquivos da marca"), com o nome ao lado em texto.
export default function LogoLassa({ className = 'h-10', comTexto = true }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <img src="/logo-lassa-oficial.png" alt="Lassa" className="h-full w-auto" />
            {comTexto && (
                <span className="font-bold text-lassa-profundo leading-none" style={{ fontSize: '1.15em' }}>
                    Lassa
                </span>
            )}
        </div>
    );
}
