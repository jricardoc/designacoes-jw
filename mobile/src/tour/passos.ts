import type { Icone } from "@/components/ministerio/kit";
import type { Ambiente } from "@/utils/ambiente";

/**
 * O tutorial de cada ambiente, passo a passo.
 *
 * O que ele destaca é sempre o que existe com o app vazio: as abas, o "+", os botões do topo, a
 * marca. Nada que dependa de dado (uma designação, um contato) entra como alvo obrigatório: com a
 * lista vazia, o destaque cairia no lugar errado. Quando um passo fala de algo que pode não estar
 * na tela (o próximo compromisso), ele é `opcional` e simplesmente não aparece.
 *
 * Sem React aqui, para o teste (scripts/verificarTour.mjs) conferir os passos e os alvos.
 */

/** Quem vê o passo: as mesmas regras das telas (ver REGRAS em estado.ts). */
export type Regra =
  | "pioneiro"
  | "marcarTerritorio"
  | "gerenciar:dirigentes"
  | "gerenciar:territorios"
  | "gerenciar:reunioes"
  | "adminGeral"
  | "verGrupos";

export interface Passo {
  titulo: string;
  texto: string;
  /** O que fica em destaque (registrado com `alvoTour`). Sem alvo, o cartão fica no meio, com o ícone. */
  alvo?: string;
  icone?: Icone;
  /** A aba do ambiente que precisa estar aberta ("index" é a primeira). */
  aba?: string;
  /** Só para quem pode ver aquilo. */
  se?: Regra;
  /** Sem o alvo na tela, pula em vez de mostrar no meio. */
  opcional?: boolean;
  forma?: "circulo" | "pilula";
}

const FIM = (onde: string): Passo => ({
  titulo: "Pronto!",
  texto: `Para ver de novo, ${onde}. As novidades do app ficam em Ajustes › O que há de novo.`,
  icone: "checkmark-circle",
});

export const TOURS: Record<Ambiente, Passo[]> = {
  servir: [
    {
      titulo: "Conheça o Servir Mais",
      texto: "Um minuto para ver o que cada parte do app faz. Dá para refazer quando quiser, em Ajustes.",
      icone: "sparkles",
    },
    {
      alvo: "servir.aba.minhas",
      aba: "minhas",
      forma: "circulo",
      titulo: "Início",
      texto: "O que é seu: quadro, reunião, saída de campo e território, com o próximo compromisso em destaque e as suas tarefas.",
    },
    {
      alvo: "servir.proximo",
      aba: "minhas",
      opcional: true,
      titulo: "O próximo compromisso",
      texto: "Toque para ver os detalhes. Se for parte de estudante, responda aqui mesmo: Confirmo ou Não posso.",
    },
    {
      alvo: "servir.aba.index",
      aba: "index",
      forma: "circulo",
      titulo: "Designações",
      texto: "Os quadros do mês: microfone, indicador, áudio e vídeo e estacionamento, com o PDF para afixar.",
    },
    {
      alvo: "servir.aba.reuniao",
      aba: "reuniao",
      forma: "circulo",
      titulo: "Reunião",
      texto: "A programação de cada semana, o convite do Zoom pronto para mandar e a assistência do mês.",
    },
    {
      alvo: "servir.aba.conta",
      aba: "conta",
      forma: "circulo",
      titulo: "Conta",
      texto: "Sua foto, o nome, a senha e a entrada com Face ID ou digital.",
    },
    {
      alvo: "servir.mais",
      aba: "minhas",
      forma: "circulo",
      titulo: "O botão +",
      texto: "Envie o relatório de campo do mês. Quem cuida dos quadros e da reunião também cria o quadro e importa a programação por aqui.",
    },
    {
      alvo: "servir.sino",
      forma: "circulo",
      titulo: "Notificações",
      texto: "Os lembretes de designação, de tarefa e de relatório. Os que chegaram ficam guardados aqui.",
    },
    {
      alvo: "servir.menu",
      titulo: "O menu",
      texto: "Tudo o que não está na barra: Dirigentes, Carrinho e Ajustes, além do que é da sua função.",
    },
    {
      alvo: "servir.marca",
      titulo: "Troque de ambiente",
      texto: "Toque na marca para trocar de ambiente: Território (mapas e saídas), Estudo pessoal (leitura da Bíblia e estudo) e, para os pioneiros, Ministério. Para voltar, a marca no topo de cada um. O app abre no último que você usou.",
    },
    { ...FIM("vá em Ajustes › Tutorial do app"), aba: "minhas" },
  ],

  ministerio: [
    {
      titulo: "Conheça o Ministério",
      texto: "O seu ministério de pioneiro: horas, contatos e agenda. Um minuto para ver como funciona.",
      icone: "leaf",
    },
    {
      alvo: "ministerio.cronometro",
      aba: "index",
      opcional: true,
      titulo: "Cronômetro e meta",
      texto: "Inicie ao sair para o campo. Ele continua contando com o app fechado e até sem internet. O anel mostra quanto falta para a meta do mês.",
    },
    {
      alvo: "ministerio.aba.agenda",
      aba: "agenda",
      forma: "pilula",
      titulo: "Agenda",
      texto: "O mês com as visitas marcadas e os planos de saída, seus e dos outros pioneiros. Dá para assinar o calendário no celular.",
    },
    {
      alvo: "ministerio.aba.contatos",
      aba: "contatos",
      forma: "pilula",
      titulo: "Contatos",
      texto: "Revisitas e estudos, na lista ou no mapa. Segure o dedo num contato para as ações rápidas e para compartilhar.",
    },
    {
      alvo: "ministerio.aba.progresso",
      aba: "progresso",
      forma: "pilula",
      titulo: "Progresso",
      texto: "Como foi cada mês e o ano de serviço, com emblemas da constância e a quilometragem.",
    },
    {
      alvo: "ministerio.mais",
      aba: "index",
      forma: "circulo",
      titulo: "O botão +",
      texto: "Novo contato, lançar horas, planejar saída e registrar viagem. Contato e visita anotados sem internet sobem sozinhos depois.",
    },
    {
      alvo: "ministerio.avatar",
      forma: "circulo",
      titulo: "Perfil e ajuda",
      texto: "A meta, quem vê os seus planos, o Centro de Ajuda e este tutorial.",
    },
    {
      alvo: "ministerio.marca",
      titulo: "Voltar ao Servir Mais",
      texto: "Toque na marca para trocar de ambiente. O app abre no último que você usou.",
    },
    FIM("toque na sua foto › Tutorial"),
  ],

  territorio: [
    {
      titulo: "Conheça o Território",
      texto: "Os mapas da congregação, as saídas e onde paramos. Um minuto para ver como funciona.",
      icone: "map",
    },
    {
      alvo: "territorio.aba.index",
      aba: "index",
      forma: "pilula",
      titulo: "Mapa",
      texto: "Todos os territórios no mapa, com a cor da situação de cada um e o ponto de onde você está. Toque num território para ver.",
    },
    {
      alvo: "territorio.aba.lista",
      aba: "lista",
      forma: "pilula",
      titulo: "Territórios",
      texto: "A lista por áreas, com busca. Dentro de cada um: as quadras, onde paramos, o Não bater e o histórico.",
    },
    {
      alvo: "territorio.mais",
      aba: "index",
      se: "marcarTerritorio",
      forma: "circulo",
      titulo: "O botão +",
      texto: "Marque pelo GPS onde parou, registre a saída e anote o Não bater. Sem internet fica guardado e sobe sozinho.",
    },
    {
      alvo: "territorio.aba.saidas",
      aba: "saidas",
      se: "gerenciar:dirigentes",
      forma: "pilula",
      titulo: "Saídas",
      texto: "As saídas de campo da congregação, por dia e turno.",
    },
    {
      alvo: "territorio.aba.painel",
      aba: "painel",
      se: "gerenciar:territorios",
      forma: "pilula",
      titulo: "Gerenciar",
      texto: "Importar do My Maps, designar, revisar os registros e gerar o S-13 em PDF.",
    },
    {
      alvo: "territorio.marca",
      aba: "index",
      titulo: "Trocar de ambiente",
      texto: "Toque na marca para voltar ao Servir Mais ou ir para outro ambiente.",
    },
    FIM("toque na marca › Ver o tutorial"),
  ],

  estudo: [
    {
      titulo: "Conheça o Estudo pessoal",
      texto: "A leitura da Bíblia e o estudo de cada um, com o que vem do jw.org. Um minuto para ver como funciona.",
      icone: "book",
    },
    {
      alvo: "estudo.aba.index",
      aba: "index",
      forma: "pilula",
      titulo: "Hoje",
      texto: "A leitura do dia, com Ler (abre no JW Library) e Marquei como lido, e a regularidade da semana.",
    },
    {
      alvo: "estudo.aba.leitura",
      aba: "leitura",
      forma: "pilula",
      titulo: "Leitura",
      texto: "Escolha o programa: o do jw.org, o Comece sua leitura, o da reunião ou a leitura livre. Segure um trecho para anotar uma joia.",
    },
    {
      alvo: "estudo.aba.assuntos",
      aba: "assuntos",
      forma: "pilula",
      titulo: "Estudo",
      texto: "A lista do que estudar, a sessão com o passo a passo e as suas anotações.",
    },
    {
      alvo: "estudo.aba.rotina",
      aba: "rotina",
      forma: "pilula",
      titulo: "Rotina",
      texto: "A sua programação, com aviso no celular e um plano B para o dia não passar sem leitura.",
    },
    {
      alvo: "estudo.mais",
      aba: "index",
      forma: "circulo",
      titulo: "O botão +",
      texto: "Comece um estudo, marque a leitura de hoje ou anote um assunto que surgiu.",
    },
    {
      alvo: "estudo.marca",
      titulo: "Trocar de ambiente",
      texto: "Toque na marca para voltar ao Servir Mais ou ir para outro ambiente.",
    },
    FIM("toque na marca › Ver o tutorial"),
  ],
};
