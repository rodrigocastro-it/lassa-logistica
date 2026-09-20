// Coordenadas de origem (galpão/CD da Lassa) usadas pela otimização de rota.
// NÃO foram confirmadas ainda — defina LASSA_ORIGEM_LAT / LASSA_ORIGEM_LNG
// no .env antes de usar a Fase 3 (otimização automática) em produção.
// Dica: no login da Point Track existe uma cerca eletrônica chamada "Lassa"
// (ver `cercas` na resposta de /Rest2/login.json) que pode servir de referência.
require('dotenv').config();

const origem = {
    lat: process.env.LASSA_ORIGEM_LAT ? parseFloat(process.env.LASSA_ORIGEM_LAT) : null,
    lng: process.env.LASSA_ORIGEM_LNG ? parseFloat(process.env.LASSA_ORIGEM_LNG) : null
};

module.exports = { origem };
