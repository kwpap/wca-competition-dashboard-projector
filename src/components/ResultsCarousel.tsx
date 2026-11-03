import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultRow, ResultsCache, RoundResults } from '../api/results';
import { RESULTS_FADE_MS, RESULTS_FRESH_MS, RESULTS_ROWS_PER_PAGE, RESULTS_ROWS_PER_PAGE_WIDE } from '../config';
import { formatResult } from '../format/result';
import { dayKey } from '../format/time';
import { roundCode } from '../model/activityCode';
import { attemptCount } from '../model/attempts';
import type { CompetitionModel } from '../model/competition';
import { labelParts } from '../model/labels';
import { newScheduleMemory, nextPage, type RoundSummary } from '../model/resultsSchedule';

interface ResultsCarouselProps {
  model: CompetitionModel;
  results: ResultsCache | null;
  /** How long each page stays. */
  pageMs: number;
  /** Full-width layout, with a column per attempt. */
  wide?: boolean;
}

interface Page {
  key: string;
  round: RoundResults;
  rows: ResultRow[];
  pageNumber: number;
  pageCount: number;
}

/** Keeps only the latest round with results of each event. */
function latestRounds(rounds: RoundResults[]): RoundResults[] {
  const latest = new Map<string, RoundResults>();
  for (const round of rounds) {
    if (round.rows.length === 0) continue;
    const kept = latest.get(round.eventId);
    if (!kept || round.roundNumber > kept.roundNumber) latest.set(round.eventId, round);
  }
  return [...latest.values()];
}

function buildPages(model: CompetitionModel, results: ResultsCache | null, rowsPerPage: number): Page[] {
  const rounds = latestRounds(results?.rounds ?? []).sort((a, b) => {
    const startA = model.roundStarts.get(a.roundCode) ?? 0;
    const startB = model.roundStarts.get(b.roundCode) ?? 0;
    return startA - startB;
  });

  const pages: Page[] = [];
  for (const round of rounds) {
    const rows = [...round.rows].sort((a, b) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity));
    const pageCount = Math.ceil(rows.length / rowsPerPage);
    for (let i = 0; i < pageCount; i++) {
      pages.push({
        key: `${round.roundCode}#${i + 1}`,
        round,
        rows: rows.slice(i * rowsPerPage, (i + 1) * rowsPerPage),
        pageNumber: i + 1,
        pageCount,
      });
    }
  }
  return pages;
}

/** Per-round facts the schedule needs, in schedule order. */
function summarize(model: CompetitionModel, pages: Page[], changedAt: Map<string, number>, now: number): RoundSummary[] {
  const today = dayKey(now, model.timezone);
  const summaries = new Map<string, RoundSummary>();
  for (const page of pages) {
    const code = page.round.roundCode;
    let summary = summaries.get(code);
    if (!summary) {
      const start = model.roundStarts.get(code);
      summary = {
        roundCode: code,
        pageCount: page.pageCount,
        lastChange: null,
        newestPage: 0,
        today: start !== undefined && dayKey(start, model.timezone) === today,
      };
      summaries.set(code, summary);
    }
    for (const row of page.rows) {
      const changed = changedAt.get(rowKey(page.round, row));
      if (changed !== undefined && (summary.lastChange === null || changed > summary.lastChange)) {
        summary.lastChange = changed;
        summary.newestPage = page.pageNumber - 1;
      }
    }
  }
  return [...summaries.values()];
}

function rowKey(round: RoundResults, row: ResultRow): string {
  return `${round.roundCode}:${row.registrantId}`;
}

function rowSignature(row: ResultRow): string {
  return `${row.best}|${row.average}|${row.ranking}`;
}

/** Remembers when each row last changed, so new results can be highlighted. */
function useChangedRows(results: ResultsCache | null): Map<string, number> {
  const signatures = useRef<Map<string, string> | null>(null);
  const [changedAt, setChangedAt] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    const next = new Map<string, string>();
    for (const round of results?.rounds ?? []) {
      for (const row of round.rows) next.set(rowKey(round, row), rowSignature(row));
    }

    const previous = signatures.current;
    signatures.current = next;
    // The first data is not "new": only highlight changes seen while the screen is running.
    if (!previous) return;

    const now = Date.now();
    const changed: string[] = [];
    for (const [key, signature] of next) {
      if (previous.get(key) !== signature) changed.push(key);
    }
    if (changed.length === 0) return;
    setChangedAt((old) => {
      const updated = new Map(old);
      for (const key of changed) updated.set(key, now);
      return updated;
    });
  }, [results]);

  return changedAt;
}

/** Empty for attempts not done yet (0 or missing). */
function attemptText(attempt: number | undefined, eventId: string): string {
  if (!attempt) return '';
  return formatResult(attempt, eventId, 'single');
}

function RecordTag({ tag }: { tag: string | null }) {
  if (!tag || tag === 'PR') return null;
  return <span className={`record-tag tag-${tag === 'WR' || tag === 'NR' ? tag : 'CR'}`}>{tag}</span>;
}

export function ResultsCarousel({ model, results, pageMs, wide = false }: ResultsCarouselProps) {
  const { t } = useTranslation();
  const rowsPerPage = wide ? RESULTS_ROWS_PER_PAGE_WIDE : RESULTS_ROWS_PER_PAGE;
  const pages = useMemo(() => buildPages(model, results, rowsPerPage), [model, results, rowsPerPage]);
  const changedAt = useChangedRows(results);

  // Track the shown page by key, so new results do not make the carousel jump.
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [turn, setTurn] = useState(0);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const changedRef = useRef(changedAt);
  changedRef.current = changedAt;
  const memory = useRef(newScheduleMemory());

  const index = Math.max(0, pages.findIndex((p) => p.key === pageKey));
  const page = pages[index] as Page | undefined;
  const hasNextPage = pages.length > 1;

  useEffect(() => {
    if (!hasNextPage || !page) return;
    const fadeTimer = setTimeout(() => setLeaving(true), pageMs - RESULTS_FADE_MS);
    const pageTimer = setTimeout(() => {
      const now = Date.now();
      const rounds = summarize(model, pagesRef.current, changedRef.current, now);
      const position = { roundCode: page.round.roundCode, page: page.pageNumber - 1 };
      const next = nextPage(rounds, position, memory.current, now);
      setPageKey(next ? `${next.roundCode}#${next.page + 1}` : null);
      setTurn((n) => n + 1);
      setLeaving(false);
    }, pageMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(pageTimer);
    };
    // Not "page": a new results poll must not restart the page timer.
    // "turn" restarts it even when the schedule picks the page already shown.
  }, [model, page?.key, turn, hasNextPage, pageMs]);

  if (!page) {
    return (
      <section className="results-carousel empty">
        <p>{t('results.none')}</p>
      </section>
    );
  }

  const { round } = page;
  const format = model.rounds.get(round.roundCode)?.format ?? 'a';
  const hasAverage = format === 'a' || format === 'm';
  const attemptColumns = wide ? Array.from({ length: attemptCount(format) }, (_, i) => i) : [];
  const label = labelParts(t, model, roundCode(round.eventId, round.roundNumber), round.roundCode);
  const now = Date.now();

  return (
    <section className={wide ? 'results-carousel results-wide' : 'results-carousel'}>
      <div key={`${page.key}-${turn}`} className={leaving ? 'results-page leaving' : 'results-page'}>
        <header>
          <h2>
            {label.title} <span className="muted">{label.parts.join(' · ')}</span>
          </h2>
          <span className="muted">{t('results.page', { page: page.pageNumber, count: page.pageCount })}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>{t('results.name')}</th>
              {attemptColumns.map((i) => (
                <th key={i} className="result-attempt">
                  {i + 1}
                </th>
              ))}
              {hasAverage && <th>{t('results.average')}</th>}
              <th>{t('results.best')}</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => {
              const changed = changedAt.get(rowKey(round, row));
              const fresh = changed !== undefined && now - changed < RESULTS_FRESH_MS;
              return (
                <tr key={row.registrantId} className={fresh ? 'row-fresh' : undefined}>
                  <td>{row.ranking ?? ''}</td>
                  <td className="result-name">{row.name}</td>
                  {attemptColumns.map((i) => (
                    <td key={i} className="result-attempt">
                      {attemptText(row.attempts[i], round.eventId)}
                    </td>
                  ))}
                  {hasAverage && (
                    <td className="result-main">
                      {formatResult(row.average, round.eventId, 'average')} <RecordTag tag={row.averageTag} />
                    </td>
                  )}
                  <td className={hasAverage ? '' : 'result-main'}>
                    {formatResult(row.best, round.eventId, 'single')} <RecordTag tag={row.singleTag} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasNextPage && (
        <div className="results-progress">
          <div key={`${page.key}-${turn}`} className="results-progress-fill" style={{ animationDuration: `${pageMs}ms` }} />
        </div>
      )}
    </section>
  );
}
