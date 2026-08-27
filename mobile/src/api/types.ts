/**
 * Domain types mirroring the backend Prisma models and API responses.
 */

export type StatusQuadro = "rascunho" | "publicado" | "arquivado";

export type FuncaoId =
  | "microfone"
  | "indicador"
  | "audioVideo"
  | "estacionamento"
  | "dirigente";

export type NivelAudioVideo = "experiente" | "treinando";

/** Privilégio de serviço do irmão. Informativo por enquanto; ausente/null = nenhum. */
export type PrivilegioId = "servoMinisterial" | "anciao";

/**
 * Área que um usuário pode administrar sem ser admin geral. Espelha
 * backend/src/middleware/escopos.js.
 */
export type EscopoAdmin = "designacoes" | "dirigentes" | "reunioes" | "carrinho";

/** Uma área do catálogo de permissões, como o backend a descreve. */
export interface OpcaoEscopo {
  id: EscopoAdmin;
  label: string;
  descricao: string;
}

export interface Usuario {
  id: number;
  nickname: string;
  nome: string;
  /** Admin geral: contempla todos os escopos. */
  isAdmin: boolean;
  /** Áreas administráveis de quem não é admin geral. */
  escopos?: EscopoAdmin[];
  createdAt?: string;
  /**
   * Cargo resolvido no backend cruzando o nome do usuário com o cadastro de irmãos.
   * Não existe FK entre Usuario e Irmao — ver backend/src/services/PrivilegioService.js.
   */
  privilegio?: PrivilegioId | null;
  /** Vínculo com o cadastro da congregação. Sem ele não há "Minhas Designações". */
  irmaoId?: number | null;
  irmao?: { id: number; nome: string; funcoes: FuncaoId[] } | null;
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

export interface Irmao {
  id: number;
  nome: string;
  funcoes: FuncaoId[];
  nivelAudioVideo: NivelAudioVideo;
  privilegio?: PrivilegioId | null;
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
export interface Territorio {
  numero: number;
  localidade: string;
  imagens: {
    mapa: string;
    /** Só os territórios 01-08 têm a versão de satélite. */
    satelite: string | null;
    thumb: string;
  };
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
  createdAt: string;
  updatedAt: string;
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
