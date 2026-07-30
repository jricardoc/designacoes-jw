const express = require('express');
const rateLimit = require('express-rate-limit');
const ConfigController = require('./controllers/ConfigController');
const AuthController = require('./controllers/AuthController');
const IrmaoController = require('./controllers/IrmaoController');
const IndisponibilidadeController = require('./controllers/IndisponibilidadeController');
const QuadroController = require('./controllers/QuadroController');
const HistoricoController = require('./controllers/HistoricoController');
const UsuarioController = require('./controllers/UsuarioController');
const EstatisticasController = require('./controllers/EstatisticasController');
const ReuniaoController = require('./controllers/ReuniaoController');
const SaidaCampoController = require('./controllers/SaidaCampoController');
const DirigentesController = require('./controllers/DirigentesController');
const MinhasDesignacoesController = require('./controllers/MinhasDesignacoesController');
const CarrinhoController = require('./controllers/CarrinhoController');
const PushTokenController = require('./controllers/PushTokenController');
const PreferenciaNotificacaoController = require('./controllers/PreferenciaNotificacaoController');
const requireAdmin = require('./middleware/requireAdmin');
const multer = require('multer');

// Limite de 5MB no upload da programacao para evitar exaustao de memoria (memoryStorage).
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// Rate limit dedicado ao login: mitiga brute force (o limite global e alto demais para isso).
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false
});

const routes = express.Router();

// ==================== AUTH (Publico) ====================
routes.post('/auth/login', loginLimiter, AuthController.login);

// ==================== AUTH (Protegido) ====================
routes.get('/auth/me', AuthController.me);
routes.put('/auth/senha', AuthController.alterarSenha);
routes.put('/auth/nome', AuthController.alterarNome);

// ==================== USUARIOS (Admin) ====================
routes.get('/usuarios', requireAdmin, UsuarioController.index);
routes.get('/usuarios/irmaos-disponiveis', requireAdmin, UsuarioController.irmaosDisponiveis);
routes.post('/usuarios', requireAdmin, UsuarioController.create);
routes.put('/usuarios/:id/irmao', requireAdmin, UsuarioController.vincularIrmao);
routes.put('/usuarios/nickname', UsuarioController.updateNickname);
routes.put('/usuarios/:id/admin', requireAdmin, UsuarioController.toggleAdmin);
routes.put('/usuarios/:id/reset-senha', requireAdmin, UsuarioController.resetSenha);
routes.delete('/usuarios/:id', requireAdmin, UsuarioController.delete);

// ==================== CONFIG ====================
routes.get('/config', ConfigController.getConfig);
routes.put('/config', requireAdmin, ConfigController.updateConfig);
routes.post('/config/reset', requireAdmin, ConfigController.resetDatabase);

// ==================== QUADROS ====================
routes.get('/quadros', QuadroController.index);
routes.post('/quadros', QuadroController.create);

// Designacoes dentro de um quadro (ANTES das rotas com :id)
routes.put('/quadros/designacao', QuadroController.updateDesignacao);
routes.put('/quadros/data', QuadroController.updateData);
routes.put('/quadros/dia', QuadroController.updateDia);
routes.delete('/quadros/dias', QuadroController.deleteDia);

// Rotas com parametro :id (DEPOIS das rotas especificas)
routes.get('/quadros/:id', QuadroController.show);
routes.put('/quadros/:id', QuadroController.update);
routes.delete('/quadros/:id', requireAdmin, QuadroController.delete);

// ==================== CARRINHO DE PUBLICACOES ====================
routes.get('/carrinho', CarrinhoController.index);
// Achatada e filtravel por dia/hora: e o formato que a automacao de lembretes
// (n8n + Evolution API) consome.
routes.get('/carrinho/agenda', CarrinhoController.agenda);

routes.post('/carrinho/pontos', CarrinhoController.criarPonto);
routes.put('/carrinho/pontos/:id', CarrinhoController.atualizarPonto);
routes.delete('/carrinho/pontos/:id', requireAdmin, CarrinhoController.excluirPonto);

routes.post('/carrinho/turnos', CarrinhoController.criarTurno);
routes.put('/carrinho/turnos/:id', CarrinhoController.atualizarTurno);
routes.delete('/carrinho/turnos/:id', CarrinhoController.excluirTurno);

routes.post('/carrinho/publicadores', CarrinhoController.criarPublicador);
routes.put('/carrinho/publicadores/:id', CarrinhoController.atualizarPublicador);
routes.delete('/carrinho/publicadores/:id', requireAdmin, CarrinhoController.excluirPublicador);

// ==================== MINHAS DESIGNACOES ====================
routes.get('/minhas-designacoes', MinhasDesignacoesController.index);

// ==================== PUSH ====================
// O aparelho registra o token no login e apaga no logout; o lembrete das 19h
// (AgendadorLembretes) so alcanca quem tem token gravado aqui.
routes.post('/push/token', PushTokenController.registrar);
routes.delete('/push/token', PushTokenController.remover);
// Dispara o lembrete na hora, para conferir sem esperar o horario. Admin: manda push de verdade.
routes.post('/push/testar', requireAdmin, PushTokenController.testar);

// O que cada irmao quer receber e com quanta antecedencia. Sempre do usuario logado: nao ha
// rota para mexer na preferencia dos outros, nem para admin.
routes.get('/push/preferencias', PreferenciaNotificacaoController.show);
routes.put('/push/preferencias', PreferenciaNotificacaoController.update);

// ==================== HISTORICO ====================
routes.get('/historico', HistoricoController.index);
routes.get('/historico/quadro/:quadroId', HistoricoController.porQuadro);
routes.get('/historico/estatisticas/:quadroId?', HistoricoController.estatisticas);

// ==================== ESTATISTICAS GLOBAIS (DASHBOARD) ====================
routes.get('/estatisticas', EstatisticasController.getEstatisticasGlobais);

// ==================== IRMAOS ====================
routes.get('/irmaos', IrmaoController.index);
routes.get('/irmaos/:id', IrmaoController.show);
routes.post('/irmaos', IrmaoController.create);
routes.put('/irmaos/:id', IrmaoController.update);
routes.delete('/irmaos/:id', requireAdmin, IrmaoController.delete);
routes.post('/irmaos/:id/funcao', IrmaoController.addFuncao);
routes.delete('/irmaos/:id/funcao', IrmaoController.removeFuncao);
routes.get('/irmaos/funcao/:funcao', IrmaoController.porFuncao);

// ==================== INDISPONIBILIDADES ====================
routes.get('/indisponibilidades', IndisponibilidadeController.index);
routes.get('/indisponibilidades/irmao/:irmaoId', IndisponibilidadeController.porIrmao);
routes.get('/indisponibilidades/data/:data', IndisponibilidadeController.porData);
routes.get('/indisponibilidades/verificar/:irmaoId/:data', IndisponibilidadeController.verificar);
routes.post('/indisponibilidades', IndisponibilidadeController.create);
routes.post('/indisponibilidades/batch', IndisponibilidadeController.createMany);
routes.put('/indisponibilidades/:id', IndisponibilidadeController.update);
routes.delete('/indisponibilidades/:id', IndisponibilidadeController.delete);
routes.delete('/indisponibilidades/irmao/:irmaoId/data/:data', IndisponibilidadeController.deleteByIrmaoData);
routes.delete('/indisponibilidades/irmao/:irmaoId/clear', IndisponibilidadeController.clearByIrmao);

// ==================== REUNIOES (Import Excel/PDF) ====================
routes.get('/reunioes', ReuniaoController.index);
routes.post('/reunioes/import', upload.single('file'), ReuniaoController.import);
routes.post('/reunioes/indisponibilidades', ReuniaoController.aplicarIndisponibilidades);
routes.delete('/reunioes/:id', requireAdmin, ReuniaoController.delete);
routes.put('/reunioes/semanas/:id', ReuniaoController.updateSemana);

// ==================== SAÍDAS DE CAMPO ====================
routes.get('/saidas-campo', SaidaCampoController.index);
routes.post('/saidas-campo', SaidaCampoController.create);
routes.put('/saidas-campo/:id', SaidaCampoController.update);
routes.delete('/saidas-campo/:id', requireAdmin, SaidaCampoController.delete);

// ==================== ESCALA DE DIRIGENTES ====================
routes.get('/dirigentes/quadros', DirigentesController.indexQuadros);
routes.post('/dirigentes/quadros', DirigentesController.createQuadro);
routes.get('/dirigentes/quadros/:id', DirigentesController.showQuadro);
routes.delete('/dirigentes/quadros/:id', requireAdmin, DirigentesController.deleteQuadro);
routes.put('/dirigentes/quadros/:id/status', DirigentesController.updateStatus);
routes.post('/dirigentes/quadros/:id/regerar', DirigentesController.regerarQuadro);

routes.put('/dirigentes/escala', DirigentesController.updateEscala);
routes.delete('/dirigentes/escala/dia', DirigentesController.deleteDia);
routes.delete('/dirigentes/escala/semana', DirigentesController.deleteSemana);

routes.get('/dirigentes/disponibilidade/:irmaoId', DirigentesController.getDisponibilidade);
routes.put('/dirigentes/disponibilidade', DirigentesController.updateDisponibilidade);

module.exports = routes;
