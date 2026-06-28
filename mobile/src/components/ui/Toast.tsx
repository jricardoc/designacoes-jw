import { Ionicons } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow } from "@/theme";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TYPE_STYLE: Record<
  ToastType,
  { bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  success: { bg: colors.greenDark, icon: "checkmark-circle" },
  error: { bg: colors.redDark, icon: "alert-circle" },
  info: { bg: colors.primaryDark, icon: "information-circle" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), 3200);
    },
    [remove],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="none">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: ToastItem }) {
  const anim = useRef(new Animated.Value(0)).current;
  const conf = TYPE_STYLE[toast.type];

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: conf.bg },
        shadow.card,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name={conf.icon} size={20} color="#fff" />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    gap: 8,
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    maxWidth: 480,
    width: "100%",
  },
  text: { color: "#fff", fontWeight: "600", flex: 1 },
});
