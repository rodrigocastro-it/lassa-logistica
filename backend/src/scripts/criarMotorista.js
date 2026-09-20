// Uso: node src/scripts/criarMotorista.js "Nome do Motorista" usuario senha
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pg');

async function main() {
    const [, , nome, usuario, senha] = process.argv;
    if (!nome || !usuario || !senha) {
        console.error('Uso: node src/scripts/criarMotorista.js "Nome" usuario senha');
        process.exit(1);
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
        `INSERT INTO motoristas (nome, usuario, senha_hash) VALUES ($1, $2, $3)
         ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, nome = EXCLUDED.nome
         RETURNING id, nome, usuario`,
        [nome, usuario, senhaHash]
    );
    console.log('✅ Motorista criado/atualizado:', result.rows[0]);
    await pool.end();
}

main().catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
