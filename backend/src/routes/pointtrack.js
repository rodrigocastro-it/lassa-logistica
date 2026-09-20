const express = require('express');
const { obterPosicaoPorPlaca } = require('../services/pointTrackService');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

router.get('/posicao/:placa', async (req, res) => {
    try {
        const posicao = await obterPosicaoPorPlaca(req.params.placa);
        if (!posicao) {
            return res.status(404).json({ erro: 'Veículo não encontrado na Point Track.' });
        }
        res.json(posicao);
    } catch (err) {
        console.error('Erro ao consultar Point Track:', err);
        res.status(502).json({ erro: 'Falha ao consultar a Point Track.' });
    }
});

module.exports = router;
