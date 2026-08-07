import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Search, Edit2, User, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import EditarIrmaoModal from '../EditarIrmaoModal';
import PrivilegioBadge from '../../PrivilegioBadge';
import { FUNCOES } from '../../../utils/funcoes';
import { PRIVILEGIOS } from '../../../utils/privilegios';

// Dias em que pode existir saída de campo. Domingo não é usado hoje, mas o modelo aceita —
// por isso ele entra na lista em vez de sair de `irmaos` (senão o filtro sumiria/apareceria
// conforme o cadastro).
const DIAS_DIRIGENTE = [
  { id: 'segunda', label: 'Segunda' },
  { id: 'terca', label: 'Terça' },
  { id: 'quarta', label: 'Quarta' },
  { id: 'quinta', label: 'Quinta' },
  { id: 'sexta', label: 'Sexta' },
  { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
];

// Chip de "sem privilégio": o privilégio é anulável, e filtrar por quem não tem é tão útil
// quanto filtrar por ancião.
const SEM_PRIVILEGIO = 'sem';

const FILTROS_VAZIOS = {
  funcoes: [],
  privilegios: [],
  dias: [],
  status: [],
  niveis: [],
};

const COR_NEUTRA = 'var(--t-text-2)';

/** Achata o irmão nos campos que o filtro compara, para não repetir isso a cada chip. */
function indexar(irmao) {
  const dias = (irmao.dirigenteSaidas ?? [])
    .map((d) => d?.saidaCampo?.diaSemana)
    .filter(Boolean);

  const funcoes = irmao.funcoes ?? [];

  return {
    irmao,
    nome: (irmao.nome || '').toLowerCase(),
    funcoes,
    privilegio: irmao.privilegio || SEM_PRIVILEGIO,
    dias,
    status: irmao.ativo ? 'ativo' : 'inativo',
    // `nivelAudioVideo` tem default no banco e é gravado para todo mundo, mesmo para quem não
    // é de áudio e vídeo — sem cruzar com a função, "Experiente" pegaria a congregação
    // inteira. `null` nunca casa com os chips, que só têm 'experiente'/'treinando'.
    nivel: funcoes.includes('audioVideo') ? (irmao.nivelAudioVideo || 'experiente') : null,
  };
}

/**
 * DENTRO de uma dimensão as escolhas somam com OU (Microfone + Indicador = quem tem uma das
 * duas); ENTRE dimensões vale E (função "dirigente" + dia "sábado" = dirigente que serve no
 * sábado). Dimensão sem nada marcado não filtra nada.
 */
function filtrar(indice, busca, filtros) {
  const termo = busca.trim().toLowerCase();

  return indice.filter((item) => {
    if (termo && !item.nome.includes(termo)) return false;
    if (filtros.funcoes.length && !filtros.funcoes.some((f) => item.funcoes.includes(f))) return false;
    if (filtros.privilegios.length && !filtros.privilegios.includes(item.privilegio)) return false;
    if (filtros.dias.length && !filtros.dias.some((d) => item.dias.includes(d))) return false;
    if (filtros.status.length && !filtros.status.includes(item.status)) return false;
    if (filtros.niveis.length && !filtros.niveis.includes(item.nivel)) return false;
    return true;
  });
}

export default function GerenciarIrmaos() {
  const { authFetch } = useAuth();
  const [irmaos, setIrmaos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [modalAberto, setModalAberto] = useState(false);
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);

  // Carregar irmaos
  const carregarIrmaos = async () => {
    try {
      const response = await authFetch('/irmaos');
      const data = await response.json();
      setIrmaos(data);
    } catch (error) {
      console.error('Erro ao carregar irmaos:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarIrmaos();
  }, []);

  const indice = useMemo(() => irmaos.map(indexar), [irmaos]);

  const irmaosFiltrados = useMemo(
    () => filtrar(indice, busca, filtros).map((item) => item.irmao),
    [indice, busca, filtros]
  );

  const grupos = useMemo(
    () => [
      {
        chave: 'funcoes',
        rotulo: 'Funções',
        opcoes: FUNCOES.map((f) => ({ id: f.id, label: f.label, cor: f.color })),
      },
      {
        chave: 'privilegios',
        rotulo: 'Privilégio',
        opcoes: [
          ...PRIVILEGIOS.map((p) => ({ id: p.id, label: p.label, cor: p.cor, fundo: p.fundo })),
          { id: SEM_PRIVILEGIO, label: 'Sem privilégio', cor: COR_NEUTRA },
        ],
      },
      {
        chave: 'dias',
        rotulo: 'Dia de dirigente',
        opcoes: DIAS_DIRIGENTE.map((d) => ({ id: d.id, label: d.label, cor: 'var(--t-red)' })),
      },
      {
        chave: 'status',
        rotulo: 'Status',
        opcoes: [
          { id: 'ativo', label: 'Ativos', cor: 'var(--t-primary)' },
          { id: 'inativo', label: 'Inativos', cor: 'var(--t-red)' },
        ],
      },
      {
        chave: 'niveis',
        rotulo: 'Áudio e vídeo',
        opcoes: [
          { id: 'experiente', label: 'Experiente', cor: 'var(--t-olive)' },
          { id: 'treinando', label: 'Treinando', cor: 'var(--t-terracotta)' },
        ],
      },
    ],
    []
  );

  // Contagem facetada: quantos irmãos sobrariam se este chip fosse a única escolha da
  // dimensão dele, mantendo as outras dimensões como estão. Sem isso o usuário marca um
  // filtro, cai numa lista vazia e não descobre qual combinação o esvaziou.
  const contagens = useMemo(() => {
    const mapa = {};
    grupos.forEach((grupo) => {
      mapa[grupo.chave] = {};
      grupo.opcoes.forEach((opcao) => {
        mapa[grupo.chave][opcao.id] = filtrar(indice, busca, {
          ...filtros,
          [grupo.chave]: [opcao.id],
        }).length;
      });
    });
    return mapa;
  }, [grupos, indice, busca, filtros]);

  const temFiltro =
    busca.trim() !== '' || Object.values(filtros).some((valores) => valores.length > 0);

  const alternarFiltro = (chave, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [chave]: prev[chave].includes(valor)
        ? prev[chave].filter((v) => v !== valor)
        : [...prev[chave], valor],
    }));
  };

  const limparFiltros = () => {
    setBusca('');
    setFiltros(FILTROS_VAZIOS);
  };

  // Abrir modal para novo irmao
  const novoIrmao = () => {
    setIrmaoSelecionado(null);
    setModalAberto(true);
  };

  // Abrir modal para editar
  const editarIrmao = (irmao) => {
    setIrmaoSelecionado(irmao);
    setModalAberto(true);
  };

  // Fechar modal e recarregar
  const fecharModal = (atualizar = false) => {
    setModalAberto(false);
    setIrmaoSelecionado(null);
    if (atualizar) {
      carregarIrmaos();
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  }

  const botaoLimpar = (
    <button
      type="button"
      onClick={limparFiltros}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.35rem 0.75rem',
        borderRadius: '20px',
        border: '1px solid var(--t-border-strong)',
        background: 'var(--t-surface)',
        color: 'var(--t-text-2)',
        fontSize: '0.78rem',
        fontWeight: '600',
        cursor: 'pointer'
      }}
    >
      <X size={13} />
      Limpar filtros
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'var(--t-surface)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Users size={22} color="var(--t-terracotta)" />
              Gerenciar Irmãos
            </h2>
            <p style={{ color: 'var(--t-text-2)', margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              {irmaos.length} irmãos cadastrados
            </p>
          </div>

          <button
            onClick={novoIrmao}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              background: 'linear-gradient(135deg, var(--t-terracotta) 0%, var(--t-amber) 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 14px -3px rgba(249, 115, 22, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px -3px rgba(249, 115, 22, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 14px -3px rgba(249, 115, 22, 0.4)';
            }}
          >
            <Plus size={18} />
            Novo Irmão
          </button>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginTop: '1rem' }}>
          <Search
            size={18}
            color="var(--t-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar irmão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '350px',
              padding: '0.6rem 1rem 0.6rem 2.5rem',
              borderRadius: '10px',
              border: '2px solid var(--t-border-strong)',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--t-terracotta)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--t-border-strong)'}
          />
        </div>

        {/* Filtros */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem 1.75rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--t-border-strong)'
        }}>
          {grupos.map((grupo) => (
            <div key={grupo.chave} style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--t-muted)',
                marginBottom: '0.4rem'
              }}>
                {grupo.rotulo}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {grupo.opcoes.map((opcao) => {
                  const marcado = filtros[grupo.chave].includes(opcao.id);
                  const total = contagens[grupo.chave]?.[opcao.id] ?? 0;
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => alternarFiltro(grupo.chave, opcao.id)}
                      aria-pressed={marcado}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '20px',
                        border: `1px solid ${marcado ? opcao.cor : 'var(--t-border-strong)'}`,
                        background: marcado ? opcao.cor : '#FFFFFF',
                        color: marcado ? '#FFFFFF' : 'var(--t-text)',
                        fontSize: '0.78rem',
                        fontWeight: marcado ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        // Chip que não sobraria ninguém fica apagado, mas continua clicável.
                        opacity: !marcado && total === 0 ? 0.45 : 1
                      }}
                    >
                      {opcao.label}
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        padding: '0 0.3rem',
                        borderRadius: '8px',
                        background: marcado ? 'rgba(255,255,255,0.25)' : (opcao.fundo || 'var(--t-sand)'),
                        color: marcado ? '#FFFFFF' : 'var(--t-text-2)'
                      }}>
                        {total}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {temFiltro && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginTop: '0.85rem'
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--t-text-2)' }}>
              <strong style={{ color: 'var(--t-text)' }}>{irmaosFiltrados.length}</strong> de {irmaos.length} irmãos
            </span>
            {botaoLimpar}
          </div>
        )}
      </div>

      {/* Lista de Irmaos - Compacta */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.75rem'
      }}>
        {irmaosFiltrados.map(irmao => (
          <div
            key={irmao.id}
            onClick={() => editarIrmao(irmao)}
            style={{
              background: 'var(--t-surface)',
              borderRadius: '10px',
              padding: '0.875rem 1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              opacity: irmao.ativo ? 1 : 0.5,
              transition: 'all 0.2s',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--t-terracotta)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: irmao.ativo
                ? 'linear-gradient(135deg, var(--t-terracotta) 0%, var(--t-amber) 100%)'
                : 'var(--t-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <User size={18} color="white" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: '600',
                fontSize: '0.9rem',
                color: irmao.ativo ? 'var(--t-text)' : 'var(--t-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {irmao.nome}
              </div>
              {(irmao.privilegio || !irmao.ativo) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                  <PrivilegioBadge privilegio={irmao.privilegio} tamanho="sm" abreviado />
                  {!irmao.ativo && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--t-red)' }}>Inativo</span>
                  )}
                </div>
              )}
            </div>

            <Edit2
              size={16}
              color="var(--t-muted)"
              style={{ flexShrink: 0 }}
            />
          </div>
        ))}
      </div>

      {irmaosFiltrados.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--t-text-2)'
        }}>
          {irmaos.length === 0 ? (
            'Nenhum irmão cadastrado'
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <span>Nenhum irmão com esses filtros</span>
              {botaoLimpar}
            </div>
          )}
        </div>
      )}

      {/* Modal Unificado de Edicao */}
      {modalAberto && (
        <EditarIrmaoModal
          irmao={irmaoSelecionado}
          onClose={fecharModal}
        />
      )}
    </div>
  );
}
