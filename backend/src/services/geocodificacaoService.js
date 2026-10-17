const { pool } = require('../db/pg');

/**
 * Geocodifica uma cidade (nome -> latitude/longitude aproximados) usando o
 * Nominatim do OpenStreetMap -- gratuito, mesmo serviço de mapa que o resto
 * do app já usa (Leaflet). Usado só quando nenhum cliente de uma cidade tem
 * GPS cadastrado no WiBi, como aproximação (centro da cidade, não o
 * endereço exato do cliente).
 *
 * Guarda em cache (tabela cidades_geocodificadas) pra não bater no serviço
 * de novo pra mesma cidade -- o Nominatim pede uso comedido (no máximo 1
 * requisição por segundo) e exige um User-Agent identificando o uso.
 */
async function geocodificarCidade(nome, uf) {
    if (!nome) return null;

    const cache = await pool.query(
        'SELECT * FROM cidades_geocodificadas WHERE nome = $1 AND uf IS NOT DISTINCT FROM $2',
        [nome, uf || null]
    );
    if (cache.rows.length > 0) {
        const row = cache.rows[0];
        return row.encontrado ? { lat: Number(row.latitude), lng: Number(row.longitude) } : null;
    }

    const query = encodeURIComponent(`${nome}, ${uf || ''}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    let resultado = null;
    try {
        const resposta = await fetch(url, {
            headers: { 'User-Agent': 'lassa-logistica/1.0 (sistema interno Lassa Laticinios)' }
        });
        const dados = await resposta.json();
        if (dados[0]) {
            resultado = { lat: parseFloat(dados[0].lat), lng: parseFloat(dados[0].lon) };
        }
    } catch (err) {
        console.error(`Falha ao geocodificar cidade "${nome}/${uf}":`, err);
    }

    await pool.query(
        `INSERT INTO cidades_geocodificadas (nome, uf, latitude, longitude, encontrado)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (nome, uf) DO UPDATE SET latitude = $3, longitude = $4, encontrado = $5`,
        [nome, uf || null, resultado?.lat ?? null, resultado?.lng ?? null, !!resultado]
    );

    return resultado;
}

module.exports = { geocodificarCidade };
