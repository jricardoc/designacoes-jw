import { createContext, useContext, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DesignacoesContext = createContext();

export function DesignacoesProvider({ children }) {
  const [titulo, setTituloState] = useState('Quadro de Designacoes JANEIRO');
  const [subtitulo, setSubtituloState] = useState('Congregacao');
  const [mes, setMesState] = useState('JAN');
  const [designacoes, setDesignacoesState] = useState([]);
  const [irmaos, setIrmaos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper para requests autenticados
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_URL}${url}`, { ...options, headers });
  };

  // Carrega dados do banco na inicializacao
  useEffect(() => {
    const loadData = async () => {
      try {
        // Carrega config
        const configRes = await authFetch('/config');
        if (configRes.ok) {
          const config = await configRes.json();
          if (config) {
            setTituloState(config.titulo);
            setSubtituloState(config.subtitulo);
            setMesState(config.mes);
          }
        }

        // Designacoes antigas removidas - agora sao por quadro em /quadros/:id
        // Manter compatibilidade com componentes legado
        setDesignacoesState([]);

        // Carrega irmaos
        const irmaosRes = await authFetch('/irmaos');
        if (irmaosRes.ok) {
          const data = await irmaosRes.json();
          setIrmaos(data);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Atualiza titulo no banco
  const setTitulo = async (value) => {
    setTituloState(value);
    try {
      await authFetch('/config', {
        method: 'PUT',
        body: JSON.stringify({ titulo: value, subtitulo, mes })
      });
    } catch (error) {
      console.error('Erro ao salvar titulo:', error);
    }
  };

  // Atualiza subtitulo no banco
  const setSubtitulo = async (value) => {
    setSubtituloState(value);
    try {
      await authFetch('/config', {
        method: 'PUT',
        body: JSON.stringify({ titulo, subtitulo: value, mes })
      });
    } catch (error) {
      console.error('Erro ao salvar subtitulo:', error);
    }
  };

  // Atualiza mes no banco
  const setMes = async (value) => {
    setMesState(value);
    try {
      await authFetch('/config', {
        method: 'PUT',
        body: JSON.stringify({ titulo, subtitulo, mes: value })
      });
    } catch (error) {
      console.error('Erro ao salvar mes:', error);
    }
  };

  // Atualiza uma designacao especifica (irmao)
  const updateDesignacao = async (data, funcao, campo, novoValor) => {
    // Atualiza estado local
    setDesignacoesState(prev => 
      prev.map(d => {
        if (d.data === data && d.funcao === funcao) {
          return { ...d, [campo]: novoValor };
        }
        return d;
      })
    );

    // Salva no banco
    try {
      await authFetch('/designacoes/irmao', {
        method: 'PUT',
        body: JSON.stringify({ data, funcao, campo, valor: novoValor })
      });
    } catch (error) {
      console.error('Erro ao salvar designacao:', error);
    }
  };

  // Atualiza data de um grupo
  const updateData = async (dataAntiga, novaData) => {
    setDesignacoesState(prev => 
      prev.map(d => {
        if (d.data === dataAntiga) {
          return { ...d, data: novaData };
        }
        return d;
      })
    );

    try {
      await authFetch(`/designacoes/data/${dataAntiga}`, {
        method: 'PUT',
        body: JSON.stringify({ novaData })
      });
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
    }
  };

  // Atualiza dia da semana
  const updateDia = async (data, novoDia) => {
    setDesignacoesState(prev => 
      prev.map(d => {
        if (d.data === data) {
          return { ...d, dia: novoDia };
        }
        return d;
      })
    );

    try {
      await authFetch(`/designacoes/dia/${data}`, {
        method: 'PUT',
        body: JSON.stringify({ dia: novoDia })
      });
    } catch (error) {
      console.error('Erro ao atualizar dia:', error);
    }
  };

  // Agrupa designacoes por data
  const designacoesPorData = designacoes.reduce((acc, item) => {
    const key = item.data;
    if (!acc[key]) {
      acc[key] = { data: item.data, dia: item.dia, funcoes: [] };
    }
    acc[key].funcoes.push(item);
    return acc;
  }, {});

  // Converte para array ordenado
  const grupos = Object.values(designacoesPorData)
    .sort((a, b) => {
      const [diaA, mesA] = a.data.split('/').map(Number);
      const [diaB, mesB] = b.data.split('/').map(Number);
      return (mesA * 100 + diaA) - (mesB * 100 + diaB);
    });

  // Calcula estatisticas por irmao
  const estatisticas = designacoes.reduce((acc, d) => {
    [d.irmao1, d.irmao2].forEach(irmao => {
      if (irmao && irmao.trim()) {
        if (!acc[irmao]) acc[irmao] = 0;
        acc[irmao]++;
      }
    });
    return acc;
  }, {});

  // Helper para verificar se irmao esta indisponivel em uma data
  const isIrmaoIndisponivel = (nomeIrmao, data) => {
    const irmao = irmaos.find(i => i.nome === nomeIrmao);
    if (!irmao) return false;
    return irmao.indisponibilidades?.some(ind => ind.data === data) || false;
  };

  // Retorna irmaos disponiveis para uma funcao em uma data
  const getIrmaosDisponiveis = (funcaoId, data) => {
    return irmaos
      .filter(i => 
        i.ativo && 
        i.funcoes.includes(funcaoId) &&
        !isIrmaoIndisponivel(i.nome, data)
      )
      .map(i => i.nome)
      .sort();
  };

  // Retorna todos os irmaos de uma funcao (para fallback)
  const getIrmaosPorFuncao = (funcaoId) => {
    return irmaos
      .filter(i => i.ativo && i.funcoes.includes(funcaoId))
      .map(i => i.nome)
      .sort();
  };

  // Reset para valores padrao
  const resetToDefaults = async () => {
    try {
      await authFetch('/reset', { method: 'POST' });
      
      // Recarrega dados
      const configRes = await authFetch('/config');
      if (configRes.ok) {
        const config = await configRes.json();
        setTituloState(config.titulo);
        setSubtituloState(config.subtitulo);
        setMesState(config.mes);
      }

      const designacoesRes = await authFetch('/designacoes');
      if (designacoesRes.ok) {
        const data = await designacoesRes.json();
        setDesignacoesState(data);
      }

      const irmaosRes = await authFetch('/irmaos');
      if (irmaosRes.ok) {
        const data = await irmaosRes.json();
        setIrmaos(data);
      }
    } catch (error) {
      console.error('Erro ao resetar:', error);
    }
  };

  return (
    <DesignacoesContext.Provider value={{
      titulo,
      subtitulo,
      mes,
      setTitulo,
      setSubtitulo,
      setMes,
      designacoes,
      grupos,
      updateDesignacao,
      updateData,
      updateDia,
      estatisticas,
      loading,
      irmaos,
      isIrmaoIndisponivel,
      getIrmaosDisponiveis,
      getIrmaosPorFuncao,
      resetToDefaults
    }}>
      {children}
    </DesignacoesContext.Provider>
  );
}

export function useDesignacoes() {
  const context = useContext(DesignacoesContext);
  if (!context) {
    throw new Error('useDesignacoes must be used within a DesignacoesProvider');
  }
  return context;
}
