/**
 * Domain types mirroring the backend Prisma models and API responses.
 */

export type StatusQuadro = "rascunho" | "publicado" | "arquivado";

export type FuncaoId =
  | "microfone"
  | "indicador"
  | "audioVideo"
  | "estacionamento"
  | "carrinho"
  | "dirigente";

export type NivelAudioVideo = "experiente" | "treinando";

/** Privilégio de serviço do irmão. Informativo por enquanto; ausente/null = nenhum. */
export type PrivilegioId = "servoMinisterial" | "anciao";

/**
 * Área que um usuário pode administrar sem ser admin geral. Espelha
 * backend/src/middleware/escopos.js.
 */
export type EscopoAdmin =
  | "designacoes"
  | "dirigentes"
  | "reunioes"
  | "carrinho"
  | "confirmacoes"
  | "territorios";

/** Uma área do catálogo de permissões, como o backend a descreve. */
export interface OpcaoEscopo {
  id: EscopoAdmin;
  label: string;
  descricao: string;
}

// --- Tarefas do sistema -----------------------------------------------------

/**
 * As tarefas que o admin geral distribui, mais a limpeza.
 *
 * `limpeza` está aqui porque ela APARECE na lista, mas ela não se atribui: vem do grupo de
 * campo do irmão. O backend recusa atribuí-la (ver RegrasTarefas.sanearTarefas), e por isso
 * ela também não entra em `TarefaAtribuivel`.
 */
export type TipoTarefa =
  | "zoom"
  | "quadroDirigentes"
  | "quadroDesignacoes"
  | "confirmacoes"
  | "compartilharQuadro"
  | "limpeza"
  /** Pedir o relatório de campo ao grupo. Vem do grupo que o irmão dirige ou ajuda. */
  | "relatorioGrupo";

/** O que o admin pode marcar na folha de tarefas — tudo menos a limpeza. */
export type TarefaAtribuivel = Exclude<TipoTarefa, "limpeza">;

/** Uma tarefa do catálogo, como o backend a descreve. */
export interface OpcaoTarefa {
  id: TarefaAtribuivel;
  label: string;
  descricao: string;
  cadencia: "reuniao" | "semana" | "mes";
  cadenciaLabel: string;
  icone: string;
}

/**
 * Uma ocorrência pendente na lista do irmão.
 *
 * `concluivel` é falso nas tarefas de quadro: elas se concluem sozinhas quando o quadro do
 * mês seguinte é publicado, e a tela não desenha botão para elas.
 */
export interface Tarefa {
  /** "zoom|2026-09-03" — estável, serve de key e identifica a ocorrência. */
  id: string;
  tipo: TipoTarefa;
  label: string;
  icone: string;
  cadencia: "reuniao" | "semana" | "mes";
  cadenciaLabel: string;
  /** `relatorio`: sai sozinha quando o grupo inteiro entrega o relatório do mês. */
  conclusao: "manual" | "quadro" | "nenhuma" | "relatorio";
  concluivel: boolean;
  /**
   * Para onde o card leva. `id` só vem quando o destino é uma tela de item — hoje só
   * `"quadro"`, que abre exatamente o quadro daquela reunião em vez da lista.
   */
  acao: { titulo: string; destino: string; id?: number } | null;
  /** A data ISO que identifica a repetição. É o que volta no "concluir". */
  ocorrencia: string;
  titulo: string;
  detalhe: string | null;
  vencimentoISO: string | null;
  /** "Vence hoje", "Atrasada há 2 dias" — montado no backend para não divergir do prazo. */
  prazo: string;
  diasAteVencer: number | null;
  situacao: SituacaoTarefa;
  /** @deprecated `situacao === "atrasada"` diz o mesmo. Mantido para builds antigos. */
  atrasada: boolean;
  grupo: { id: number; nome: string } | null;
}

/** Em que pé a tarefa está. Uma definição só, vinda do backend (ver RegrasTarefas). */
export type SituacaoTarefa = "atrasada" | "alerta" | "emDia" | "informativa";

// --- Painel do admin --------------------------------------------------------

export interface PendenciaTarefa {
  usuarioId: number;
  nome: string;
  tipo: TipoTarefa;
  label: string;
  icone: string;
  ocorrencia: string;
  titulo: string;
  detalhe: string | null;
  vencimentoISO: string | null;
  prazo: string;
  diasAteVencer: number | null;
  situacao: SituacaoTarefa;
  /** Sem aparelho registrado o lembrete não chega — a tela não oferece o botão. */
  temAparelho: boolean;
}

export interface DesempenhoDePessoa {
  usuarioId: number;
  nome: string;
  previstas: number;
  cumpridas: number;
  noPrazo: number;
  /** 0–1. */
  taxa: number;
}

export interface DesempenhoDeTarefa {
  tipo: TarefaAtribuivel;
  label: string;
  previstas: number;
  cumpridas: number;
  noPrazo: number;
  /** `null` quando não houve nenhuma ocorrência na janela — não é zero, é sem dado. */
  taxa: number | null;
}

export interface QuadroNoPainel {
  tipo: "quadroDesignacoes" | "quadroDirigentes";
  label: string;
  referencia: string;
  vencimentoISO: string;
  publicadoEm: string | null;
  publicadoPor: string | null;
  diasDeAtraso: number | null;
  /** `semRegistro` = publicado antes de o app guardar a data. Não conta como pontual. */
  situacao: "noPrazo" | "atrasado" | "semRegistro";
}

export interface MembroDaEquipe {
  id: number;
  nome: string;
  nickname: string;
  vinculado: boolean;
  temAparelho: boolean;
  tarefas: TarefaAtribuivel[];
}

export interface PainelTarefas {
  hoje: string;
  janelaDias: number;
  inicioISO: string;
  resumo: { pessoasComTarefa: number; pendentes: number; atrasadas: number; alerta: number };
  pendencias: PendenciaTarefa[];
  semResponsavel: { id: TarefaAtribuivel; label: string }[];
  desempenho: {
    geral: { previstas: number; cumpridas: number; noPrazo: number; taxa: number | null };
    porPessoa: DesempenhoDePessoa[];
    porTarefa: DesempenhoDeTarefa[];
  };
  quadros: QuadroNoPainel[];
  equipe: MembroDaEquipe[];
}

export interface RespostaTarefas {
  hoje: string;
  designadas: TarefaAtribuivel[];
  grupo: { id: number; nome: string } | null;
  tarefas: Tarefa[];
  total: number;
  atrasadas: number;
}

/** O pioneiro do cadastro: regular (50 h por mês) ou auxiliar contínuo (30 h). Quem é auxiliar só num mês marca no relatório. */
export type TipoPioneiro = "regular" | "auxiliar";

export interface Usuario {
  id: number;
  nickname: string;
  nome: string;
  /** Admin geral: contempla todos os escopos. */
  isAdmin: boolean;
  /** Áreas administráveis de quem não é admin geral. */
  escopos?: EscopoAdmin[];
  /**
   * Tarefas de sistema atribuídas a ele. Só vem na listagem do admin (`GET /usuarios`) —
   * o irmão comum lê as próprias em `GET /tarefas`, que traz as ocorrências e os prazos.
   */
  tarefas?: TarefaAtribuivel[];
  createdAt?: string;
  /**
   * Cargo resolvido no backend cruzando o nome do usuário com o cadastro de irmãos.
   * Não existe FK entre Usuario e Irmao — ver backend/src/services/PrivilegioService.js.
   */
  privilegio?: PrivilegioId | null;
  /** Vínculo com o cadastro da congregação. Sem ele não há "Minhas Designações". */
  irmaoId?: number | null;
  irmao?: {
    id: number;
    nome: string;
    funcoes: FuncaoId[];
    pioneiro?: TipoPioneiro | null;
    /** Os grupos de campo que ele dirige ou ajuda: liberam a tela de Grupos. */
    gruposQueLidera?: number[];
    /** É o secretário: vê todos os grupos e o relatório da congregação. */
    secretario?: boolean;
  } | null;
  /** Quando a foto de perfil mudou (ISO); null/ausente = sem foto, mostra as iniciais. */
  fotoEm?: string | null;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface Config {
  id: number;
  titulo: string;
  subtitulo: string;
  mes: string;
  /** "HH:MM" — início da reunião, usado pelos lembretes de "N horas antes". */
  horaMeioSemana?: string;
  horaFimDeSemana?: string;
  /** Dados do Zoom que entram nos convites (Ajustes, admin geral). */
  zoom?: ConfigZoom | null;
}

export interface ZoomReuniao {
  link?: string;
  id?: string;
  senha?: string;
  /** "19:00" — quando a sala abre. */
  salaAberta?: string;
}

export interface ConfigZoom {
  meio?: ZoomReuniao;
  fds?: ZoomReuniao;
}

/** Uma opção de tipo de notificação ou de antecedência, como o backend a descreve. */
export interface OpcaoNotificacao {
  id: string;
  label: string;
  descricao: string;
}

/**
 * O catálogo (`opcoes`) vem junto de propósito: a tela desenha o que o backend oferece, em
 * vez de manter uma segunda lista aqui que sairia de sincronia com o agendador.
 */
export interface PreferenciaNotificacao {
  tipos: string[];
  antecedencias: string[];
  opcoes: {
    tipos: OpcaoNotificacao[];
    regras: OpcaoNotificacao[];
  };
  horarios: {
    meioSemana: string;
    fimDeSemana: string;
  };
}

export interface Indisponibilidade {
  id: number;
  irmaoId: number;
  data: string; // "dd/MM"
  motivo?: string | null;
  createdAt?: string;
  irmao?: { id: number; nome: string };
}

export interface DirigenteSaida {
  id: number;
  irmaoId: number;
  saidaCampoId: number;
  saidaCampo?: SaidaCampo;
}

/** Como se fala com a pessoa. Não é sexo biológico — daí o nome dos valores. */
export type GeneroPessoa = "irmao" | "irma";

/** Grupo de campo da congregação. O nome é o de quem dirige o grupo. */
export interface GrupoCampo {
  id: number;
  nome: string;
  ordem: number;
  ativo: boolean;
  _count?: { publicadores: number };
}

export interface Irmao {
  id: number;
  nome: string;
  funcoes: FuncaoId[];
  nivelAudioVideo: NivelAudioVideo;
  privilegio?: PrivilegioId | null;
  pioneiro?: TipoPioneiro | null;
  /** Só dígitos, com DDD ("71999998888"). Abre o WhatsApp já com o texto na tela de Confirmações. */
  telefone?: string | null;
  genero?: GeneroPessoa | null;
  /** O grupo de campo. É por ele que sai a limpeza do salão. */
  grupoId?: number | null;
  grupoCampo?: { id: number; nome: string } | null;
  ativo: boolean;
  indisponibilidades?: Indisponibilidade[];
  dirigenteSaidas?: DirigenteSaida[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Designacao {
  id: number;
  quadroId: number;
  data: string; // "dd/MM"
  dia: string; // "Domingo" | "Quinta" | ...
  funcao: string; // "Microfone Volante" | "Indicador" | "Audio e Video" | "Estacionamento"
  irmao1: string;
  irmao2: string;
  /** Cumprimento por irmão da linha: null/ausente = não avaliado. */
  cumpriu1?: boolean | null;
  cumpriu2?: boolean | null;
}

export interface QuadroResumo {
  id: number;
  mes: number;
  ano: number;
  titulo: string;
  status: StatusQuadro;
  createdAt: string;
  updatedAt: string;
  _count?: { designacoes: number; historicos: number };
}

export interface Quadro extends QuadroResumo {
  designacoes: Designacao[];
}

export interface Historico {
  id: number;
  quadroId: number;
  usuarioId: number;
  acao: string;
  descricao: string;
  campo?: string | null;
  valorAntigo?: string | null;
  valorNovo?: string | null;
  designacaoInfo?: string | null;
  createdAt: string;
  usuario?: { id: number; nome: string; nickname?: string };
}

export interface EstatisticasGlobais {
  totalQuadros: number;
  totalIrmaosAtivos: number;
  totalDesignacoesAtribuidas: number;
  top5Geral: { nome: string; qtd: number }[];
  menosEscaladosGeral: { nome: string; qtd: number }[];
  rankFuncoes: {
    microfone: { nome: string; qtd: number } | null;
    indicador: { nome: string; qtd: number } | null;
    audioVideo: { nome: string; qtd: number } | null;
    estacionamento: { nome: string; qtd: number } | null;
  };
}

/**
 * Só estas duas chegam ao gerador: AutoDesignacaoService.gerarDesignacoes lê exatamente
 * `respeitarIndisponibilidades` e `regraAudioVideo`. O rodízio já garante sozinho o equilíbrio
 * que as antigas regras de repetição/distribuição prometiam.
 */
export interface RegrasAutoPreenchimento {
  respeitarIndisponibilidades: boolean;
  regraAudioVideo: boolean;
}

// ===== Dirigentes / Saídas de Campo =====

export interface SaidaCampo {
  id: number;
  diaSemana: string;
  turno: number;
  local: string;
  horario: string;
  ativo: boolean;
  dirigentesDisponiveis?: { id: number; irmaoId: number; irmao?: Irmao }[];
}

export interface EscalaDirigente {
  id: number;
  quadroId: number;
  saidaCampoId: number;
  data: string; // "dd/MM"
  dia: string;
  principal: string;
  removido: boolean;
  /** null/ausente = não avaliado, true = dirigiu, false = faltou. */
  cumpriu?: boolean | null;
  saidaCampo?: SaidaCampo;
}

// ===== Cumprimento de participações =====

export type OrigemCumprimento = "designacoes" | "dirigentes";

/**
 * Uma avaliação achatada, como GET /cumprimento devolve. A tela de análise
 * agrega e filtra em cima desta lista — o backend não pré-agrega por corte.
 */
export interface RegistroCumprimento {
  nome: string;
  origem: OrigemCumprimento;
  cumpriu: boolean;
  /** "dd/MM/yyyy" — ano já resolvido pelo backend (quadro pode ter dias do ano anterior). */
  data: string;
  /** A função (designações) ou "horário · local" (dirigentes). */
  rotulo: string;
}

export interface QuadroDirigenteResumo {
  id: number;
  mes: number;
  ano: number;
  titulo: string;
  status: StatusQuadro;
  createdAt: string;
  updatedAt: string;
  _count?: { escalas: number };
}

export interface QuadroDirigente extends QuadroDirigenteResumo {
  escalas: EscalaDirigente[];
}

// ===== Territórios =====

/**
 * Um cartão de mapa de território (S-12-T). As imagens são caminhos RELATIVOS
 * da API (ex.: "/territorios/arquivos/01-mapa.jpg") e exigem o header de
 * autenticação — prefixar com API_URL e mandar o Bearer no <Image>.
 */
// ===== Territórios =====

export type SituacaoTerritorio = "concluido" | "andamento" | "nao_iniciado" | "sem_registro";
export type TipoMarcacao = "parada" | "proximo" | "concluido" | "nao_bater" | "observacao";
export type CasaTrabalhada = "sim" | "nao" | "incerto" | "outro_lugar";
/** [latitude, longitude] */
export type Ponto = [number, number];

/** O "cartão original" em imagem, quando a instalação tem a pasta de cartões. */
export interface ImagensCartao {
  mapa: string | null;
  satelite: string | null;
  thumb: string | null;
}

export interface PermissoesTerritorio {
  /** Registrar saída e marcar pontos (dirigentes e a área Territórios). */
  marcar: boolean;
  /** Importar do My Maps, editar, designar, revisar. */
  gerenciar: boolean;
}

export interface TerritorioResumo {
  /** null enquanto a instalação só tem os cartões (antes de importar do My Maps). */
  id: number | null;
  numero: string;
  nome: string;
  area: string | null;
  apelidos: string | null;
  /** Descrição livre, mostrada embaixo do título do cartão. Ausente na API antiga. */
  observacoes?: string | null;
  cor: string | null;
  quadras: number;
  situacao: SituacaoTerritorio;
  ultimaSaida: { dia: string; concluiu: boolean; autor: string | null } | null;
  diasSemTrabalho: number | null;
  naoBater: { total: number; vencidas: number };
  conflitos: number;
  designacao: { id: number; dia: string; dirigente: string } | null;
  imagens: ImagensCartao | null;
}

export interface ListaTerritorios {
  fonte: "banco" | "cartoes";
  territorios: TerritorioResumo[];
  /** Cor de cada área: a escolhida, ou uma da paleta. Ausente na API antiga. */
  cores?: Record<string, string>;
  permissoes: PermissoesTerritorio;
  /** Preenchido quando a resposta veio da cópia guardada no celular (sem internet). */
  copiaLocalDe?: string;
}

export interface Quadra {
  id: number;
  nome: string;
  cor: string | null;
  pontos: Ponto[];
}

export interface SaidaTerritorio {
  id: number;
  dia: string;
  concluiu: boolean;
  ondeParou: string | null;
  casaTrabalhada: CasaTrabalhada | null;
  proximoInicio: string | null;
  pendente: string | null;
  lat: number | null;
  lng: number | null;
  quadra: { id: number; nome: string } | null;
  autor: { id: number; nome: string } | null;
  status: "ativa" | "conflito" | "descartada";
  createdAt: string;
}

export interface MarcacaoTerritorio {
  id: number;
  clientKey: string;
  tipo: TipoMarcacao;
  lat: number | null;
  lng: number | null;
  precisao: number | null;
  texto: string | null;
  quadraId: number | null;
  marcadaEm: string;
  autor: { id: number; nome: string } | null;
  reconfirmadaEm: string | null;
  precisaReconfirmar: boolean;
}

export interface AvisoTerritorio {
  id: number;
  tipo: "acesso_impedido" | "entrada_outra_rua" | "trecho_pendente" | "outro";
  texto: string;
  createdAt: string;
}

export interface DesignacaoTerritorio {
  id: number;
  dia: string;
  concluidoEm: string | null;
  dirigente: { id: number; nome: string };
}

export interface TerritorioDetalhe {
  id: number;
  numero: string;
  nome: string;
  area: string | null;
  apelidos: string | null;
  observacoes: string | null;
  cor: string | null;
  mymaps: { mid: string; camada: string } | null;
  cicloDesde: string;
  naoIniciado: boolean;
  situacao: SituacaoTerritorio;
  quadras: Quadra[];
  ultimaSaida: SaidaTerritorio | null;
  ondeParamos: SaidaTerritorio[];
  marcacoes: MarcacaoTerritorio[];
  avisos: AvisoTerritorio[];
  designacoes: DesignacaoTerritorio[];
  conflitos: number;
  imagens: ImagensCartao | null;
  permissoes: PermissoesTerritorio;
  copiaLocalDe?: string;
}

export interface HistoricoTerritorio {
  saidas: SaidaTerritorio[];
  marcacoes: (Pick<MarcacaoTerritorio, "id" | "tipo" | "texto" | "lat" | "lng" | "marcadaEm" | "autor"> & {
    ativo: boolean;
  })[];
}

export interface MapaGeralTerritorios {
  territorios: {
    numero: string;
    nome: string;
    area?: string | null;
    situacao: SituacaoTerritorio;
    cor: string | null;
    quadras: { nome: string; pontos: Ponto[] }[];
  }[];
  /** A região de cada área (em volta das quadras dela), na cor da área. */
  areas?: { nome: string; cor: string; aneis: Ponto[][] }[];
  /** O limite do território da congregação, quando importado. */
  limite?: LimiteTerritorio | null;
}

export interface LimiteTerritorio {
  nome: string;
  cor: string | null;
  pontos: Ponto[];
}

export interface CamadaMyMaps {
  mid: string;
  nomeMapa: string;
  camada: string;
  quadras: number;
  nomesQuadras: string[];
  cor: string | null;
  territorioAtual: string | null;
  repetida: boolean;
  numeroSugerido: string | null;
}

export interface PreviaMyMaps {
  mapas: { mid: string; nome: string | null; erro: string | null }[];
  camadas: CamadaMyMaps[];
}

export interface PainelTerritorios {
  dias: number;
  resumo: {
    total: number;
    trabalhados: number;
    concluidosNoCiclo: number;
    designacoesProximos7: number;
    naoBaterVencidas: number;
    parados: number;
    conflitos: number;
  };
  maisTrabalhados: { numero: string; nome: string; dias: number }[];
  maisTempoParados: { numero: string; nome: string; dias: number | null; nunca: boolean }[];
  dirigentes: { nome: string; saidas: number; territorios: number; ultima: string }[];
  concluidos: { numero: string; nome: string; dia: string; autor: string | null }[];
  porMes: { mes: string; saidas: number }[];
}

export interface DesignacaoTerritorioLista {
  id: number;
  dia: string;
  concluidoEm: string | null;
  dirigente: { id: number; nome: string };
  territorio: { id: number; numero: string; nome: string };
}

export interface ConflitoTerritorio {
  id: number;
  dia: string;
  ondeParou: string | null;
  casaTrabalhada: CasaTrabalhada | null;
  proximoInicio: string | null;
  createdAt: string;
  territorio: { numero: string; nome: string };
  autor: { id: number; nome: string } | null;
  quadra: { nome: string } | null;
}

export interface S13 {
  ano: number;
  de: string;
  ate: string;
  territorios: {
    numero: string;
    nome: string;
    ultimaConclusao: string | null;
    designacoes: { dirigente: string; dia: string; concluidoEm: string | null }[];
  }[];
}

// ===== Reuniões =====

/**
 * Espelha `model SemanaReuniao` do Prisma. Estava faltando metade dos campos aqui — a tela
 * não tinha como mostrar "Faça Seu Melhor no Ministério", a Sala B, o conselheiro nem as
 * mecânicas de fim de semana, porque o TypeScript não sabia que eles chegavam.
 */
export interface SemanaReuniao {
  id: number;
  reuniaoId: number;
  faixaData: string;
  /** "dd/MM/yyyy" da reunião do meio de semana. O fim de semana é derivado dela. */
  dataReuniao?: string | null;
  leituraSemanal?: string | null;

  presidente?: string | null;
  conselheiroB?: string | null;
  oracaoInicial?: string | null;
  oracaoFinal?: string | null;
  canticoInicial?: string | null;
  canticoMeio?: string | null;
  canticoFinal?: string | null;

  tesouro1_titulo?: string | null;
  tesouro1_irmao?: string | null;
  tesouro2_titulo?: string | null;
  tesouro2_irmao?: string | null;
  tesouro3_titulo?: string | null;
  tesouro3_salaB?: string | null;
  tesouro3_principal?: string | null;

  ministerio1_titulo?: string | null;
  ministerio1_salaB?: string | null;
  ministerio1_principal?: string | null;
  ministerio2_titulo?: string | null;
  ministerio2_salaB?: string | null;
  ministerio2_principal?: string | null;
  ministerio3_titulo?: string | null;
  ministerio3_salaB?: string | null;
  ministerio3_principal?: string | null;
  ministerio4_titulo?: string | null;
  ministerio4_salaB?: string | null;
  ministerio4_principal?: string | null;

  vidaCrista1_titulo?: string | null;
  vidaCrista1_irmao?: string | null;
  vidaCrista2_titulo?: string | null;
  vidaCrista2_irmao?: string | null;
  estudoBiblico_dirigente?: string | null;
  estudoBiblico_leitor?: string | null;

  fds_presidente?: string | null;
  fds_tema?: string | null;
  fds_orador?: string | null;
  fds_congregacao?: string | null;
  fds_leitor?: string | null;

  mecanica_audioVideo?: string | null;
  mecanica_indicadores?: string | null;
  mecanica_microfone?: string | null;
  fds_mecanica_audioVideo?: string | null;
  fds_mecanica_indicadores?: string | null;
  fds_mecanica_microfone?: string | null;
  fds_mecanica_portao?: string | null;

  limpeza?: string | null;
}

export interface Reuniao {
  id: number;
  mes: number;
  ano: number;
  semanas: SemanaReuniao[];
  createdAt: string;
  updatedAt: string;
}

// ===== Assistência das reuniões =====

export type TipoAssistencia = "meio" | "fds";

/**
 * Espelha `model AssistenciaReuniao` do Prisma. Chaveada pela DATA da reunião,
 * não pela semana: reimportar o mês recria as semanas com ids novos, e o
 * histórico de assistência sobrevive porque não aponta para elas.
 */
export interface AssistenciaReuniao {
  id: number;
  /** "dd/MM/yyyy" — o dia da reunião contada (meio: a própria; fds: o domingo). */
  data: string;
  tipo: TipoAssistencia;
  presencial: number;
  zoom: number;
  /** Resumo da lista de quem assistiu pelo Zoom. Ausentes na API antiga. */
  zoomConexoes?: number;
  zoomPessoas?: number;
  maos?: number;
  createdAt: string;
  updatedAt: string;
}

/** Uma conexão no Zoom numa reunião. `pessoas` conta a família no mesmo aparelho. */
export interface PresencaZoom {
  id?: number;
  /** O nome do cadastro, ou como a conexão aparece no Zoom (visitante). */
  nome: string;
  irmaoId: number | null;
  pessoas: number;
  levantouMao: boolean;
}

// ===== Importação (preview de indisponibilidades) =====

export interface PreviewDataConfirmada {
  data: string; // "dd/MM"
  count: number;
  partes: string[];
  /** "alta" = nome bateu certinho (pré-marcado); "media" = sugestão (confira). */
  confianca?: "alta" | "media";
  /** Nomes da programação que geraram esse match (útil nas sugestões). */
  origem?: string[];
}

export interface IrmaoConfirmado {
  irmaoId: number;
  nome: string;
  datas: PreviewDataConfirmada[];
}

export interface NomeAmbiguo {
  nomeOriginal: string;
  data: string; // "dd/MM"
  partes: string[];
  candidatos: { id: number; nome: string }[];
}

export interface IndisponibilidadePreview {
  confirmados: IrmaoConfirmado[];
  ambiguos: NomeAmbiguo[];
}

/**
 * Uma opção de texto pronta para compartilhar, montada pelo backend
 * (ConviteReuniaoService). O app só desenha e envia — inclusive a LISTA vem de
 * lá, então acrescentar uma opção nova não exige build do app.
 */
export interface OpcaoCompartilhamento {
  id: string;
  titulo: string;
  descricao: string;
  /** Nome de um ícone do Ionicons. */
  icone: string;
  /** Texto final, já formatado (negrito do WhatsApp incluso). */
  texto: string;
}

export interface ImportarReuniaoResponse {
  success: boolean;
  reuniaoId: number;
  mes: number;
  ano: number;
  message: string;
  indisponibilidades: IndisponibilidadePreview;
  /**
   * O que o backend consertou sozinho no arquivo importado: data que contradizia o
   * rótulo da semana, semana que veio sem título. Vem de `reconciliarSemanas`
   * (backend/src/utils/semanaReuniao.js) e precisa aparecer na tela — programação
   * corrigida em silêncio é erro que ninguém confere.
   */
  avisos?: string[];
}

// ===== Escala de Dirigentes: regras e diagnóstico da geração automática =====

/**
 * Espelha REGRAS_PADRAO de backend/src/services/EscalaDirigenteAlgoritmo.js.
 *
 * `sanearRegras`, no backend, descarta em silêncio qualquer chave fora dessa lista — declarar
 * uma regra a mais aqui só cria um controle na tela que não muda nada na escala gerada.
 */
export interface RegrasEscala {
  respeitarIndisponibilidades: boolean;
  evitarDuplicidadeNoDia: boolean;
}

export interface AvisoEscala {
  tipo: string;
  mensagem: string;
  irmao?: string;
  data?: string;
  papel?: string;
  saidaCampoId?: number;
}

export interface CargaDirigente {
  nome: string;
  designacoes: number;
  oportunidades: number;
  cota: number | null;
  aproveitamento: number | null;
  saidasDistintas: number;
  limitadoPelaDisponibilidade: boolean;
}

export interface DiagnosticoEscala {
  totalVagas: number;
  vagasPreenchidas: number;
  vagasVazias: number;
  totalDirigentes: number;
  semDesignacao: string[];
  limitadosPelaDisponibilidade: string[];
  gargalos: {
    saidaCampoId: number;
    local: string | null;
    datas: number;
    vagas: number;
    candidatos: number;
    cargaForcada: number | null;
  }[];
  porIrmao: CargaDirigente[];
  reparos: unknown[];
  trocasRebalanceamento: number;
  regrasRelaxadas: Record<string, number>;
  avisos: AvisoEscala[];
}

// ===== Minhas Designações =====

export type TipoCompromisso = "designacao" | "dirigente" | "reuniao";

export interface Compromisso {
  id: string;
  tipo: TipoCompromisso;
  dataISO: string | null;
  data: string;
  diaSemana: string;
  titulo: string;
  detalhe: string | null;
  papel: string | null;
  local: string | null;
  horario: string | null;
  origem: { tipo: string; id: number; titulo: string; status: string } | null;
  dataAproximada: boolean;
}

export interface MinhasDesignacoesResposta {
  vinculado: boolean;
  irmao: { id: number; nome: string; funcoes: FuncaoId[]; privilegio?: PrivilegioId | null } | null;
  escopo?: "proximas" | "todas";
  totais?: { total: number; proximas: number };
  compromissos: Compromisso[];
  mensagem?: string;
}

export interface IrmaoDisponivel {
  id: number;
  nome: string;
  privilegio: PrivilegioId | null;
  disponivel: boolean;
  vinculadoA: { nome: string; nickname: string } | null;
}

// ===== Carrinho: pontos, turnos fixos semanais e o cadastro próprio de pessoas =====

export interface CarrinhoPessoaNoTurno {
  id: number;
  nome: string;
  telefone: string | null;
  ativo: boolean;
}

export interface CarrinhoTurno {
  id: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  diaSemanaNome: string;
  horaInicio: string;
  horaFim: string;
  publicadores: CarrinhoPessoaNoTurno[];
}

export interface CarrinhoPonto {
  id: number;
  nome: string;
  cor: string;
  ativo: boolean;
  ordem: number;
  turnos: CarrinhoTurno[];
}

export interface CarrinhoPublicador {
  id: number;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarrinhoResposta {
  pontos: CarrinhoPonto[];
  publicadores: CarrinhoPublicador[];
  dias: string[];
}

// ===== Confirmação das partes de estudante =====

/** Em qual sala a parte acontece. */
export type SalaDaParte = "principal" | "salaB";

/**
 * Uma pessoa com parte de estudante numa semana, e o estado da confirmação dela.
 *
 * `data`, `campo` e `nome` juntos são a identidade da linha — é o que volta no PUT.
 */
export interface ParteParaConfirmar {
  data: string;
  campo: string;
  nome: string;
  /** "Leitura da Bíblia", "Ministério — parte 1"... */
  parte: string;
  sala: SalaDaParte;
  /** O título da parte na programação, sem a hora ("Iniciando conversas (3 min)"). */
  titulo: string | null;
  /** null = ainda sem resposta, true = vai cumprir, false = não vai. */
  confirmou: boolean | null;
  /** "Leitura da Bíblia (4 min) - Salão Principal": a mesma linha que a tela mostra. */
  designacao: string;
  /** A mensagem pronta, montada pelo backend com a saudação da hora e a designação. */
  texto: string;
  /**
   * Quem casou no cadastro. `null` quando ninguém casou ou houve empate entre dois nomes
   * parecidos — e aí a tela não oferece cadastrar número, porque não saberia em qual ficha
   * gravar. O `irmaoNome` existe para conferir antes de salvar: o casamento é por
   * semelhança, e gravar na ficha errada é pior do que não gravar.
   */
  irmaoId: number | null;
  irmaoNome: string | null;
  telefone: string | null;
  /** Link do WhatsApp já com o texto. null quando não há telefone cadastrado. */
  whatsapp: string | null;
}

export interface ReuniaoParaConfirmar {
  data: string;
  faixaData: string;
  leituraSemanal: string | null;
  partes: ParteParaConfirmar[];
  total: number;
  confirmadas: number;
  recusadas: number;
}

export interface ConfirmacoesResposta {
  reunioes: ReuniaoParaConfirmar[];
}

// --- Grupos de campo e relatório de serviço ---------------------------------

export interface PessoaGrupo {
  id: number;
  nome: string;
}

export interface CabecalhoGrupo {
  id: number;
  /** "Grupo de Paulo": o grupo se chama pelo primeiro nome de quem dirige. */
  rotulo: string;
  nome: string;
  numero: number | null;
  /** Onde o grupo se reúne para sair. */
  local: string | null;
  dirigente: PessoaGrupo | null;
  ajudante: PessoaGrupo | null;
}

export interface GrupoNoPainel extends CabecalhoGrupo {
  membros: number;
  entregues: number;
  /** Quando o grupo inteiro entregou o relatório do mês (ISO), ou null. */
  concluidoEm: string | null;
}

export interface PainelGrupos {
  /** "2026-10": o mês do relatório. */
  mes: string;
  nomeMes: string;
  /** Admin ou secretário: vê todos os grupos e o total da congregação. */
  veTodos: boolean;
  /** Quem é o secretário (só vem para quem vê todos). */
  secretario: PessoaGrupo | null;
  /** O pedido deste mês está valendo: é o mês que acabou de passar. */
  pedir: boolean;
  grupos: GrupoNoPainel[];
}

export interface RelatorioCampo {
  id: number;
  irmaoId: number;
  mes: string;
  participou: boolean;
  estudos: number;
  /** Só de quem foi pioneiro no mês. */
  horas: number | null;
  pioneiroAuxiliar: boolean;
  pioneiroRegular: boolean;
  observacao: string | null;
}

/** O relatório do próprio irmão num mês ("Registrar o campo", no "+" do Servir Mais). */
export interface MeuRelatorio {
  mes: string;
  nomeMes: string;
  /** Pioneiro regular manda pelo Ministério, com as horas lançadas. */
  pioneiroRegular: boolean;
  relatorio: Pick<RelatorioCampo, "participou" | "estudos" | "horas" | "pioneiroAuxiliar" | "observacao"> | null;
}

export interface NovoRelatorio {
  irmaoId: number;
  mes: string;
  participou?: boolean;
  estudos: number;
  horas?: number | null;
  pioneiroAuxiliar?: boolean;
  observacao?: string | null;
}

/** O filtro das estatísticas: este mês, 3 meses ou o ano de serviço (desde setembro). */
export type PeriodoGrupo = "mes" | "3m" | "ano";

export interface EstatisticasMembro {
  /** Designações do quadro (indicador, som, microfone...). */
  mecanicas: number;
  /** Partes na reunião. */
  reuniao: number;
  /** Saídas de campo como dirigente. */
  dirigente: number;
  /** Reuniões assistidas pelo Zoom. */
  zoom: number;
  designacoes: number;
}

export interface MembroGrupo {
  id: number;
  nome: string;
  pioneiro: TipoPioneiro | null;
  privilegio: PrivilegioId | null;
  lider: "dirigente" | "ajudante" | null;
  relatorio: RelatorioCampo | null;
  /** Link do WhatsApp com o pedido do relatório escrito. Null sem telefone cadastrado. */
  whatsapp: string | null;
  estatisticas: EstatisticasMembro;
}

export interface DetalheGrupo {
  grupo: CabecalhoGrupo;
  mes: string;
  nomeMes: string;
  periodo: { nome: PeriodoGrupo; inicioISO: string; fimISO: string };
  membros: MembroGrupo[];
  entregues: number;
  concluidoEm: string | null;
  /** A mensagem pronta para pedir o relatório no grupo do WhatsApp. */
  textoPedido: string;
}

/** Um compromisso do irmão (quadro, reunião, saída de campo), como em Minhas designações. */
export interface CompromissoFicha {
  tipo: "designacao" | "reuniao" | "dirigente";
  titulo: string;
  detalhe: string | null;
  papel: string | null;
  dataISO: string;
  local: string | null;
  horario: string | null;
}

/** A ficha de um irmão do grupo, para o dirigente analisar. */
export interface FichaMembro {
  irmao: {
    id: number;
    nome: string;
    privilegio: PrivilegioId | null;
    pioneiro: TipoPioneiro | null;
    genero: GeneroPessoa | null;
    telefone: string | null;
    whatsapp: string | null;
  };
  grupo: { id: number; rotulo: string };
  lider: "dirigente" | "ajudante" | null;
  relatorios: {
    /** Os 12 meses, do mais antigo ao mais novo. */
    meses: {
      mes: string;
      nome: string;
      /** Antes do primeiro mês do app o relatório foi no papel. */
      antesDoApp: boolean;
      relatorio: Pick<RelatorioCampo, "participou" | "estudos" | "horas" | "pioneiroAuxiliar" | "pioneiroRegular"> | null;
    }[];
    mesesNoApp: number;
    comRelatorio: number;
    participou: number;
    /** Só do pioneiro regular: as horas relatadas no ano de serviço (o auxiliar fica de fora). */
    horasAnoServico: number | null;
  };
  zoom: {
    /** Dias (ISO) de reuniões assistidas pelo Zoom no último ano, do mais novo ao mais antigo. */
    datas: string[];
    anoServico: number;
    ultimos3Meses: number;
  };
  designacoes: {
    anoServico: EstatisticasMembro & { inicioISO: string };
    proximas: CompromissoFicha[];
    recentes: CompromissoFicha[];
  };
}

export interface TotaisRelatorio {
  publicadores: { quantidade: number; estudos: number };
  auxiliares: { quantidade: number; horas: number; estudos: number };
  regulares: { quantidade: number; horas: number; estudos: number };
  naoParticiparam: number;
  entregues: number;
}

export interface ResumoRelatorioMes {
  mes: string;
  nomeMes: string;
  totais: TotaisRelatorio;
  grupos: (GrupoNoPainel & { pendentes: string[] })[];
  /** Todos os grupos concluíram o mês. */
  completo: boolean;
}

/** Como um nome do PDF casou com o cadastro: o irmão, ou sugestões para o admin escolher. */
export interface CasamentoNome {
  irmao: PessoaGrupo | null;
  criterio: string | null;
  sugestoes: PessoaGrupo[];
}

export interface MembroPrevia extends CasamentoNome {
  /** O nome como está no PDF. */
  nome: string;
  /** Escrito em verde no PDF: pioneiro regular. */
  pioneiro: boolean;
}

/** O dirigente/ajudante: achado entre os membros (`membro`), ou casado com o cadastro. */
export type LiderPrevia =
  | { nome: string; membro: string }
  | ({ nome: string; membro: null } & CasamentoNome);

export interface GrupoPrevia {
  numero: number | null;
  local: string | null;
  dirigente: LiderPrevia | null;
  ajudante: LiderPrevia | null;
  membros: MembroPrevia[];
}

export interface PreviaDivisao {
  grupos: GrupoPrevia[];
  avisos: string[];
  /** Quem está num grupo hoje e não aparece na lista nova. */
  saem: PessoaGrupo[];
}

export interface ResultadoDivisao {
  success: boolean;
  grupos: number;
  pessoas: number;
  pioneiros: number;
  /** Nomes cadastrados agora (não estavam no cadastro). */
  criados: string[];
  sairam: number;
}

// --- Relatórios do Zoom -----------------------------------------------------

/** Em que pé está cada parte vinda do Zoom. */
export type StatusParteZoom = "pendente" | "ok" | "indisponivel" | "erro";
export type ParteZoom = "detalhes" | "resumo" | "participantes" | "transcricao";

export interface SincronizacaoZoom {
  situacao: "sincronizando" | "erro" | "ok";
  partes: Partial<
    Record<ParteZoom, { status: StatusParteZoom; tentativas: number; ultimoErro: string | null; proximaTentativa: string | null }>
  >;
}

/** A reunião no calendário da congregação (data dd/MM/yyyy e tipo). */
export interface ReuniaoDaCongregacao {
  tipo: TipoAssistencia;
  data: string;
}

/** "api": veio do webhook e da API do Zoom; "csv": do relatório de uso exportado (sem resumo nem transcrição). */
export type OrigemZoom = "api" | "csv";

export interface ReuniaoZoomResumo extends SincronizacaoZoom {
  id: number;
  uuid: string;
  origem: OrigemZoom;
  meetingId: string;
  topico: string | null;
  inicio: string | null;
  fim: string | null;
  duracaoMin: number | null;
  resumoTitulo: string | null;
  participantesQtd: number | null;
  sincronizadoEm: string | null;
  temResumo: boolean;
  decisoes: number;
  proximosPassos: number;
  congregacao: ReuniaoDaCongregacao | null;
}

export interface PaginaReunioesZoom {
  total: number;
  pagina: number;
  porPagina: number;
  reunioes: ReuniaoZoomResumo[];
}

export interface ParticipanteZoom {
  nome: string;
  /** Como apareceu no Zoom ("iPhone de Ana"), quando o nome é o do cadastro. */
  nomeZoom: string;
  irmaoId: number | null;
  entrada: string | null;
  saida: string | null;
  duracaoSeg: number;
  /** Quantas vezes entrou (saiu e voltou conta de novo). */
  entradas: number;
  /** Falso para quem ficou só na sala de espera. */
  naSala: boolean;
}

export interface TopicoZoom {
  titulo: string;
  descricao: string | null;
  itens: string[];
  conclusoes: string[];
}

export interface ReuniaoZoomDetalhe extends SincronizacaoZoom {
  id: number;
  uuid: string;
  origem: OrigemZoom;
  meetingId: string;
  hostEmail: string | null;
  topico: string | null;
  inicio: string | null;
  fim: string | null;
  duracaoMin: number | null;
  resumoTitulo: string | null;
  /** O resumo do AI Companion como veio, em Markdown. */
  resumoMarkdown: string | null;
  resumoEditadoEm: string | null;
  resumoDocUrl: string | null;
  topicos: TopicoZoom[] | null;
  decisoes: string[] | null;
  proximosPassos: string[] | null;
  participantesQtd: number | null;
  sincronizadoEm: string | null;
  temTranscricao: boolean;
  congregacao: ReuniaoDaCongregacao | null;
  /** A assistência registrada para aquele dia, se já existe. */
  assistencia: { id: number; presencial: number; zoom: number; lista: number } | null;
  participantes: ParticipanteZoom[];
  entradas: number;
}

/** O que a importação do relatório (CSV) fez com cada reunião. */
export interface ResultadoImportacaoZoom {
  reunioes: {
    id: number;
    data: string;
    tipo: TipoAssistencia;
    pessoas: number;
    /** Quantas pessoas foram reconhecidas no cadastro. */
    doCadastro: number;
    /** Null quando a contagem daquele dia ainda não foi registrada (aí não mexe na assistência). */
    assistencia: { adicionados: number; total: number } | null;
  }[];
  ignoradas: { data: string; tipo: TipoAssistencia; pessoas: number; motivo: string }[];
  erros: string[];
}

export interface EstadoZoom {
  /** Credenciais da API configuradas no servidor. */
  api: boolean;
  /** Secret token do webhook configurado. */
  webhook: boolean;
  pendentes: number;
  erros: number;
  ultimoEvento: { evento: string; recebidoEm: string } | null;
}

// --- Área de pioneiros --------------------------------------------------------

export interface RegistroHoras {
  id: number;
  /** "2026-10-23" */
  data: string;
  minutos: number;
  origem: "manual" | "cronometro";
  observacao: string | null;
}

export interface CronometroPioneiro {
  rodando: boolean;
  /** Rodando desde (ISO); null quando parado ou pausado. */
  inicio: string | null;
  /** O que já somou antes das pausas. */
  acumuladoSeg: number;
}

export interface RevisitaResumo {
  id: number;
  nome: string;
  endereco: string | null;
  estudo: boolean;
  proximaVisita: string | null;
}

/** A visita marcada já passou (`atrasada`), é `hoje`, é em até 3 dias (`breve`), depois (`marcada`) ou não tem data. */
export type SituacaoContato = "semData" | "atrasada" | "hoje" | "breve" | "marcada";
export type TipoVisita = "conversa" | "estudo" | "nao_em_casa";

export interface PainelPioneiro {
  mes: string;
  nomeMes: string;
  hoje: string;
  /** Pioneiro regular pelo cadastro (o admin que não é pode usar como auxiliar). */
  regular: boolean;
  meta: number;
  metaAno: number;
  cronometro: CronometroPioneiro;
  minutosMes: number;
  /** O ano de serviço até o mês escolhido. */
  minutosAno: number;
  porMes: { mes: string; minutos: number }[];
  registros: RegistroHoras[];
  estudos: number;
  revisitas: number;
  proximas: RevisitaResumo[];
  relatorio: RelatorioCampo | null;
  /** Primeiro nome, para o "Bom dia". */
  nome: string;
  /** Os outros pioneiros veem os planos de saída dele na agenda. */
  compartilharPlanos: boolean;
  /** Já gerou o link do calendário (assinou ou mandou o link). Ausente na API anterior. */
  calendario?: boolean;
  /** As marcadas para hoje e as que já tiveram visita hoje (`feita` é o tipo da visita). */
  conversasHoje: { total: number; feitas: number; itens: (RevisitaResumo & { feita: TipoVisita | null })[] };
  /** As próximas visitas marcadas, depois de hoje. */
  aSeguir: (RevisitaResumo & { situacao: SituacaoContato })[];
}

export interface PlanoSaida {
  id: number;
  /** "2026-10-25" */
  data: string;
  /** "09:30" */
  hora: string;
  duracaoMin: number;
  local: string | null;
  nota: string | null;
  meu: boolean;
  /** O primeiro nome do companheiro (null quando é meu). */
  nome: string | null;
}

export interface SaidaAgenda {
  id: number;
  data: string;
  hora: string | null;
  local: string | null;
  dirigente: string | null;
}

export interface AgendaPioneiro {
  de: string;
  ate: string;
  hoje: string;
  visitas: (RevisitaResumo & { situacao: SituacaoContato })[];
  planos: PlanoSaida[];
  saidas: SaidaAgenda[];
}

export interface Viagem {
  id: number;
  data: string;
  km: number;
  custo: number | null;
  nota: string | null;
}

export interface ViagensMes {
  mes: string;
  viagens: Viagem[];
  quantidade: number;
  km: number;
  custo: number;
  porDia: Record<string, number>;
}

export type NivelEmblema = "bronze" | "prata" | "ouro";

export interface EmblemaPioneiro {
  id: "constancia" | "regando" | "estudos" | "pronto";
  nome: string;
  icone: string;
  valor: number;
  unidade: string;
  nivel: NivelEmblema | null;
  proximo: { nivel: NivelEmblema; falta: number } | null;
}

export interface ProgressoPioneiro {
  mes: string;
  nomeMes: string;
  meta: number;
  metaAno: number;
  minutosMes: number;
  minutosAno: number;
  porMes: { mes: string; minutos: number; status: "meta" | "parcial" | "vazio" | "futuro"; relatorio: boolean }[];
  emblemas: EmblemaPioneiro[];
  viagens: { quantidade: number; km: number; custo: number };
}

export interface Revisita {
  id: number;
  nome: string;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  telefone: string | null;
  observacao: string | null;
  estudo: boolean;
  ativa: boolean;
  proximaVisita: string | null;
  updatedAt: string;
  ultimaVisita: string | null;
  visitas: number;
}

export interface RevisitaDetalhe extends Omit<Revisita, "ultimaVisita" | "visitas"> {
  visitas: { id: number; data: string; observacao: string | null; tipo: TipoVisita }[];
}

export interface NovaRevisita {
  nome?: string;
  endereco?: string | null;
  lat?: number | null;
  lng?: number | null;
  telefone?: string | null;
  observacao?: string | null;
  estudo?: boolean;
  ativa?: boolean;
  proximaVisita?: string | null;
}

