import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "notif_enabled";

/** Lê a preferência de notificações (padrão: ligado). */
export async function getNotifEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export async function setNotifEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? "1" : "0");
  } catch {
    // ignora — preferência local
  }
}

/** Hook de estado para o toggle de notificações nas Configurações. */
export function useNotifPref() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    getNotifEnabled().then((v) => mounted && setEnabled(v));
    return () => {
      mounted = false;
    };
  }, []);

  const toggle = useCallback(async (value: boolean) => {
    setEnabled(value);
    await setNotifEnabled(value);
  }, []);

  return { enabled, toggle };
}
