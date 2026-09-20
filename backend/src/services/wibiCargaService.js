const { getWibiPool, sql } = require('../db/wibi');

/**
 * Busca uma carga no WiBi pelo número (t_carga.ca_id) e monta a lista de
 * paradas (clientes) com endereço/GPS/telefone, além do veículo.
 *
 * Cadeia de tabelas confirmada manualmente em 2026-09-20 (ver histórico do
 * projeto): t_carga -> t_carga_vendas -> t_vendas -> t_clientes ->
 * t_entidades / t_enderecos, e t_carga -> t_veiculos -> t_patrimonio (placa).
 *
 * Só leitura — este sistema nunca grava no banco do WiBi.
 */
async function getCargaByNumero(caId) {
    const pool = await getWibiPool();

    const cargaResult = await pool.request()
        .input('caId', sql.Int, caId)
        .query(`
            SELECT ca.ca_id, ca.ca_status, ca.ca_data_entrega, ca.ca_data_final,
                   ca.ca_km_prevista, ca.ca_peso, ca.ve_codigo,
                   pm.pm_placa, pm.pm_descricao, pm.pm_marca, pm.pm_modelo
            FROM dbo.t_carga ca
            LEFT JOIN dbo.t_veiculos v ON v.ve_codigo = ca.ve_codigo
            LEFT JOIN dbo.t_patrimonio pm ON pm.pm_codigo = v.pm_codigo
            WHERE ca.ca_id = @caId
        `);

    if (cargaResult.recordset.length === 0) {
        return null;
    }
    const carga = cargaResult.recordset[0];

    const paradasResult = await pool.request()
        .input('caId', sql.Int, caId)
        .query(`
            SELECT cv.vd_codigo, v.cl_codigo, v.vd_status, v.vd_data_entrega,
                   cl.en_codigo, cl.cl_latitude, cl.cl_longitude,
                   cl.cl_h_inicial_entrega, cl.cl_h_final_entrega,
                   en.en_nome_completo, en.en_nome_abreviado,
                   en.en_fone_1, en.en_fone_2, en.en_fone_3,
                   ed.ed_endereco_completo, ed.ed_logradouro, ed.ed_numero,
                   ed.ed_complemento, ed.ed_ponto_ref, ed.ed_cep,
                   ed.ed_latitude, ed.ed_longitude, ed.ed_error
            FROM dbo.t_carga_vendas cv
            JOIN dbo.t_vendas v ON v.vd_codigo = cv.vd_codigo
            LEFT JOIN dbo.t_clientes cl ON cl.cl_codigo = v.cl_codigo
            LEFT JOIN dbo.t_entidades en ON en.en_codigo = cl.en_codigo
            LEFT JOIN dbo.t_enderecos ed ON ed.en_codigo = cl.en_codigo
            WHERE cv.ca_id = @caId
            ORDER BY cv.vd_codigo
        `);

    const paradas = paradasResult.recordset.map((row) => {
        // Prioriza o GPS geocodado de t_enderecos; cai para t_clientes se faltar.
        const latitude = parseFloat(row.ed_latitude ?? row.cl_latitude) || null;
        const longitude = parseFloat(row.ed_longitude ?? row.cl_longitude) || null;

        return {
            vdCodigo: row.vd_codigo,
            clCodigo: row.cl_codigo,
            vdStatus: row.vd_status,
            clienteNome: row.en_nome_completo || row.en_nome_abreviado || null,
            telefone: row.en_fone_1 || row.en_fone_2 || row.en_fone_3 || null,
            endereco: row.ed_endereco_completo
                || [row.ed_logradouro, row.ed_numero, row.ed_complemento].filter(Boolean).join(', ') || null,
            pontoReferencia: row.ed_ponto_ref || null,
            cep: row.ed_cep || null,
            latitude,
            longitude,
            gpsComErro: !!row.ed_error,
            janelaEntrega: {
                inicio: row.cl_h_inicial_entrega || null,
                fim: row.cl_h_final_entrega || null
            }
        };
    });

    return {
        caId: carga.ca_id,
        status: carga.ca_status,
        dataEntrega: carga.ca_data_entrega,
        dataFinal: carga.ca_data_final,
        kmPrevista: carga.ca_km_prevista,
        peso: carga.ca_peso,
        veiculo: carga.pm_placa
            ? {
                placa: carga.pm_placa,
                descricao: carga.pm_descricao,
                marca: carga.pm_marca,
                modelo: carga.pm_modelo
            }
            : null,
        paradas
    };
}

module.exports = { getCargaByNumero };
