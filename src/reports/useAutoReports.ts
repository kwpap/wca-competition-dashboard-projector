import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { incidentsToMarkdown } from '../incidents/exportMarkdown';
import type { Incident } from '../incidents/types';
import type { CompetitionModel } from '../model/competition';
import type { LogEntry } from '../model/scheduleEngine';
import { isServerAvailable, saveReport } from '../state/server';
import { scheduleLogCsv } from './scheduleLog';

const SAVE_DELAY_MS = 2000;

export const REPORT_FILES = {
  scheduleLog: 'schedule-log.csv',
  incidents: 'incidents.md',
};

/**
 * Rewrites reports/<competition>/ shortly after the log or the incidents change.
 * Returns the time of the last successful save, or null.
 */
export function useAutoReports(model: CompetitionModel, log: LogEntry[], incidents: Incident[]): number | null {
  const { t, i18n } = useTranslation();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isServerAvailable()) return;
    const timer = setTimeout(async () => {
      const id = model.wcif.id;
      try {
        const logSaved = await saveReport(id, REPORT_FILES.scheduleLog, scheduleLogCsv(t, model, log, i18n.language));
        const incidentsSaved = await saveReport(
          id,
          REPORT_FILES.incidents,
          incidentsToMarkdown(t, model, incidents, i18n.language),
        );
        if (logSaved && incidentsSaved) setSavedAt(Date.now());
      } catch (error) {
        console.warn('Could not save reports', error);
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [model, log, incidents, t, i18n.language]);

  return savedAt;
}
