const fs = require('fs');
const path = require('path');
const { pool } = require('./pg');

async function migrate() {
    const sqlPath = path.join(__dirname, '..', '..', 'migrations', '001_init.sql');
    const sqlText = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sqlText);
    console.log('✅ Migração aplicada com sucesso.');
    await pool.end();
}

migrate().catch((err) => {
    console.error('❌ Erro ao migrar:', err.message);
    process.exit(1);
});
