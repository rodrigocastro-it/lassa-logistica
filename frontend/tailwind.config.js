/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                lassa: {
                    azul: '#3C66AC',
                    leve: '#66A8DE',
                    profundo: '#243D5A',
                    vermelho: '#C63A3D',
                    branco: '#F3F3F4'
                }
            },
            fontFamily: {
                sans: ['Satoshi', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
            }
        }
    },
    plugins: []
};
