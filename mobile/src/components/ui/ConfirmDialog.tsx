import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radius } from "@/theme";
import { Button } from "./Button";

export interface ConfirmConfig {
  title: string;
  message?: string;
  type?: "danger" | "warning" | "info";
  confirmText?: string;
  cancelText?: string;
  withInput?: boolean;
  inputPlaceholder?: string;
  onConfirm: (inputValue: string) => void | Promise<void>;
}

interface ConfirmDialogProps {
  config: ConfirmConfig | null;
  onClose: () => void;
}

const TYPE_COLOR = {
  danger: colors.redDark,
  warning: colors.amber,
  info: colors.primary,
};

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  danger: "warning",
  warning: "alert-circle",
  info: "information-circle",
};

export function ConfirmDialog({ config, onClose }: ConfirmDialogProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      setInput("");
      setLoading(false);
    }
  }, [config]);

  if (!config) return null;
  const type = config.type ?? "info";
  const accent = TYPE_COLOR[type];

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await config.onConfirm(input);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: accent + "22" }]}>
            <Ionicons name={TYPE_ICON[type]} size={28} color={accent} />
          </View>
          <Text style={styles.title}>{config.title}</Text>
          {config.message ? (
            <Text style={styles.message}>{config.message}</Text>
          ) : null}

          {config.withInput ? (
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={config.inputPlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.input}
            />
          ) : null}

          <View style={styles.actions}>
            <Button
              label={config.cancelText ?? "Cancelar"}
              variant="secondary"
              onPress={onClose}
              style={styles.flex}
            />
            <Button
              label={config.confirmText ?? "Confirmar"}
              variant={type === "danger" ? "danger" : "primary"}
              loading={loading}
              onPress={handleConfirm}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  input: {
    alignSelf: "stretch",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
    color: colors.text,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 12,
  },
  flex: { flex: 1 },
});
