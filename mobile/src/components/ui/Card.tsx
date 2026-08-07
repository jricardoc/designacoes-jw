import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import { radius, shadow, type Cores } from "@/theme";
import { useTema } from "@/theme/TemaContext";

interface CardProps extends ViewProps {
  onPress?: () => void;
  accentColor?: string;
}

export function Card({
  children,
  style,
  onPress,
  accentColor,
  ...rest
}: CardProps) {
  const { styles } = useTema(criarEstilos);
  const content = (
    <View style={[styles.card, shadow.card, style]} {...rest}>
      {accentColor ? (
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
      ) : null}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const criarEstilos = (colors: Cores) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      overflow: "hidden",
    },
    accent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 4,
    },
    pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  });
