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

export interface Usuario {
  id: number;
  nickname: string;
  nome: string;
  isAdmin: boolean;
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

export interface RegrasAutoPreenchimento {
  respeitarIndisponibilidades: boolean;
  evitarRepeticoes: boolean;
  distribuicaoIgualitaria: boolean;
  designarTodos: boolean;
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
  substituto: string;
  removido: boolean;
  saidaCampo?: SaidaCampo;
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

// ===== Reuniões =====

export interface SemanaReuniao {
  id: number;
  reuniaoId: number;
  faixaData: string;
  dataReuniao?: string | null;
  leituraSemanal?: string | null;
  presidente?: string | null;
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
  vidaCrista1_titulo?: string | null;
  vidaCrista1_irmao?: string | null;
  vidaCrista2_titulo?: string | null;
  vidaCrista2_irmao?: string | null;
  estudoBiblico_dirigente?: string | null;
  estudoBiblico_leitor?: string | null;
  fds_presidente?: string | null;
  fds_tema?: string | null;
  fds_orador?: string | null;
  mecanica_audioVideo?: string | null;
  mecanica_indicadores?: string | null;
  mecanica_microfone?: string | null;
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

export interface ImportarReuniaoResponse {
  success: boolean;
  reuniaoId: number;
  mes: number;
  ano: number;
  message: string;
  indisponibilidades: IndisponibilidadePreview;
}

// ===== Escala de Dirigentes: regras e diagnóstico da geração automática =====

/** Espelha REGRAS_PADRAO de backend/src/services/EscalaDirigenteAlgoritmo.js. */
export interface RegrasEscala {
  respeitarIndisponibilidades: boolean;
  evitarDuplicidadeNoDia: boolean;
  distribuicaoIgualitaria: boolean;
  ponderarDisponibilidade: boolean;
  designarTodos: boolean;
  evitarRepeticoes: boolean;
  equilibrarPapeis: boolean;
  rodizioLocais: boolean;
  evitarRepetirDupla: boolean;
  considerarMesAnterior: boolean;
  preencherSubstituto: boolean;
  diasDescanso: number;
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
  principais: number;
  substitutos: number;
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
