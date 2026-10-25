import { useCallback, useEffect, useRef, useState } from 'react';
import type { DensiVueTelemetry } from '../types/oscilloscope';

export type ConnectionState = 'connecting' | 'live' | 'stale' | 'offline';

export function useDensiVueTelemetry() {
  const [data, setData] = useState<DensiVueTelemetry | null>(null);
  const [state, setState] = useState<ConnectionState>('connecting');
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const hasDataRef = useRef(false);

  const retry = useCallback(() => {
    setState('connecting');
    setRetryKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let failures = 0;

    const poll = async () => {
      controller = new AbortController();
      try {
        const response = await fetch('/api/telemetry', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Telemetry API returned ${response.status}`);
        const next = (await response.json()) as DensiVueTelemetry;
        if (!active) return;
        setData(next);
        hasDataRef.current = true;
        setLastSuccess(Date.now());
        setState('live');
        failures = 0;
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        failures += 1;
        setState(hasDataRef.current ? 'stale' : 'offline');
      } finally {
        if (active) timer = window.setTimeout(poll, Math.min(5000, 1000 * 2 ** Math.min(failures, 2)));
      }
    };

    void poll();
    return () => {
      active = false;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // Polling is independent of response state; refs preserve freshness without restarting it.
  }, [retryKey]);

  return { data, state, lastSuccess, retry };
}
