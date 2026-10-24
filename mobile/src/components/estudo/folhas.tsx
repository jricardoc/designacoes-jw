import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useApagarRotina, useMarcarLeitura, usePerfilEstudo, useRegistrarEstudo, useSalvarAssunto, useSalvarRotina } from "@/api/hooks/useEstudo";
import type { AssuntoEstudo, PerfilEstudo, RotinaEstudo, TipoAssunto, TipoRotina } from "@/api/types";
import { useCelebracao } from "@/components/celebracao/contextoCelebracao";
import type { Icone } from "@/components/ministerio/kit";
import { Contador, SeletorDia, SeletorHora } from "@/components/ministerio/escolhas";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";
import { ehLinkJw, TIPOS_ASSUNTO, TIPOS_ROTINA } from "./dicas";

/** As folhas do Estudo pessoal: assunto, rotina, plano B, estudo registrado à mão e a joia de uma leitura. */

const erroDe = (e: unknown) => (e instanceof Error ? e.message : "Não deu para salvar");

/** Fichas de escolha (uma ou várias). */
export function Fichas<T extends string | number>({
  opcoes,
  valor,
  onMudar,
}: {
  opcoes: { valor: T; rotulo: string; icone?: Icone }[];
  valor: T | T[];
  onMudar: (v: T) => void;
}) {
  const { colors, styles } = useTema(criarEstilos);
  const marcado = (v: T) => (Array.isArray(valor) ? valor.includes(v) : valor === v);
  return (
    <View style={styles.fichas}>
      {opcoes.map((o) => {
        const ativo = marcado(o.valor);
        return (
          <Pressable
            key={String(o.valor)}
            onPress={() => onMudar(o.valor)}
            style={[styles.ficha, ativo && styles.fichaAtiva]}
            accessibilityRole={Array.isArray(valor) ? "checkbox" : "radio"}
            accessibilityState={Array.isArray(valor) ? { checked: ativo } : { selected: ativo }}
          >
            {o.icone ? <Ionicons name={o.icone} size={15} color={ativo ? colors.textOnPrimary : colors.textSecondary} /> : null}
            <Text style={[styles.fichaTexto, ativo && styles.fichaTextoAtiva]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const OPCOES_TIPO = (Object.keys(TIPOS_ASSUNTO) as TipoAssunto[]).map((t) => ({ valor: t, rotulo: TIPOS_ASSUNTO[t].rotulo, icone: TIPOS_ASSUNTO[t].icone }));

/** Anotar (ou editar) um assunto, artigo ou pergunta para estudar. Link só do jw.org ou do wol. */
export function AssuntoSheet({
  visible,
  onClose,
  assunto,
  inicial,
}: {
  visible: boolean;
  onClose: () => void;
  assunto?: AssuntoEstudo | null;
  inicial?: { tipo?: TipoAssunto; titulo?: string; link?: string };
}) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const salvar = useSalvarAssunto();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoAssunto>("assunto");
  const [link, setLink] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTitulo(assunto?.titulo ?? inicial?.titulo ?? "");
    setTipo(assunto?.tipo ?? inicial?.tipo ?? "assunto");
    setLink(assunto?.link ?? inicial?.link ?? "");
    setNota(assunto?.nota ?? "");
  }, [visible, assunto, inicial]);

  const linkRuim = !!link.trim() && !ehLinkJw(link);
  const ideia = TIPOS_ASSUNTO[tipo].ideia;

  const ok = () =>
    salvar.mutate(
      { id: assunto?.id, titulo: titulo.trim(), tipo, link: link.trim() || null, nota: nota.trim() || null },
      {
        onSuccess: () => {
          onClose();
          toast.show(assunto ? "Assunto atualizado" : "Na lista para estudar");
        },
        onError: (e) => toast.show(erroDe(e), "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>{assunto ? "Editar assunto" : "Anotar para estudar"}</Text>
        <Fichas opcoes={OPCOES_TIPO} valor={tipo} onMudar={setTipo} />
        {ideia ? <Text style={styles.ajuda}>{ideia}</Text> : null}
        <TextField label="O que estudar" value={titulo} onChangeText={setTitulo} maxLength={200} placeholder="Um assunto, um artigo, uma pergunta..." />
        <TextField
          label="Link (opcional)"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://www.jw.org/... ou https://wol.jw.org/..."
        />
        {linkRuim ? <Text style={styles.erro}>Só links do jw.org ou da Biblioteca On-line.</Text> : null}
        <TextField label="Anotação (opcional)" value={nota} onChangeText={setNota} maxLength={1000} multiline />
        <Button label="Salvar" icon="checkmark" onPress={ok} loading={salvar.isPending} disabled={!titulo.trim() || linkRuim} fullWidth />
      </View>
    </Sheet>
  );
}

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const AVISOS: { valor: number; rotulo: string }[] = [
  { valor: -1, rotulo: "Sem aviso" },
  { valor: 0, rotulo: "Na hora" },
  { valor: 15, rotulo: "15 min antes" },
  { valor: 30, rotulo: "30 min antes" },
  { valor: 60, rotulo: "1 h antes" },
];

/** Um item da programação: o que, em que dias, a que horas e quando avisar. */
export function RotinaSheet({ visible, onClose, item }: { visible: boolean; onClose: () => void; item?: RotinaEstudo | null }) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const salvar = useSalvarRotina();
  const apagar = useApagarRotina();
  const [tipo, setTipo] = useState<TipoRotina>("leitura");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hora, setHora] = useState("07:00");
  const [aviso, setAviso] = useState(15);

  useEffect(() => {
    if (!visible) return;
    setTipo(item?.tipo ?? "leitura");
    setDias(item?.dias ?? [1, 2, 3, 4, 5]);
    setHora(item?.hora ?? "07:00");
    setAviso(item ? (item.avisoMin ?? -1) : 15);
  }, [visible, item]);

  const alternar = (d: number) => setDias((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d].sort()));
  const ok = () =>
    salvar.mutate(
      { id: item?.id, tipo, dias, hora, avisoMin: aviso < 0 ? null : aviso },
      {
        onSuccess: () => {
          onClose();
          toast.show(item ? "Rotina atualizada" : "Na sua rotina");
        },
        onError: (e) => toast.show(erroDe(e), "error"),
      },
    );
  const remover = () =>
    Alert.alert("Tirar da rotina?", undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Tirar", style: "destructive", onPress: () => item && apagar.mutate(item.id, { onSuccess: onClose, onError: (e) => toast.show(erroDe(e), "error") }) },
    ]);

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>{item ? "Editar a rotina" : "Na minha rotina"}</Text>
        <Fichas
          opcoes={(Object.keys(TIPOS_ROTINA) as TipoRotina[]).map((t) => ({ valor: t, rotulo: TIPOS_ROTINA[t].rotulo, icone: TIPOS_ROTINA[t].icone }))}
          valor={tipo}
          onMudar={setTipo}
        />
        <Text style={styles.rotulo}>Dias</Text>
        <View style={styles.dias}>
          {DIAS.map((d, i) => {
            const ativo = dias.includes(i);
            return (
              <Pressable
                key={i}
                onPress={() => alternar(i)}
                style={[styles.dia, ativo && styles.fichaAtiva]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ativo }}
                accessibilityLabel={["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][i]}
              >
                <Text style={[styles.fichaTexto, ativo && styles.fichaTextoAtiva]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rotulo}>Horário</Text>
        <SeletorHora valor={hora} onMudar={setHora} de={4} ate={23} />
        <Text style={styles.rotulo}>Aviso no celular</Text>
        <Fichas opcoes={AVISOS} valor={aviso} onMudar={setAviso} />
        <Button label="Salvar" icon="checkmark" onPress={ok} loading={salvar.isPending} disabled={!dias.length} fullWidth />
        {item ? <Button label="Tirar da rotina" icon="trash-outline" variant="ghost" onPress={remover} fullWidth /> : null}
      </View>
    </Sheet>
  );
}

/** O plano B da leitura: se até essa hora não houve leitura no dia, o celular avisa. */
export function PlanoBSheet({ visible, onClose, perfil }: { visible: boolean; onClose: () => void; perfil: PerfilEstudo }) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const salvar = usePerfilEstudo();
  const [hora, setHora] = useState("21:00");
  useEffect(() => {
    if (visible) setHora(perfil.planoB ?? "21:00");
  }, [visible, perfil.planoB]);
  const gravar = (planoB: string | null) =>
    salvar.mutate({ planoB }, { onSuccess: onClose, onError: (e) => toast.show(erroDe(e), "error") });
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Plano B da leitura</Text>
        <Text style={styles.ajuda}>Se até essa hora não houver leitura no dia, o celular lembra: para nenhum dia passar sem leitura.</Text>
        <SeletorHora valor={hora} onMudar={setHora} de={12} ate={23} />
        <Button label="Salvar" icon="checkmark" onPress={() => gravar(hora)} loading={salvar.isPending} fullWidth />
        {perfil.planoB ? <Button label="Sem plano B" variant="ghost" onPress={() => gravar(null)} fullWidth /> : null}
      </View>
    </Sheet>
  );
}

/** Um estudo já feito, sem o cronômetro: o dia, quanto tempo e o que estudou. */
export function RegistrarEstudoSheet({ visible, onClose, assuntos }: { visible: boolean; onClose: () => void; assuntos: AssuntoEstudo[] }) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const { feito } = useCelebracao();
  const registrar = useRegistrarEstudo();
  const hojeIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [dia, setDia] = useState(hojeIso);
  const [minutos, setMinutos] = useState(30);
  const [assuntoId, setAssuntoId] = useState<number>(0);
  const [titulo, setTitulo] = useState("");
  const [resumo, setResumo] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDia(hojeIso());
    setMinutos(30);
    setAssuntoId(0);
    setTitulo("");
    setResumo("");
  }, [visible]);

  const pendentes = assuntos.filter((a) => !a.estudadoEm).slice(0, 8);
  const ok = () =>
    registrar.mutate(
      { dia, minutos, assuntoId: assuntoId || null, titulo: titulo.trim() || undefined, resumo: resumo.trim() || undefined },
      {
        onSuccess: () => {
          onClose();
          feito({ titulo: "Estudo registrado", detalhe: `${minutos} min`, icone: "bulb" });
        },
        onError: (e) => toast.show(erroDe(e), "error"),
      },
    );

  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Registrar um estudo</Text>
        <SeletorDia valor={dia} onMudar={setDia} sentido="passado" />
        <View style={styles.linha}>
          <Text style={[styles.rotulo, styles.flex]}>Minutos</Text>
          <Contador valor={minutos} onMudar={setMinutos} min={5} max={600} passo={5} rotulo="minutos" />
        </View>
        {pendentes.length ? (
          <>
            <Text style={styles.rotulo}>Assunto da lista</Text>
            <Fichas opcoes={[{ valor: 0, rotulo: "Outro" }, ...pendentes.map((a) => ({ valor: a.id, rotulo: a.titulo }))]} valor={assuntoId} onMudar={setAssuntoId} />
          </>
        ) : null}
        {!assuntoId ? <TextField label="O que estudou" value={titulo} onChangeText={setTitulo} maxLength={200} /> : null}
        <TextField label="Resumo numa frase (opcional)" value={resumo} onChangeText={setResumo} maxLength={1000} multiline />
        <Button label="Registrar" icon="checkmark" onPress={ok} loading={registrar.isPending} fullWidth />
      </View>
    </Sheet>
  );
}

/** A joia espiritual de uma leitura: uma anotação curta (e o trecho fica marcado como lido). */
export function JoiaSheet({
  visible,
  onClose,
  plano,
  item,
  titulo,
  nota,
}: {
  visible: boolean;
  onClose: () => void;
  plano: PerfilEstudo["plano"];
  item: string;
  titulo: string;
  nota: string | null;
}) {
  const { styles } = useTema(criarEstilos);
  const toast = useToast();
  const marcar = useMarcarLeitura();
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (visible) setTexto(nota ?? "");
  }, [visible, nota]);
  const ok = () =>
    marcar.mutate({ plano, itens: [item], nota: texto.trim() || null }, { onSuccess: onClose, onError: (e) => toast.show(erroDe(e), "error") });
  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Joia espiritual</Text>
        <Text style={styles.ajuda}>
          {titulo}. Que princípios o relato ensina? O que você aprende sobre Jeová? Como pode aplicar?
        </Text>
        <TextField label="Anotação" value={texto} onChangeText={setTexto} maxLength={1000} multiline autoFocus />
        <Button label="Salvar" icon="checkmark" onPress={ok} loading={marcar.isPending} fullWidth />
      </View>
    </Sheet>
  );
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    flex: { flex: 1 },
    conteudo: { gap: 12, paddingBottom: 8 },
    titulo: { fontSize: 20, fontWeight: "800", color: colors.text },
    ajuda: { fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
    erro: { fontSize: 13, fontWeight: "700", color: colors.red },
    rotulo: { fontSize: 13, fontWeight: "800", color: colors.textSecondary, marginTop: 2 },
    linha: { flexDirection: "row", alignItems: "center", gap: 10 },
    fichas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    ficha: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    fichaAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
    fichaTexto: { fontSize: 13.5, fontWeight: "700", color: colors.textSecondary },
    fichaTextoAtiva: { color: colors.textOnPrimary },
    dias: { flexDirection: "row", gap: 6 },
    dia: {
      flex: 1,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
