const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const authMiddleware = require('./middleware/auth');
const SeedService = require('./services/SeedService');
const AgendadorLembretes = require('./services/AgendadorLembretes');
require('dotenv').config();

const app = express();
// Confiar no reverse proxy (ex: Easypanel/Traefik) para o express-rate-limit obter os IPs corretos
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// CORS configurado - DEVE vir ANTES do helmet para permitir preflight
//
// FRONTEND_URL aceita VARIAS origens separadas por virgula. E o que permite
// servir o site em dois dominios ao mesmo tempo durante uma troca — o antigo
// continua funcionando enquanto o novo propaga o DNS e os aparelhos migram:
//   FRONTEND_URL=https://servirmais.site,https://designacoes.jricardodev.com.br
// A barra final e removida porque o header Origin nunca a envia; com ela, a
// comparacao falharia em silencio e o site quebraria so em producao.
const allowedOrigins = [
    ...String(process.env.FRONTEND_URL || '')
        .split(',')
        .map(o => o.trim().replace(/\/+$/, '')),
    'http://localhost:3000',
    'http://localhost:5173'
].filter(Boolean);

console.log('CORS allowed origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sem origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Origem nao autorizada: nega o CORS (sem lancar erro para nao gerar 500).
            console.log('CORS blocked origin:', origin);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Seguranca: Headers HTTP (depois do CORS)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Seguranca: Rate limiting (1000 requests por 15 minutos por IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Muitas requisicoes, tente novamente mais tarde' }
});
app.use(limiter);

app.use(express.json());

// Middleware de autenticacao
app.use(authMiddleware);

// Imagens dos cartoes de territorio (geradas por territorio/extrair.py).
// Montado DEPOIS do authMiddleware de proposito: os cartoes ficam atras do
// login como todo o resto — o app manda o Authorization tambem no <Image>.
//
// Cache-Control PRIVATE, nao o "public" padrao do serve-static: a resposta so
// existe porque a requisicao levou Authorization, e "public" autorizaria um
// CDN/proxy futuro a semear cache compartilhado e servir o cartao sem login.
app.use('/territorios/arquivos', express.static(
    path.join(__dirname, '..', 'public', 'territorios'),
    {
        cacheControl: false,
        setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=86400'),
    }
));

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
    // Depois do seed: e ele que cria/corrige o vinculo usuario-irmao de que o lembrete depende.
    AgendadorLembretes.iniciar();
});
