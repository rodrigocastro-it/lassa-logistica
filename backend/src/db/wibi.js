const sql = require('mssql');
require('dotenv').config();

// Conexão com o banco do ERP WiBi. Este sistema NUNCA escreve nesse banco —
// o usuário configurado em WIBI_DB_USER deve ter permissão só de leitura.
const config = {
    user: process.env.WIBI_DB_USER,
    password: process.env.WIBI_DB_PASSWORD,
    server: process.env.WIBI_DB_SERVER,
    port: parseInt(process.env.WIBI_DB_PORT, 10),
    database: process.env.WIBI_DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool;

async function getWibiPool() {
    if (!pool) {
        pool = await sql.connect(config);
    }
    return pool;
}

module.exports = { getWibiPool, sql };
