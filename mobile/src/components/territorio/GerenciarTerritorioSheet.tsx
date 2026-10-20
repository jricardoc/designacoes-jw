import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useApagarDesignacao,
  useAtualizarDesignacao,
  useCicloTerritorio,
  useCriarAviso,
  useDesignarTerritorio,
  useDirigentesTerritorio,
  useEditarTerritorio,
  useRemoverAviso,
} from "@/api/hooks/useTerritorios";
import type { TerritorioDetalhe } from "@/api/types";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, spacing, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { AVISOS, diaCurto } from "@/territorios/constantes";

type Aba = "designar" | "avisos" | "dados" | "ciclo";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "designar", rotulo: "Designar" },
  { id: "avisos", rotulo: "Avisos" },
  { id: "dados", rotulo: "Dados" },
  { id: "ciclo", rotulo: "Ciclo" },
];

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Hoje e os próximos 20 dias, para a faixa de calendário: um toque no dia. */
function proximosDias() {
  return Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      iso,
      semana: i === 0 ? "hoje" : SEMANA[d.getDay()],
      dia: d.getDate(),
      mes: MESES[d.getMonth()],
      porExtenso: `${i === 0 ? "Hoje, " : i === 1 ? "Amanhã, " : ""}${SEMANA_LONGA[d.getDay()]}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}`,
      fimDeSemana: d.getDay() === 0 || d.getDay() === 6,
    };
  });
}

/** Acentos e caixa fora da busca: "joao" acha "João". */
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Gestão de um território, para quem cuida da área: designar a um dirigente, avisos fixos
 * ("acesso impedido"), nome/área/apelidos e o ciclo. Confirmações são Alert nativo — um diálogo
 * próprio por cima desta folha seria um modal sobre outro.
 */
export function GerenciarTerritorioSheet({
  territorio: t,
  visible,
  onClose,
}: {
  territorio: TerritorioDetalhe;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const toast = useToast();
  const [aba, setAba] = useState<Aba>("designar");
  const { data: dirigentes } = useDirigentesTerritorio(visible && aba === "designar");
  const designar = useDesignarTerritorio();
  const atualizarDesignacao = useAtualizarDesignacao();
  const apagarDesignacao = useApagarDesignacao();
  const criarAviso = useCriarAviso();
  const removerAviso = useRemoverAviso();
  const editar = useEditarTerritorio();
  const ciclo = useCicloTerritorio();

  const [irmaoId, setIrmaoId] = useState<number | null>(null);
  const [buscaDirigente, setBuscaDirigente] = useState("");
  const [dia, setDia] = useState(proximosDias()[0].iso);
  const [tipoAviso, setTipoAviso] = useState("acesso_impedido");
  const [textoAviso, setTextoAviso] = useState("");
  const [dados, setDados] = useState({ numero: "", nome: "", area: "", apelidos: "", observacoes: "" });

  useEffect(() => {
    if (!visible) return;
    setDados({
      numero: t.numero,
      nome: t.nome,
      area: t.area ?? "",
      apelidos: t.apelidos ?? "",
      observacoes: t.observacoes ?? "",
    });
    setIrmaoId(null);
    setBuscaDirigente("");
    setTextoAviso("");
  }, [visible, t]);

  const rodar = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.show(ok);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Erro", "error");
    }
  };

  const dias = proximosDias();
  const escolhido = dirigentes?.find((d) => d.id === irmaoId);
  const termo = normalizar(buscaDirigente.trim());
  const encontrados = termo ? (dirigentes ?? []).filter((d) => normalizar(d.nome).includes(termo)).slice(0, 6) : [];

  const chip = (ativo: boolean, rotulo: string, onPress: () => void, key?: string) => (
    <Pressable key={key ?? rotulo} onPress={onPress} style={[styles.chip, ativo && styles.chipAtivo]}>
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.corpo}>
        <Text style={styles.titulo}>Território {t.numero}</Text>
        <View style={styles.abas}>
          {ABAS.map((a) => (
            <Pressable key={a.id} onPress={() => setAba(a.id)} style={[styles.aba, aba === a.id && styles.abaAtiva]}>
              <Text style={[styles.abaTexto, aba === a.id && styles.abaTextoAtiva]}>{a.rotulo}</Text>
            </Pressable>
          ))}
        </View>

        {aba === "designar" ? (
          <>
            <Text style={styles.rotulo}>Dirigente</Text>
            {/* Escolhido: fica um destaque só, com "trocar". Sem escolha: busca, e só aparece
                o que bate com o que foi digitado — a lista inteira não cabia na tela. */}
            {irmaoId && escolhido ? (
              <View style={styles.escolhido}>
                <Ionicons name="person-circle" size={24} color={colors.primary} />
                <Text style={styles.escolhidoNome}>{escolhido.nome}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setIrmaoId(null);
                    setBuscaDirigente("");
                  }}
                >
                  <Text style={styles.link}>Trocar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextField
                  icon="search"
                  placeholder="Digite o nome do dirigente"
                  value={buscaDirigente}
                  onChangeText={setBuscaDirigente}
                  autoCorrect={false}
                />
                {encontrados.map((d) => (
                  <Pressable
                    key={d.id}
                    style={styles.resultado}
                    onPress={() => {
                      setIrmaoId(d.id);
                      setBuscaDirigente("");
                    }}
                  >
                    <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.resultadoNome}>{d.nome}</Text>
                  </Pressable>
                ))}
                {buscaDirigente.trim() && encontrados.length === 0 ? (
                  <Text style={styles.ajuda}>Nenhum dirigente com esse nome.</Text>
                ) : null}
                {dirigentes && dirigentes.length === 0 ? (
                  <Text style={styles.ajuda}>Nenhum irmão com a função Dirigente no cadastro de Publicadores.</Text>
                ) : null}
              </>
            )}

            <Text style={styles.rotulo}>Dia da saída</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dias}>
              {dias.map((d) => {
                const ativo = dia === d.iso;
                return (
                  <Pressable
                    key={d.iso}
                    onPress={() => setDia(d.iso)}
                    style={[styles.diaCaixa, d.fimDeSemana && styles.diaFimDeSemana, ativo && styles.diaAtivo]}
                    accessibilityLabel={d.porExtenso}
                  >
                    <Text style={[styles.diaSemana, ativo && styles.diaTextoAtivo]}>{d.semana}</Text>
                    <Text style={[styles.diaNumero, ativo && styles.diaTextoAtivo]}>{d.dia}</Text>
                    <Text style={[styles.diaMes, ativo && styles.diaTextoAtivo]}>{d.mes}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.diaEscolhido}>{dias.find((d) => d.iso === dia)?.porExtenso}</Text>
            <Button
              label="Designar"
              icon="person-add"
              disabled={!irmaoId}
              loading={designar.isPending}
              onPress={() =>
                rodar(() => designar.mutateAsync({ territorioId: t.id, irmaoId: irmaoId!, dia }), "Território designado!")
              }
              fullWidth
            />
            {t.designacoes.length > 0 ? <Text style={styles.rotulo}>Designações</Text> : null}
            {t.designacoes.map((d) => (
              <View key={d.id} style={styles.item}>
                <View style={styles.itemTextos}>
                  <Text style={styles.itemTitulo}>{d.dirigente.nome}</Text>
                  <Text style={styles.itemSub}>
                    {diaCurto(d.dia)}
                    {d.concluidoEm ? ` · concluiu em ${diaCurto(d.concluidoEm)}` : ""}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    rodar(
                      () => atualizarDesignacao.mutateAsync({ id: d.id, acao: d.concluidoEm ? "reabrir" : "concluir" }),
                      d.concluidoEm ? "Conclusão desfeita" : "Marcado como concluído",
                    )
                  }
                >
                  <Text style={styles.link}>{d.concluidoEm ? "Desfazer" : "Concluiu"}</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert("Apagar designação?", `${d.dirigente.nome}, ${diaCurto(d.dia)}`, [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Apagar", style: "destructive", onPress: () => rodar(() => apagarDesignacao.mutateAsync(d.id), "Designação apagada") },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={18} color={colors.red} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {aba === "avisos" ? (
          <>
            {t.avisos.length === 0 ? <Text style={styles.ajuda}>Nenhum aviso neste território.</Text> : null}
            {t.avisos.map((a) => (
              <View key={a.id} style={styles.item}>
                <View style={styles.itemTextos}>
                  <Text style={styles.itemTitulo}>{AVISOS[a.tipo]}</Text>
                  <Text style={styles.itemSub}>{a.texto}</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => rodar(() => removerAviso.mutateAsync(a.id), "Aviso removido")}>
                  <Text style={[styles.link, { color: colors.red }]}>Remover</Text>
                </Pressable>
              </View>
            ))}
            <Text style={styles.rotulo}>Novo aviso</Text>
            <View style={styles.chips}>
              {Object.entries(AVISOS).map(([id, rotulo]) => chip(tipoAviso === id, rotulo, () => setTipoAviso(id), id))}
            </View>
            <TextField placeholder="Ex.: portão fechado depois das 17h" value={textoAviso} onChangeText={setTextoAviso} maxLength={300} />
            <Button
              label="Adicionar aviso"
              icon="warning-outline"
              variant="secondary"
              disabled={textoAviso.trim().length < 3}
              loading={criarAviso.isPending}
              onPress={() =>
                rodar(async () => {
                  await criarAviso.mutateAsync({ id: t.id, tipo: tipoAviso, texto: textoAviso.trim() });
                  setTextoAviso("");
                }, "Aviso adicionado")
              }
              fullWidth
            />
          </>
        ) : null}

        {aba === "dados" ? (
          <>
            <TextField label="Número" value={dados.numero} onChangeText={(v) => setDados({ ...dados, numero: v })} autoCapitalize="characters" />
            <TextField label="Nome" value={dados.nome} onChangeText={(v) => setDados({ ...dados, nome: v })} />
            <TextField label="Área (agrupa na lista)" placeholder="Ex.: Tokaia" value={dados.area} onChangeText={(v) => setDados({ ...dados, area: v })} />
            <TextField
              label="Outros nomes (para a busca)"
              placeholder="Ex.: Condomínio, Cond. Recanto"
              value={dados.apelidos}
              onChangeText={(v) => setDados({ ...dados, apelidos: v })}
            />
            <TextField
              label="Observações"
              value={dados.observacoes}
              onChangeText={(v) => setDados({ ...dados, observacoes: v })}
              multiline
            />
            <Button
              label="Salvar"
              icon="checkmark"
              loading={editar.isPending}
              onPress={() => rodar(() => editar.mutateAsync({ id: t.id, ...dados }), "Território atualizado")}
              fullWidth
            />
            {t.mymaps ? (
              <Text style={styles.ajuda}>
                As quadras vêm da camada “{t.mymaps.camada}” do My Maps. Para mudar o desenho, edite lá e use
                “Atualizar do My Maps” em Territórios › Gerenciar.
              </Text>
            ) : null}
          </>
        ) : null}

        {aba === "ciclo" ? (
          <>
            <Text style={styles.ajuda}>
              Ciclo atual desde {new Date(t.cicloDesde).toLocaleDateString("pt-BR")}. Quando um território concluído recebe
              uma saída nova, o ciclo seguinte começa sozinho.
            </Text>
            <Button
              label="Iniciar novo ciclo"
              icon="refresh"
              variant="secondary"
              loading={ciclo.isPending}
              onPress={() =>
                Alert.alert(
                  "Iniciar novo ciclo?",
                  "O histórico fica guardado. A situação e o \"onde paramos\" recomeçam do zero.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Iniciar", onPress: () => rodar(() => ciclo.mutateAsync({ id: t.id, acao: "novo" }), "Novo ciclo iniciado") },
                  ],
                )
              }
              fullWidth
            />
            <Button
              label={t.naoIniciado ? "Retomar (deixa de ser \"não iniciado\")" : "Marcar \"não iniciado neste ciclo\""}
              icon={t.naoIniciado ? "play" : "pause"}
              variant="secondary"
              loading={ciclo.isPending}
              onPress={() =>
                rodar(
                  () => ciclo.mutateAsync({ id: t.id, acao: t.naoIniciado ? "retomar" : "nao_iniciado" }),
                  "Situação atualizada",
                )
              }
              fullWidth
            />
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    corpo: { gap: spacing.md, paddingBottom: spacing.sm },
    titulo: { fontSize: 21, fontWeight: "800", color: colors.text },
    abas: { flexDirection: "row", gap: 6, backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4 },
    aba: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: "center" },
    abaAtiva: { backgroundColor: colors.primary },
    abaTexto: { fontSize: 13.5, fontWeight: "700", color: colors.textSecondary },
    abaTextoAtiva: { color: colors.textOnPrimary },
    rotulo: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, color: colors.textSecondary },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTexto: { fontSize: 14, fontWeight: "600", color: colors.text },
    chipTextoAtivo: { color: colors.textOnPrimary },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    itemTextos: { flex: 1 },
    itemTitulo: { fontSize: 15, fontWeight: "700", color: colors.text },
    itemSub: { fontSize: 13, color: colors.textSecondary },
    link: { fontSize: 13.5, fontWeight: "800", color: colors.primaryDark },
    ajuda: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    escolhido: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.infoBg,
    },
    escolhidoNome: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.text },
    resultado: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    resultadoNome: { fontSize: 15.5, fontWeight: "600", color: colors.text },
    dias: { gap: 8, paddingRight: 8 },
    diaCaixa: {
      width: 58,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    diaFimDeSemana: { backgroundColor: colors.surfaceMuted },
    diaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    diaSemana: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" },
    diaNumero: { fontSize: 21, fontWeight: "900", color: colors.text },
    diaMes: { fontSize: 11.5, color: colors.textSecondary },
    diaTextoAtivo: { color: colors.textOnPrimary },
    diaEscolhido: { fontSize: 14, fontWeight: "700", color: colors.primaryDark, marginTop: -4 },
  });
