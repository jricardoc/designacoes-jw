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

export interface Usuario {
  id: number;
  nickname: string;
  nome: string;
  isAdmin: boolean;
  createdAt?: string;
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
