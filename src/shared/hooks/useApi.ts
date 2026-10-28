"use client";

import * as React from "react";
import { apiFetch, errorMessage } from "@/modules/shared/api";

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
};

/**
 * Minimal data-fetching hook: no global cache, always authoritative.
 * Re-fetches on window focus so a screen left open cannot silently go stale.
 */
export function useApi<T>(path: string | null, options: { pollMs?: number } = {}): ApiState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(path));
  const activeRef = React.useRef(true);

  const refresh = React.useCallback(
    async (refreshOptions: { silent?: boolean } = {}) => {
      if (!path) return;
      if (!refreshOptions.silent) setLoading(true);
      try {
        const result = await apiFetch<T>(path);
        if (!activeRef.current) return;
        setData(result);
        setError(null);
      } catch (caught) {
        if (!activeRef.current) return;
        setError(errorMessage(caught));
      } finally {
        if (activeRef.current) setLoading(false);
      }
    },
    [path],
  );

  React.useEffect(() => {
    activeRef.current = true;
    void refresh();
    return () => {
      activeRef.current = false;
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!options.pollMs || !path) return;
    const interval = setInterval(() => void refresh({ silent: true }), options.pollMs);
    return () => clearInterval(interval);
  }, [options.pollMs, path, refresh]);

  React.useEffect(() => {
    const onFocus = () => void refresh({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { data, error, loading, refresh, setData };
}
