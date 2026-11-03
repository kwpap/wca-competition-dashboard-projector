import type { TFunction } from 'i18next';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ResultRow, ResultsCache, RoundResults } from '../api/results';
import { formatResult } from '../format/result';
import { dayKey, formatClock, toMinutes } from '../format/time';
import type { Incident } from '../incidents/types';
import { countryName } from '../model/announcements';
import { isAppSlot, type CompetitionModel, type RoomInfo } from '../model/competition';
import { activityLabel } from '../model/labels';
import type { LogEntry } from '../model/scheduleEngine';
import type { RoundFormat } from '../types/wcif';

export interface ReportInput {
  t: TFunction;
  language: string;
  model: CompetitionModel;
  log: LogEntry[];
  incidents: Incident[];
  results: ResultsCache | null;
}

export interface ReportFile {
  /** Name inside reports/<competition>/. */
  name: string;
  blob: Blob;
}

/** A start within this many minutes of the plan counts as on time. */
const ON_TIME_MINUTES = 5;
const CUBE_COLORS = ['#029347', '#c62535', '#0051ba', '#ff5800', '#ffd313', '#e5e7eb'];
const PAGE_WIDTH = 595.28;
const LATE_COLOR = '#c62535';
const EARLY_COLOR = '#029347';

// ---------- shared layout ----------

function dateText(ms: number, input: ReportInput): string {
  return new Date(ms).toLocaleDateString(input.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: input.model.timezone,
  });
}

function signed(minutes: number): string {
  return minutes > 0 ? `+${minutes}` : String(minutes);
}

function diffCell(minutes: number | null): TableCell {
  if (minutes === null) return '';
  const color = minutes > 0 ? LATE_COLOR : minutes < 0 ? EARLY_COLOR : undefined;
  return { text: signed(minutes), color, alignment: 'right', bold: minutes !== 0 };
}

function headerRow(cells: string[]): TableCell[] {
  return cells.map((text) => ({ text, style: 'tableHeader' }));
}

/** Striped table with a colored header row. */
function table(widths: (string | number)[], header: string[], rows: TableCell[][]): Content {
  return {
    table: { headerRows: 1, widths, body: [headerRow(header), ...rows] },
    layout: {
      fillColor: (row: number) => (row === 0 ? '#0051ba' : row % 2 === 0 ? '#f3f5f8' : null),
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 12],
  };
}

function summaryTable(rows: [string, string][]): Content {
  return {
    table: {
      widths: ['*', 'auto'],
      body: rows.map(([label, value]) => [{ text: label, color: '#4b5563' }, { text: value, bold: true, alignment: 'right' }]),
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 14],
  };
}

function frame(input: ReportInput, title: string, content: Content[]): TDocumentDefinitions {
  const { t, model, language } = input;
  const generated = `${new Date().toLocaleDateString(language, { timeZone: model.timezone })} ${formatClock(Date.now(), model.timezone, language)}`;
  const stripeWidth = PAGE_WIDTH / CUBE_COLORS.length;
  return {
    pageSize: 'A4',
    pageMargins: [40, 72, 40, 48],
    info: { title: `${title} - ${model.wcif.name}`, creator: 'WCA Stage' },
    background: () => ({
      canvas: CUBE_COLORS.map((color, i) => ({ type: 'rect', x: i * stripeWidth, y: 0, w: stripeWidth, h: 6, color })),
    }),
    header: {
      margin: [40, 24, 40, 0],
      columns: [
        { text: model.wcif.name, style: 'headerName' },
        { text: title, style: 'headerTitle', alignment: 'right' },
      ],
    },
    footer: (page: number, pages: number) => ({
      margin: [40, 16, 40, 0],
      columns: [
        { text: `WCA Stage · ${t('reports.generated', { time: generated })}`, style: 'footer' },
        { text: `${page} / ${pages}`, style: 'footer', alignment: 'right' },
      ],
    }),
    content,
    styles: {
      headerName: { fontSize: 9, color: '#6b7280' },
      headerTitle: { fontSize: 9, bold: true, color: '#0051ba' },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 10, color: '#6b7280', margin: [0, 0, 0, 14] },
      section: { fontSize: 13, bold: true, color: '#0051ba', margin: [0, 6, 0, 6] },
      day: { fontSize: 11, bold: true, margin: [0, 4, 0, 4] },
      tableHeader: { bold: true, color: '#ffffff', fontSize: 8.5 },
      muted: { color: '#6b7280' },
      footer: { fontSize: 8, color: '#9ca3af' },
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, lineHeight: 1.15 },
  };
}

function titleBlock(input: ReportInput, title: string): Content[] {
  return [
    { text: title, style: 'title' },
    { text: input.model.wcif.name, style: 'subtitle' },
  ];
}

// ---------- 1. schedule adherence ----------

interface AdherenceRow {
  label: string;
  plannedStart: number;
  plannedMinutes: number;
  actualStart: number | null;
  actualMinutes: number | null;
  diff: number | null;
}

/** Real activities of one room per day, with their recorded starts. */
function adherenceDays(input: ReportInput, room: RoomInfo): Map<string, AdherenceRow[]> {
  const { t, model, log } = input;
  const entries = log.filter((e) => e.roomId === room.id).sort((a, b) => a.actualStart - b.actualStart);
  const starts = new Map<number, number>();
  for (const entry of entries) starts.set(entry.slotId, entry.actualStart);

  // Actual length: until the next recorded start on the same day.
  const actualMinutes = new Map<number, number>();
  entries.forEach((entry, i) => {
    const following = entries[i + 1];
    if (!following) return;
    if (dayKey(following.actualStart, room.timezone) !== dayKey(entry.actualStart, room.timezone)) return;
    actualMinutes.set(entry.slotId, toMinutes(following.actualStart - entry.actualStart));
  });

  const days = new Map<string, AdherenceRow[]>();
  for (const slot of room.slots) {
    if (isAppSlot(slot)) continue;
    const actual = starts.get(slot.id) ?? null;
    const row: AdherenceRow = {
      label: activityLabel(t, model, slot.activityCode, slot.name),
      plannedStart: slot.plannedStart,
      plannedMinutes: toMinutes(slot.plannedEnd - slot.plannedStart),
      actualStart: actual,
      actualMinutes: actualMinutes.get(slot.id) ?? null,
      diff: actual === null ? null : toMinutes(actual - slot.plannedStart),
    };
    const key = dayKey(slot.plannedStart, room.timezone);
    days.set(key, [...(days.get(key) ?? []), row]);
  }
  return days;
}

function adherenceSummary(input: ReportInput, rows: AdherenceRow[]): Content {
  const { t } = input;
  const started = rows.filter((r) => r.diff !== null);
  const diffs = started.map((r) => r.diff!);
  const average = diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 0;
  const maxDelay = diffs.length > 0 ? Math.max(0, ...diffs) : 0;
  const onTime = diffs.filter((d) => Math.abs(d) <= ON_TIME_MINUTES).length;
  const first = started[0];
  const last = started.at(-1);
  const minutes = (value: number) => t('reports.minutes', { value: signed(value) });
  return summaryTable([
    [t('reports.startedActivities'), `${started.length} / ${rows.length}`],
    [t('reports.firstStart'), first ? minutes(first.diff!) : '–'],
    [t('reports.lastStart'), last ? minutes(last.diff!) : '–'],
    [t('reports.averageDiff'), diffs.length > 0 ? minutes(average) : '–'],
    [t('reports.maxDelay'), diffs.length > 0 ? minutes(maxDelay) : '–'],
    [
      t('reports.onTime', { minutes: ON_TIME_MINUTES }),
      diffs.length > 0 ? `${onTime} / ${diffs.length} (${Math.round((onTime / diffs.length) * 100)}%)` : '–',
    ],
  ]);
}

function scheduleAdherence(input: ReportInput): TDocumentDefinitions {
  const { t, model, language } = input;
  const title = t('reports.adherenceTitle');
  const content: Content[] = [...titleBlock(input, title)];
  const header = [t('log.activity'), t('reports.planned'), t('reports.actual'), t('log.diffMinutes'), t('reports.plannedMinutes'), t('reports.actualMinutes')];

  for (const room of model.rooms) {
    if (model.rooms.length > 1) content.push({ text: `${t('log.room')}: ${room.name}`, style: 'section' });
    const days = adherenceDays(input, room);
    let first = true;
    for (const rows of days.values()) {
      if (!first) content.push({ text: '', pageBreak: 'before' });
      first = false;
      content.push({ text: dateText(rows[0].plannedStart, input), style: 'day' });
      content.push(adherenceSummary(input, rows));
      const clock = (ms: number) => formatClock(ms, room.timezone, language);
      content.push(
        table(
          ['*', 50, 50, 50, 50, 50],
          header,
          rows.map((row) => [
            row.label,
            { text: clock(row.plannedStart), alignment: 'right' },
            { text: row.actualStart === null ? '' : clock(row.actualStart), alignment: 'right', bold: true },
            diffCell(row.diff),
            { text: String(row.plannedMinutes), alignment: 'right' },
            { text: row.actualMinutes === null ? '' : String(row.actualMinutes), alignment: 'right' },
          ]),
        ),
      );
    }
  }
  return frame(input, title, content);
}

// ---------- 2. incidents ----------

function incidentLog(input: ReportInput): TDocumentDefinitions {
  const { t, model, language, incidents } = input;
  const title = t('reports.incidentsTitle');
  const content: Content[] = [...titleBlock(input, title)];
  const sorted = [...incidents].sort((a, b) => a.createdAt - b.createdAt);

  content.push(summaryTable([[t('reports.incidentCount'), String(sorted.length)]]));
  if (sorted.length === 0) {
    content.push({ text: t('incidents.empty'), style: 'muted' });
    return frame(input, title, content);
  }

  const rows: TableCell[][] = sorted.map((incident) => {
    const when: TableCell = {
      stack: [
        { text: formatClock(incident.createdAt, model.timezone, language), bold: true },
        { text: new Date(incident.createdAt).toLocaleDateString(language, { timeZone: model.timezone }), style: 'muted', fontSize: 8 },
      ],
    };
    const body: Content[] = [{ text: incident.text.trim() }];
    if (incident.refs.length > 0) {
      body.push({
        text: `${t('incidents.references')}: ${incident.refs.map((r) => r.label).join('; ')}`,
        italics: true,
        color: '#4b5563',
        margin: [0, 3, 0, 0],
      });
    }
    return [when, incident.slotLabel ?? '', { stack: body }];
  });
  content.push(table([60, 110, '*'], [t('reports.time'), t('reports.during'), t('reports.incident')], rows));
  return frame(input, title, content);
}

// ---------- 3. records ----------

/** Attempts as WCA shows them: in an average of 5, the best and worst are in parentheses. */
function attemptsText(attempts: number[], eventId: string, format: RoundFormat | undefined): string {
  const done = attempts.filter((a) => a !== 0);
  const texts = done.map((a) => formatResult(a, eventId, 'single'));
  if (format !== 'a' || done.length !== 5) return texts.join('  ');

  const rank = (a: number) => (a > 0 ? a : Number.MAX_SAFE_INTEGER);
  let best = 0;
  let worst = 0;
  done.forEach((a, i) => {
    if (rank(a) < rank(done[best])) best = i;
    if (rank(a) >= rank(done[worst])) worst = i;
  });
  return texts.map((text, i) => (i === best || i === worst ? `(${text})` : text)).join('  ');
}

interface TaggedRow {
  round: RoundResults;
  row: ResultRow;
}

function tagLabel(t: TFunction, tag: string): string {
  if (tag === 'WR') return t('finale.recordWR');
  if (tag === 'NR') return t('reports.recordNR');
  return t('finale.recordCR');
}

function personCell(input: ReportInput, row: ResultRow): TableCell {
  const person = input.model.persons.get(row.registrantId);
  const details = [person?.wcaId, countryName(person?.countryIso2 ?? null, input.language)].filter(Boolean).join(' · ');
  return { stack: [{ text: row.name, bold: true }, { text: details, style: 'muted', fontSize: 8 }] };
}

function recordsReport(input: ReportInput): TDocumentDefinitions {
  const { t, model, results } = input;
  const title = t('reports.recordsTitle');
  const content: Content[] = [...titleBlock(input, title)];

  const rounds = [...(results?.rounds ?? [])].sort(
    (a, b) => (model.roundStarts.get(a.roundCode) ?? 0) - (model.roundStarts.get(b.roundCode) ?? 0),
  );
  const official: { tagged: TaggedRow; tag: string; type: 'single' | 'average' }[] = [];
  const personal: TaggedRow[] = [];
  for (const round of rounds) {
    for (const row of round.rows) {
      for (const [tag, type] of [[row.singleTag, 'single'], [row.averageTag, 'average']] as const) {
        if (tag && tag !== 'PR') official.push({ tagged: { round, row }, tag, type });
      }
      if (row.singleTag === 'PR' || row.averageTag === 'PR') personal.push({ round, row });
    }
  }

  const count = (tag: string) => official.filter((o) => (tag === 'CR' ? o.tag !== 'WR' && o.tag !== 'NR' : o.tag === tag)).length;
  const prCount = personal.reduce((sum, { row }) => sum + (row.singleTag === 'PR' ? 1 : 0) + (row.averageTag === 'PR' ? 1 : 0), 0);
  content.push(
    summaryTable([
      [t('finale.recordWR'), String(count('WR'))],
      [t('finale.recordCR'), String(count('CR'))],
      [t('reports.recordNR'), String(count('NR'))],
      [t('finale.personalRecords'), String(prCount)],
      [t('reports.peopleWithPR'), String(new Set(personal.map(({ row }) => row.registrantId)).size)],
    ]),
  );

  if (official.length === 0 && personal.length === 0) {
    content.push({ text: t('reports.noTags'), style: 'muted' });
    return frame(input, title, content);
  }

  const roundLabel = (round: RoundResults) => activityLabel(t, model, round.roundCode);
  const format = (round: RoundResults) => model.rounds.get(round.roundCode)?.format;

  content.push({ text: t('reports.officialRecords'), style: 'section' });
  if (official.length === 0) content.push({ text: t('reports.noOfficial'), style: 'muted', margin: [0, 0, 0, 12] });
  else {
    content.push(
      table(
        [62, '*', 90, 52, 125],
        [t('reports.record'), t('reports.person'), t('reports.round'), t('reports.result'), t('reports.attempts')],
        official.map(({ tagged: { round, row }, tag, type }) => [
          { stack: [{ text: tag, bold: true, color: tag === 'NR' ? EARLY_COLOR : LATE_COLOR }, { text: tagLabel(t, tag), fontSize: 7.5, style: 'muted' }] },
          personCell(input, row),
          roundLabel(round),
          { stack: [{ text: formatResult(type === 'single' ? row.best : row.average, round.eventId, type), bold: true }, { text: t(`records.${type}`), fontSize: 7.5, style: 'muted' }] },
          { text: attemptsText(row.attempts, round.eventId, format(round)), fontSize: 8 },
        ]),
      ),
    );
  }

  content.push({ text: t('finale.personalRecords'), style: 'section', pageBreak: 'before' });
  content.push(
    table(
      ['*', 90, 46, 46, 125],
      [t('reports.person'), t('reports.round'), t('records.single'), t('records.average'), t('reports.attempts')],
      personal.map(({ round, row }) => {
        const result = (value: number, type: 'single' | 'average', tagged: boolean): TableCell => ({
          text: formatResult(value, round.eventId, type),
          bold: tagged,
          color: tagged ? '#0051ba' : '#6b7280',
          alignment: 'right',
        });
        return [
          personCell(input, row),
          roundLabel(round),
          result(row.best, 'single', row.singleTag === 'PR'),
          result(row.average, 'average', row.averageTag === 'PR'),
          { text: attemptsText(row.attempts, round.eventId, format(round)), fontSize: 8 },
        ];
      }),
    ),
  );
  content.push({ text: t('reports.prNote'), style: 'muted', fontSize: 8 });
  return frame(input, title, content);
}

// ---------- build ----------

/** pdfmake and its fonts are large, so they load only when reports are made. */
async function loadPdfMake() {
  const module = await import('pdfmake/build/pdfmake');
  const pdfMake = (module as unknown as { default?: typeof module }).default ?? module;
  const fonts = await import('pdfmake/build/vfs_fonts');
  pdfMake.addVirtualFileSystem(fonts.default);
  return pdfMake;
}

export const PDF_REPORT_NAMES = ['schedule-adherence.pdf', 'incidents.pdf', 'records.pdf'];

/** The three PDF reports: schedule adherence, incidents and records. */
export async function buildPdfReports(input: ReportInput): Promise<ReportFile[]> {
  const pdfMake = await loadPdfMake();
  const documents = [scheduleAdherence(input), incidentLog(input), recordsReport(input)];
  const files: ReportFile[] = [];
  for (let i = 0; i < documents.length; i++) {
    files.push({ name: PDF_REPORT_NAMES[i], blob: await pdfMake.createPdf(documents[i]).getBlob() });
  }
  return files;
}
