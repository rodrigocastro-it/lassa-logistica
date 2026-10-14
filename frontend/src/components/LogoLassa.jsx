import React from 'react';

// Marca simples em SVG (não depende de arquivo de imagem externo) nas cores
// oficiais do brandbook da Lassa: azul Lassa #3C66AC e azul profundo #243D5A.
// Se um dia tiverem o arquivo oficial da logo em mãos (ex: enviado direto
// pelo chat, sem risco de corromper no download), é só trocar por <img>.
export default function LogoLassa({ className = 'h-10', comTexto = true }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <svg viewBox="0 0 48 48" className="h-full w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M24 4C24 4 10 20.5 10 30a14 14 0 0028 0C38 20.5 24 4 24 4z"
                    fill="#3C66AC"
                />
                <path
                    d="M24 14c0 0-7 9-7 15a7 7 0 0014 0c0-6-7-15-7-15z"
                    fill="#66A8DE"
                />
            </svg>
            {comTexto && (
                <span className="font-bold text-lassa-profundo leading-none" style={{ fontSize: '1.15em' }}>
                    Lassa
                </span>
            )}
        </div>
    );
}
