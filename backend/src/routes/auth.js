const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pg');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
        return res.status(400).json({ erro: 'Informe usuário e senha.' });
    }

    const result = await pool.query(
        'SELECT id, nome, usuario, senha_hash, ativo FROM motoristas WHERE usuario = $1',
        [usuario]
    );
    const motorista = result.rows[0];

    if (!motorista || !motorista.ativo) {
        return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    const senhaOk = await bcrypt.compare(senha, motorista.senha_hash);
    if (!senhaOk) {
        return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    const token = jwt.sign(
        { id: motorista.id, nome: motorista.nome, usuario: motorista.usuario },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );

    res.json({ token, motorista: { id: motorista.id, nome: motorista.nome, usuario: motorista.usuario } });
});

module.exports = router;
