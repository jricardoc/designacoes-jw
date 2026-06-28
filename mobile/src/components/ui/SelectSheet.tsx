import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "@/theme";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  badge?: string;
  disabled?: boolean;
}

interface SelectSheetProps {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Adds a "(limpar)" option that selects the empty string. */
  allowClear?: boolean;
}

export function SelectSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  allowClear = true,
}: SelectSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {allowClear ? (
            <Pressable
              style={styles.option}
              onPress={() => {
                onSelect("");
                onClose();
              }}
            >
              <Text style={styles.clearText}>— Limpar —</Text>
            </Pressable>
          ) : null}

          {options.map((opt) => {
            const isSelected = opt.value === selected;
            return (
              <Pressable
                key={opt.value}
                disabled={opt.disabled}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  opt.disabled && styles.optionDisabled,
                  pressed && !opt.disabled && styles.optionPressed,
                ]}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    opt.color ? { color: opt.color } : null,
                    opt.disabled && styles.optionLabelDisabled,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.badge ? (
                  <Text style={[styles.badge, opt.color ? { color: opt.color } : null]}>
                    {opt.badge}
                  </Text>
                ) : null}
                {isSelected ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            );
          })}
          {options.length === 0 ? (
            <Text style={styles.empty}>Nenhuma opção disponível.</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: "75%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  list: { paddingHorizontal: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  optionSelected: { backgroundColor: colors.infoBg },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionDisabled: { opacity: 0.5 },
  optionLabel: { flex: 1, fontSize: 16, color: colors.text },
  optionLabelDisabled: { color: colors.textMuted },
  clearText: { fontSize: 15, color: colors.textSecondary, fontStyle: "italic" },
  badge: { fontSize: 12, fontWeight: "700" },
  empty: { padding: 20, color: colors.textSecondary, textAlign: "center" },
});
