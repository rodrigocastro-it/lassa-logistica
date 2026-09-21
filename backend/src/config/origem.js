// Coordenadas de origem (empresa Lassa, em Sobral/CE) usadas pela otimização
// de rota — toda rota sai daqui e retorna pra cá no final (confirmado pelo
// usuário em 2026-09-21).
//
// Valor padrão = centro da cerca eletrônica "Lassa" cadastrada na própria
// Point Track (ver `cercas` na resposta de /Rest2/login.json). Se um dia
// vocês tiverem uma coordenada mais precisa (ex.: pino exato do portão no
// Google Maps), defina LASSA_ORIGEM_LAT / LASSA_ORIGEM_LNG no .env pra
// sobrescrever.
require('dotenv').config();

const PADRAO_LAT = -3.705191;
const PADRAO_LNG = -40.337928;

const origem = {
    lat: process.env.LASSA_ORIGEM_LAT ? parseFloat(process.env.LASSA_ORIGEM_LAT) : PADRAO_LAT,
    lng: process.env.LASSA_ORIGEM_LNG ? parseFloat(process.env.LASSA_ORIGEM_LNG) : PADRAO_LNG
};

module.exports = { origem };
