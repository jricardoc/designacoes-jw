import { useCallback, useState } from "react";
import type { ConfirmConfig } from "./ConfirmDialog";

/** Manages the open/close state for a single ConfirmDialog instance. */
export function useConfirm() {
  const [config, setConfig] = useState<ConfirmConfig | null>(null);
  const confirm = useCallback((cfg: ConfirmConfig) => setConfig(cfg), []);
  const close = useCallback(() => setConfig(null), []);
  return { config, confirm, close };
}
