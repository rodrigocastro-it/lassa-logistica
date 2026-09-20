const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const cargasRoutes = require('./routes/cargas');
const paradasRoutes = require('./routes/paradas');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/cargas', cargasRoutes);
app.use('/api/paradas', paradasRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 8788;
app.listen(port, () => {
    console.log(`🚚 Lassa Logística API rodando na porta ${port}`);
});
