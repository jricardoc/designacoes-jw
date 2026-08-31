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
const CumprimentoController = require('./controllers/CumprimentoController');
const ConfirmacaoController = require('./controllers/ConfirmacaoController');
const GrupoCampoController = require('./controllers/GrupoCampoController');
const TerritorioController = require('./controllers/TerritorioController');
const PushTokenController = require('./controllers/PushTokenController');
const TarefasController = require('./controllers/TarefasController');
const PreferenciaNotificacaoController = require('./controllers/PreferenciaNotificacaoController');
const requireAdmin = require('./middleware/requireAdmin');
const { ESCOPOS, requireEscopo } = require('./middleware/escopos');
// Leitura e livre para qualquer irmao logado; escrita exige o escopo da area
// (ou admin geral, que contempla todos). Ver src/middleware/escopos.js.
const podeDesignacoes = requireEscopo(ESCOPOS.DESIGNACOES);
const podeDirigentes = requireEscopo(ESCOPOS.DIRIGENTES);
const podeReunioes = requireEscopo(ESCOPOS.REUNIOES);
const podeCarrinho = requireEscopo(ESCOPOS.CARRINHO);
const podeConfirmacoes = requireEscopo(ESCOPOS.CONFIRMACOES);
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
// Niveis de admin por area (designacoes, dirigentes, reunioes, carrinho). Quem
// concede e sempre o admin geral. Ver src/middleware/escopos.js.
routes.put('/usuarios/:id/escopos', requireAdmin, UsuarioController.atualizarEscopos);
// Tarefas do sistema (link do Zoom, montar os quadros, confirmacoes, compartilhar o quadro).
// Separadas dos escopos de proposito: escopo diz onde a pessoa PODE mexer, tarefa diz o que
// ela DEVE fazer. Ver src/services/RegrasTarefas.js.
routes.get('/usuarios/:id/tarefas', requireAdmin, TarefasController.doUsuario);
routes.put('/usuarios/:id/tarefas', requireAdmin, TarefasController.definir);
// Catalogo dos escopos, para a tela desenhar as opcoes sem duplicar os textos.
routes.get('/usuarios/escopos/catalogo', requireAdmin, UsuarioController.catalogoEscopos);
routes.put('/usuarios/:id/reset-senha', requireAdmin, UsuarioController.resetSenha);
routes.delete('/usuarios/:id', requireAdmin, UsuarioController.delete);

// ==================== CONFIG ====================
routes.get('/config', ConfigController.getConfig);
routes.put('/config', requireAdmin, ConfigController.updateConfig);
routes.post('/config/reset', requireAdmin, ConfigController.resetDatabase);

// ==================== QUADROS ====================
// Leitura livre; toda escrita e admin — usuario comum ve os quadros, nao mexe.
routes.get('/quadros', QuadroController.index);
routes.post('/quadros', podeDesignacoes, QuadroController.create);

// Designacoes dentro de um quadro (ANTES das rotas com :id)
routes.put('/quadros/designacao', podeDesignacoes, QuadroController.updateDesignacao);
routes.put('/quadros/data', podeDesignacoes, QuadroController.updateData);
routes.put('/quadros/dia', podeDesignacoes, QuadroController.updateDia);
routes.delete('/quadros/dias', podeDesignacoes, QuadroController.deleteDia);

// Rotas com parametro :id (DEPOIS das rotas especificas)
routes.get('/quadros/:id', QuadroController.show);
routes.put('/quadros/:id', podeDesignacoes, QuadroController.update);
routes.delete('/quadros/:id', podeDesignacoes, QuadroController.delete);

// ==================== CARRINHO DE PUBLICACOES ====================
routes.get('/carrinho', CarrinhoController.index);
// Achatada e filtravel por dia/hora: e o formato que a automacao de lembretes
// (n8n + Evolution API) consome.
routes.get('/carrinho/agenda', CarrinhoController.agenda);

routes.post('/carrinho/pontos', podeCarrinho, CarrinhoController.criarPonto);
routes.put('/carrinho/pontos/:id', podeCarrinho, CarrinhoController.atualizarPonto);
routes.delete('/carrinho/pontos/:id', podeCarrinho, CarrinhoController.excluirPonto);

routes.post('/carrinho/turnos', podeCarrinho, CarrinhoController.criarTurno);
routes.put('/carrinho/turnos/:id', podeCarrinho, CarrinhoController.atualizarTurno);
routes.delete('/carrinho/turnos/:id', podeCarrinho, CarrinhoController.excluirTurno);

routes.post('/carrinho/publicadores', podeCarrinho, CarrinhoController.criarPublicador);
routes.put('/carrinho/publicadores/:id', podeCarrinho, CarrinhoController.atualizarPublicador);
routes.delete('/carrinho/publicadores/:id', podeCarrinho, CarrinhoController.excluirPublicador);

// ==================== MINHAS DESIGNACOES ====================
routes.get('/minhas-designacoes', MinhasDesignacoesController.index);

// ==================== TAREFAS DO SISTEMA ====================
// A lista e sempre do PROPRIO usuario logado: nao ha rota para ver nem concluir a tarefa
// de outro irmao. Atribuir e do admin geral e mora junto de /usuarios, mais abaixo.
routes.get('/tarefas', TarefasController.index);
// POST e nao DELETE para o desfazer porque os dois mandam corpo (tipo + ocorrencia), e
// corpo em DELETE nao atravessa proxy de forma confiavel.
routes.post('/tarefas/concluir', TarefasController.concluir);
// Catalogo aberto a quem esta logado: sao os mesmos textos que a tela do admin desenha, e
// nenhum deles e informacao reservada.
routes.get('/tarefas/catalogo', TarefasController.catalogo);
// Painel do admin geral: como a congregacao inteira esta indo. Fora do escopo de qualquer
// area — quem cobra tarefa e quem distribui tarefa, e isso e do admin geral.
routes.get('/tarefas/painel', requireAdmin, TarefasController.painel);
routes.post('/tarefas/lembrar', requireAdmin, TarefasController.lembrar);

// ==================== PUSH ====================
// O aparelho registra o token no login e apaga no logout; o lembrete das 19h
// (AgendadorLembretes) so alcanca quem tem token gravado aqui.
routes.post('/push/token', PushTokenController.registrar);
routes.delete('/push/token', PushTokenController.remover);
// A copia servidor de cada aviso enviado — e dela que a central do app se
// reconstroi quando o push chegou com o aparelho fechado.
routes.get('/push/historico', PushTokenController.historico);
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

// ==================== CUMPRIMENTO DE PARTICIPACOES ====================
// Marcar (o V/X ao lado do nome) segue o escopo da area da tela, e VER tambem:
// a avaliacao e restrita a quem cuida daquela area. Alem do gate do GET abaixo,
// as leituras do quadro (QuadroController.show e DirigentesController.showQuadro)
// podam os campos cumpriu* de quem nao tem o escopo — esconder so na tela deixaria
// o dado a um F12 de distancia.
routes.get('/cumprimento', requireEscopo(ESCOPOS.DESIGNACOES, ESCOPOS.DIRIGENTES), CumprimentoController.index);
routes.put('/quadros/designacao/cumprimento', podeDesignacoes, CumprimentoController.marcarDesignacao);
routes.put('/dirigentes/escala/cumprimento', podeDirigentes, CumprimentoController.marcarEscala);

// ==================== CONFIRMACAO DAS PARTES DE ESTUDANTE ====================
// Area propria: quem fala com os estudantes toda semana nao e necessariamente quem
// importa a programacao. LEITURA tambem exige o escopo — a lista traz telefone
// (no link de WhatsApp) e quem confirmou ou recusou, que nao e informacao de todos.
routes.get('/confirmacoes', podeConfirmacoes, ConfirmacaoController.index);
routes.put('/confirmacoes', podeConfirmacoes, ConfirmacaoController.registrar);
// O WhatsApp de quem tem parte, gravado da propria tela. Rota estreita de proposito: mexe SO
// no telefone, e por isso pode viver no escopo de confirmacoes em vez de exigir admin geral.
routes.put('/confirmacoes/telefone', podeConfirmacoes, ConfirmacaoController.salvarTelefone);

// ==================== GRUPOS DE CAMPO ====================
// Leitura livre: a tela de cadastro precisa da lista para montar o seletor, e nome de grupo
// nao e informacao reservada. Gestao e do admin geral, junto do resto do cadastro.
routes.get('/grupos', GrupoCampoController.index);
routes.post('/grupos', requireAdmin, GrupoCampoController.create);
routes.put('/grupos/:id', requireAdmin, GrupoCampoController.update);
routes.delete('/grupos/:id', requireAdmin, GrupoCampoController.delete);

// ==================== IRMAOS ====================
// Leitura livre (o seletor de designacao precisa da lista); cadastro e admin.
routes.get('/irmaos', IrmaoController.index);
routes.get('/irmaos/:id', IrmaoController.show);
routes.post('/irmaos', requireAdmin, IrmaoController.create);
routes.put('/irmaos/:id', requireAdmin, IrmaoController.update);
routes.delete('/irmaos/:id', requireAdmin, IrmaoController.delete);
routes.post('/irmaos/:id/funcao', requireAdmin, IrmaoController.addFuncao);
routes.delete('/irmaos/:id/funcao', requireAdmin, IrmaoController.removeFuncao);
routes.get('/irmaos/funcao/:funcao', IrmaoController.porFuncao);

// ==================== INDISPONIBILIDADES ====================
routes.get('/indisponibilidades', IndisponibilidadeController.index);
routes.get('/indisponibilidades/irmao/:irmaoId', IndisponibilidadeController.porIrmao);
routes.get('/indisponibilidades/data/:data', IndisponibilidadeController.porData);
routes.get('/indisponibilidades/verificar/:irmaoId/:data', IndisponibilidadeController.verificar);
// Escrita e admin: indisponibilidade so e marcada no editor de irmao e na
// importacao da programacao, ambos restritos.
routes.post('/indisponibilidades', requireAdmin, IndisponibilidadeController.create);
routes.post('/indisponibilidades/batch', requireAdmin, IndisponibilidadeController.createMany);
routes.put('/indisponibilidades/:id', requireAdmin, IndisponibilidadeController.update);
routes.delete('/indisponibilidades/:id', requireAdmin, IndisponibilidadeController.delete);
routes.delete('/indisponibilidades/irmao/:irmaoId/data/:data', requireAdmin, IndisponibilidadeController.deleteByIrmaoData);
routes.delete('/indisponibilidades/irmao/:irmaoId/clear', requireAdmin, IndisponibilidadeController.clearByIrmao);

// ==================== REUNIOES (Import Excel/PDF) ====================
routes.get('/reunioes', ReuniaoController.index);
routes.post('/reunioes/import', podeReunioes, upload.single('file'), ReuniaoController.import);
routes.post('/reunioes/indisponibilidades', podeReunioes, ReuniaoController.aplicarIndisponibilidades);
// Assistencia das reunioes: leitura livre (as estatisticas aparecem para todo
// irmao logado); escrita e exclusao exigem o escopo de reunioes. Registradas
// ANTES de DELETE /reunioes/:id para "assistencias" nunca ser lida como :id.
routes.get('/reunioes/assistencias', ReuniaoController.listarAssistencias);
routes.put('/reunioes/assistencias', podeReunioes, ReuniaoController.salvarAssistencia);
routes.delete('/reunioes/assistencias/:id', podeReunioes, ReuniaoController.excluirAssistencia);
routes.delete('/reunioes/:id', podeReunioes, ReuniaoController.delete);
routes.put('/reunioes/semanas/:id', podeReunioes, ReuniaoController.updateSemana);
// Os textos de compartilhamento sao montados no servidor (ver ConviteReuniaoService):
// assim mudar o texto ou o negrito nao exige build novo do app. Leitura, nao admin —
// compartilhar o convite e coisa de qualquer irmao.
routes.get('/reunioes/semanas/:id/compartilhamentos', ReuniaoController.compartilhamentos);
// Mensagem pronta para confirmar a designacao com quem tem parte na semana. Montada no
// backend como os convites, e pedida no toque porque a saudacao depende da hora.
routes.get('/reunioes/confirmacao', ReuniaoController.textoConfirmacao);

// ==================== TERRITORIOS ====================
// Leitura livre para logado; as imagens em /territorios/arquivos tambem exigem
// login (express.static montado depois do authMiddleware em index.js).
routes.get('/territorios', TerritorioController.index);

// ==================== SAÍDAS DE CAMPO ====================
routes.get('/saidas-campo', SaidaCampoController.index);
routes.post('/saidas-campo', podeDirigentes, SaidaCampoController.create);
routes.put('/saidas-campo/:id', podeDirigentes, SaidaCampoController.update);
routes.delete('/saidas-campo/:id', podeDirigentes, SaidaCampoController.delete);

// ==================== ESCALA DE DIRIGENTES ====================
routes.get('/dirigentes/quadros', DirigentesController.indexQuadros);
routes.post('/dirigentes/quadros', podeDirigentes, DirigentesController.createQuadro);
routes.get('/dirigentes/quadros/:id', DirigentesController.showQuadro);
routes.delete('/dirigentes/quadros/:id', podeDirigentes, DirigentesController.deleteQuadro);
routes.put('/dirigentes/quadros/:id/status', podeDirigentes, DirigentesController.updateStatus);
routes.post('/dirigentes/quadros/:id/regerar', podeDirigentes, DirigentesController.regerarQuadro);

routes.put('/dirigentes/escala', podeDirigentes, DirigentesController.updateEscala);
routes.delete('/dirigentes/escala/dia', podeDirigentes, DirigentesController.deleteDia);
routes.delete('/dirigentes/escala/semana', podeDirigentes, DirigentesController.deleteSemana);

routes.get('/dirigentes/disponibilidade/:irmaoId', DirigentesController.getDisponibilidade);
routes.put('/dirigentes/disponibilidade', podeDirigentes, DirigentesController.updateDisponibilidade);

module.exports = routes;
