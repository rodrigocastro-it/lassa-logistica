const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Para-quedas: um erro não tratado numa rota (promise rejeitada sem
// try/catch) não pode derrubar o processo inteiro — isso tiraria o app do
// ar pra TODOS os motoristas até o Docker reiniciar o container (é o que
// causava os "Erro 521" vistos pelo Cloudflare Worker: o backend estava
// fora do ar bem na hora da requisição).
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection (processo seguiu rodando):', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception (processo seguiu rodando):', err);
});

const authRoutes = require('./routes/auth');
const cargasRoutes = require('./routes/cargas');
const paradasRoutes = require('./routes/paradas');
const dashboardRoutes = require('./routes/dashboard');
const pointtrackRoutes = require('./routes/pointtrack');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/cargas', cargasRoutes);
app.use('/api/paradas', paradasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pointtrack', pointtrackRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Error handler de último caso (erros síncronos ou passados via next(err)).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Erro não tratado numa rota:', err);
    if (res.headersSent) return;
    res.status(500).json({ erro: 'Erro interno no servidor.' });
});

const port = process.env.PORT || 8788;
app.listen(port, () => {
    console.log(`🚚 Lassa Logística API rodando na porta ${port}`);
});
