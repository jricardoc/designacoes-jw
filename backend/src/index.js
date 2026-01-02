const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const authMiddleware = require('./middleware/auth');
const SeedService = require('./services/SeedService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configurado - DEVE vir ANTES do helmet para permitir preflight
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Seguranca: Headers HTTP (depois do CORS)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Seguranca: Rate limiting (100 requests por 15 minutos por IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisicoes, tente novamente mais tarde' }
});
app.use(limiter);

app.use(express.json());

// Middleware de autenticacao
app.use(authMiddleware);

// Rotas da API
app.use('/', routes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    // Executa seed ao iniciar
    await SeedService.execute();
});
