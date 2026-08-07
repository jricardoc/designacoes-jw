import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { radius, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

const fillDe = (colors: Cores): Record<Variant, string> => ({
  primary: colors.primary,
  success: colors.primary,
  danger: colors.red,
  secondary: colors.surface,
  ghost: "transparent",
});

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  fullWidth,
}: ButtonProps) {
  const { colors, styles } = useTema(criarEstilos);
  const isDisabled = disabled || loading;
  const tint = textColor(variant, colors);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: fillDe(colors)[variant] },
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <View style={styles.inner}>
          {icon && <Ionicons name={icon} size={18} color={tint} />}
          <Text style={[styles.label, { color: tint }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function textColor(variant: Variant, colors: Cores): string {
  if (variant === "secondary") return colors.text;
  if (variant === "ghost") return colors.primary;
  return colors.textOnPrimary;
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.md,
      paddingVertical: 13,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    fullWidth: { alignSelf: "stretch" },
    inner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    label: { fontWeight: "600", fontSize: 15 },
    secondary: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    ghost: { paddingVertical: 8 },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  });
