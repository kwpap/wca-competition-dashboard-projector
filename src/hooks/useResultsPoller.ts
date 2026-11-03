import { useEffect } from 'react';
import { fetchResults, type ResultsCache } from '../api/results';
import { RESULTS_POLL_MS } from '../config';
import { readJson, storageKeys } from '../state/storage';
import type { Wcif } from '../types/wcif';

/** Polls results while mounted. Only the control window polls; the projector reads the shared cache. */
export function useResultsPoller(wcif: Wcif | null, save: (results: ResultsCache) => void): void {
  useEffect(() => {
    if (!wcif) return;
    let cancelled = false;

    async function poll() {
      if (!wcif) return;
      try {
        const previous = readJson<ResultsCache | null>(storageKeys.results(wcif.id), null);
        const next = await fetchResults(wcif, previous);
        if (!cancelled) save(next);
      } catch (error) {
        console.warn('Results update failed', error);
      }
    }

    poll();
    const timer = setInterval(poll, RESULTS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [wcif, save]);
}
