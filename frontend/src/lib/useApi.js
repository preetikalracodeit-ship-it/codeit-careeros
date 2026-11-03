import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

export function useApi(path, options = {}) {
  const { enabled = true, params } = options;
  const [state, setState] = useState({ data: null, loading: Boolean(enabled), error: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: "" });
      return undefined;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    api
      .get(path, params ? { params } : undefined)
      .then((data) => {
        if (active) setState({ data, loading: false, error: "" });
      })
      .catch((reason) => {
        if (active) setState({ data: null, loading: false, error: reason.message || "Unable to load this section." });
      });
    return () => {
      active = false;
    };
  }, [path, reloadKey, enabled, JSON.stringify(params)]);

  return { ...state, reload };
}
