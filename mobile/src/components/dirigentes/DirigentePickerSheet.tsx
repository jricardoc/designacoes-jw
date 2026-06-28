import { Ionicons } from "@expo/vector-icons";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sheet } from "@/components/ui";
import { colors } from "@/theme";

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

export interface PickerPerson {
  nome: string;
  load: number;
}

interface Props {
  visible: boolean;
  title: string;
  sub?: string;
  people: PickerPerson[];
  current?: string | null;
  onSelect: (nome: string) => void;
  onClose: () => void;
}

const LIST_MAX = Math.round(Dimensions.get("window").height * 0.5);

/** Picker de dirigente/substituto (ordenado por carga), fiel ao design. */
export function DirigentePickerSheet({ visible, title, sub, people, current, onSelect, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} maxHeightPct={0.8} flush>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {sub ? (
            <Text style={styles.sub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#7A7060" />
        </Pressable>
      </View>

      <View style={styles.hintRow}>
        <Ionicons name="funnel-outline" size={12} color="#B0A488" />
        <Text style={styles.hint}>Ordenado por menor carga · disponíveis para esta saída</Text>
      </View>

      <ScrollView style={{ maxHeight: LIST_MAX }} contentContainerStyle={styles.list}>
        <Pressable
          onPress={() => {
            onSelect("");
            onClose();
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.clearIcon}>
            <Ionicons name="remove" size={16} color="#A99E8B" />
          </View>
          <Text style={styles.clearText}>Sem designação</Text>
        </Pressable>

        {people.length === 0 ? (
          <Text style={styles.empty}>
            Nenhum irmão disponível para esta saída.{"\n"}Ajuste as disponibilidades em Configurações.
          </Text>
        ) : (
          people.map((p) => {
            const isCurrent = p.nome === current;
            return (
              <Pressable
                key={p.nome}
                onPress={() => {
                  onSelect(p.nome);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  isCurrent && styles.rowCurrent,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(p.nome)}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {p.nome}
                </Text>
                <View style={styles.loadBadge}>
                  <Text style={styles.loadText}>{p.load}x</Text>
                </View>
                {isCurrent ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1EAD9",
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.text },
  sub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 2 },
  hint: { fontSize: 11.5, color: "#A99E8B" },
  list: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 13,
  },
  rowCurrent: { backgroundColor: colors.infoBg },
  pressed: { backgroundColor: "#F3ECDD" },
  clearIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#F1EAD9",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.textSecondary },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: colors.brown },
  name: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.text },
  loadBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  loadText: { fontSize: 11.5, fontWeight: "700", color: colors.primaryDark },
  empty: {
    textAlign: "center",
    color: "#B0A48E",
    fontSize: 13.5,
    paddingVertical: 22,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  flex: { flex: 1, minWidth: 0 },
});
