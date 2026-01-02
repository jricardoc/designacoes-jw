const express = require('express');
const ConfigController = require('./controllers/ConfigController');
const AuthController = require('./controllers/AuthController');
const IrmaoController = require('./controllers/IrmaoController');
const IndisponibilidadeController = require('./controllers/IndisponibilidadeController');
const QuadroController = require('./controllers/QuadroController');
const HistoricoController = require('./controllers/HistoricoController');
const UsuarioController = require('./controllers/UsuarioController');

const routes = express.Router();

// ==================== AUTH (Publico) ====================
routes.post('/auth/login', AuthController.login);

// ==================== AUTH (Protegido) ====================
routes.get('/auth/me', AuthController.me);
routes.put('/auth/senha', AuthController.alterarSenha);
routes.put('/auth/nome', AuthController.alterarNome);

// ==================== USUARIOS (Admin) ====================
routes.get('/usuarios', UsuarioController.index);
routes.post('/usuarios', UsuarioController.create);
routes.put('/usuarios/nickname', UsuarioController.updateNickname);
routes.put('/usuarios/:id/admin', UsuarioController.toggleAdmin);
routes.put('/usuarios/:id/reset-senha', UsuarioController.resetSenha);
routes.delete('/usuarios/:id', UsuarioController.delete);

// ==================== CONFIG ====================
routes.get('/config', ConfigController.getConfig);
routes.put('/config', ConfigController.updateConfig);
routes.post('/config/reset', ConfigController.resetDatabase);

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
routes.delete('/quadros/:id', QuadroController.delete);

// ==================== HISTORICO ====================
routes.get('/historico', HistoricoController.index);
routes.get('/historico/quadro/:quadroId', HistoricoController.porQuadro);
routes.get('/historico/estatisticas/:quadroId?', HistoricoController.estatisticas);

// ==================== IRMAOS ====================
routes.get('/irmaos', IrmaoController.index);
routes.get('/irmaos/:id', IrmaoController.show);
routes.post('/irmaos', IrmaoController.create);
routes.put('/irmaos/:id', IrmaoController.update);
routes.delete('/irmaos/:id', IrmaoController.delete);
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

module.exports = routes;
