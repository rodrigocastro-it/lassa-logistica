const fs = require('fs');
const path = require('path');
const { pool } = require('./pg');

async function migrate() {
    const dir = path.join(__dirname, '..', '..', 'migrations');
    const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

    for (const arquivo of arquivos) {
        const sqlText = fs.readFileSync(path.join(dir, arquivo), 'utf8');
        await pool.query(sqlText);
        console.log(`✅ Migração aplicada: ${arquivo}`);
    }
    await pool.end();
}

migrate().catch((err) => {
    console.error('❌ Erro ao migrar:', err.message);
    process.exit(1);
});
