const { pool } = require('../db/pg');
const { getCargaByNumero } = require('./wibiCargaService');
const { otimizarSequencia, distanciaHaversineKm } = require('./routeOptimizer');
const { origem } = require('../config/origem');

/**
 * Monta (ou recupera, se já existir) a rota local de uma carga do WiBi:
 * busca a carga, otimiza a sequência de paradas e grava em Postgres.
 * Usado tanto pelo app do motorista (POST /cargas/carregar) quanto pelo
 * dashboard da torre de controle (POST /dashboard/rotas/montar).
 *
 * @param {number} caId - número da carga no WiBi (t_carga.ca_id)
 * @param {number|null} motoristaId - motorista dono da rota; null quando
 *   quem está montando é a torre de controle (o motorista assume a rota
 *   depois, ao digitar o mesmo número no app dele)
 * @returns {Promise<{id: number, jaExistia: boolean} | null>} null se a
 *   carga não existir no WiBi
 */
async function montarOuObterRota(caId, motoristaId = null) {
    const existente = await pool.query(
        'SELECT id, motorista_id FROM cargas WHERE wibi_ca_id = $1',
        [caId]
    );
    if (existente.rows.length > 0) {
        const cargaExistente = existente.rows[0];
        // Se a rota foi montada pela torre de controle (sem motorista) e
        // agora um motorista está digitando o número, ele "assume" a rota.
        if (motoristaId && !cargaExistente.motorista_id) {
            await pool.query('UPDATE cargas SET motorista_id = $1 WHERE id = $2', [motoristaId, cargaExistente.id]);
        }
        return { id: cargaExistente.id, jaExistia: true };
    }

    const cargaWibi = await getCargaByNumero(caId);
    if (!cargaWibi) {
        return null;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const cargaInsert = await client.query(
            `INSERT INTO cargas (wibi_ca_id, data_entrega, veiculo_placa, motorista_id, origem_lat, origem_lng, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'em_rota')
             RETURNING id`,
            [
                cargaWibi.caId,
                cargaWibi.dataEntrega,
                cargaWibi.veiculo?.placa || null,
                motoristaId,
                origem.lat,
                origem.lng
            ]
        );
        const cargaId = cargaInsert.rows[0].id;

        const paradasParaOtimizar = cargaWibi.paradas.map((p) => ({
            wibiVdCodigo: p.vdCodigo,
            wibiClCodigo: p.clCodigo,
            clienteNome: p.clienteNome,
            clienteEndereco: p.endereco,
            clienteTelefone: p.telefone,
            latitude: p.latitude,
            longitude: p.longitude,
            cep: p.cep
        }));

        const ordenadas = origem.lat != null && origem.lng != null
            ? otimizarSequencia(origem, paradasParaOtimizar)
            : paradasParaOtimizar.map((p, idx) => ({ ...p, sequencia: idx + 1 }));

        // Distância total = soma dos trechos entre paradas + volta da última
        // parada até a origem (toda rota da Lassa sai e retorna pra empresa).
        const distanciaIdaKm = ordenadas.reduce((acc, p) => acc + (p.distanciaKm || 0), 0);
        const ultimaComCoordenada = [...ordenadas].reverse().find((p) => p.latitude != null && p.longitude != null);
        const distanciaVoltaKm = ultimaComCoordenada
            ? distanciaHaversineKm(ultimaComCoordenada.latitude, ultimaComCoordenada.longitude, origem.lat, origem.lng)
            : 0;
        const distanciaTotalKm = distanciaIdaKm + distanciaVoltaKm;

        for (const p of ordenadas) {
            await client.query(
                `INSERT INTO paradas
                    (carga_id, wibi_vd_codigo, wibi_cl_codigo, sequencia, cliente_nome, cliente_endereco, cliente_telefone, latitude, longitude)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [cargaId, p.wibiVdCodigo, p.wibiClCodigo, p.sequencia, p.clienteNome, p.clienteEndereco, p.clienteTelefone, p.latitude, p.longitude]
            );
        }

        await client.query(
            'UPDATE cargas SET distancia_total_km = $1 WHERE id = $2',
            [distanciaTotalKm, cargaId]
        );

        await client.query('COMMIT');
        return { id: cargaId, jaExistia: false };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { montarOuObterRota };
