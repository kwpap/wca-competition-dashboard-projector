import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ResultsCache } from '../api/results';
import { AuthError, getRecords, getWcif, type RecordsResponse } from '../api/wca';
import { AnnouncementsEditor } from '../components/AnnouncementsEditor';
import { Clock } from '../components/Clock';
import { DelayBadge } from '../components/DelayBadge';
import { Modal } from '../components/Modal';
import { NeedPanel } from '../components/NeedPanel';
import { OptionsModal } from '../components/OptionsModal';
import { PeoplePicker } from '../components/PeoplePicker';
import { PersonDetail } from '../components/PersonDetail';
import { PreviousRoundColumn } from '../components/PreviousRoundColumn';
import { RoleColumns } from '../components/RoleColumns';
import { describeRound } from '../components/roundRules';
import { TimeBar } from '../components/TimeBar';
import { downloadBlob, downloadFile } from '../format/download';
import { formatClock, toMinutes } from '../format/time';
import { useBrowseNavigation } from '../hooks/useBrowseNavigation';
import { useNow } from '../hooks/useNow';
import { useResultsPoller } from '../hooks/useResultsPoller';
import { savedLanguage } from '../i18n';
import { incidentsToMarkdown } from '../incidents/exportMarkdown';
import { IncidentEditor } from '../incidents/IncidentEditor';
import { IncidentList } from '../incidents/IncidentList';
import { removeIncident, upsertIncident, type Incident } from '../incidents/types';
import { roundCode } from '../model/activityCode';
import { justMissed, previousRoundCode, roundStandings } from '../model/advancement';
import { withRecords, withTemplates } from '../model/announcements';
import { attemptSegments } from '../model/attempts';
import { buildModel, isAppSlot, isCountdown, isFinale, type CompetitionModel, type Slot } from '../model/competition';
import { activityLabel, labelParts } from '../model/labels';
import { nextEvent, nextGroup, previousEvent, previousGroup } from '../model/navigation';
import { peopleForSlot } from '../model/people';
import { buildPdfReports } from '../reports/pdfReports';
import { scheduleLogCsv } from '../reports/scheduleLog';
import { useAutoReports } from '../reports/useAutoReports';
import { saveReport } from '../state/server';
import {
  firstSlotOfNextDay,
  roomStatus,
  shiftCurrentStart,
  slotTimes,
  startSlot,
  undoLast,
  type SlotTime,
} from '../model/scheduleEngine';
import {
  DEFAULT_PROJECTOR_SETTINGS,
  DEFAULT_UI_SETTINGS,
  EMPTY_CALLS,
  EMPTY_STAGE,
  storageKeys,
  useSyncedStorage,
  type Announcement,
  type CallState,
  type NamedCallRole,
  type NoiseStatus,
  type ProjectorSettings,
  type StageState,
  type UiSettings,
} from '../state/storage';
import type { Wcif } from '../types/wcif';

type ModalState =
  | { type: 'person'; registrantId: number }
  | { type: 'incidents' }
  | { type: 'incident'; incident: Incident | null }
  | { type: 'log' }
  | { type: 'announcements' }
  | { type: 'options' }
  | { type: 'picker'; role: NamedCallRole }
  | null;

const EMPTY_INCIDENTS: Incident[] = [];
const EMPTY_ANNOUNCEMENTS: Announcement[] = [];
/** Time to tap "Stop for today" a second time. */
const CONFIRM_MS = 4000;

export default function Control() {
  const { t } = useTranslation();
  const { competitionId = '' } = useParams();
  const [wcif, setWcif] = useSyncedStorage<Wcif | null>(storageKeys.wcif(competitionId), null);
  const [, setRecords] = useSyncedStorage<RecordsResponse | null>(storageKeys.records, null);
  const [results, setResults] = useSyncedStorage<ResultsCache | null>(storageKeys.results(competitionId), null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [projectorSettings] = useSyncedStorage<ProjectorSettings>(
    storageKeys.projector(competitionId),
    DEFAULT_PROJECTOR_SETTINGS,
  );
  const countdownMinutes = projectorSettings.countdownMinutes ?? DEFAULT_PROJECTOR_SETTINGS.countdownMinutes;
  const model = useMemo(() => (wcif ? buildModel(wcif, countdownMinutes) : null), [wcif, countdownMinutes]);

  useResultsPoller(wcif, setResults);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      setWcif(await getWcif(competitionId));
      setRecords(await getRecords());
    } catch (error) {
      setRefreshError(error instanceof AuthError ? t('errors.loginAgain') : String(error));
    } finally {
      setRefreshing(false);
    }
  }

  if (!model || model.rooms.length === 0) {
    return (
      <main className="page center">
        <p>{model ? t('control.noSchedule') : t('control.notLoaded')}</p>
        <button className="btn btn-primary" onClick={refresh} disabled={refreshing}>
          {refreshing ? t('common.loading') : t('control.refresh')}
        </button>
        {refreshError && <p className="error">{refreshError}</p>}
        <Link className="btn" to="/competitions">
          {t('common.back')}
        </Link>
      </main>
    );
  }

  return (
    <ControlView
      model={model}
      results={results}
      onRefresh={refresh}
      refreshing={refreshing}
      refreshError={refreshError}
    />
  );
}

interface ControlViewProps {
  model: CompetitionModel;
  results: ResultsCache | null;
  onRefresh: () => void;
  refreshing: boolean;
  refreshError: string | null;
}

function ControlView({ model, results, onRefresh, refreshing, refreshError }: ControlViewProps) {
  const { t, i18n } = useTranslation();
  const competitionId = model.wcif.id;
  const [stage, setStage] = useSyncedStorage<StageState>(storageKeys.stage(competitionId), EMPTY_STAGE);
  const [incidents, setIncidents] = useSyncedStorage<Incident[]>(storageKeys.incidents(competitionId), EMPTY_INCIDENTS);
  const [announcements, setAnnouncements] = useSyncedStorage<Announcement[]>(
    storageKeys.announcements(competitionId),
    EMPTY_ANNOUNCEMENTS,
  );
  const [savedProjectorSettings, setProjectorSettings] = useSyncedStorage<ProjectorSettings>(
    storageKeys.projector(competitionId),
    DEFAULT_PROJECTOR_SETTINGS,
  );
  // Settings saved by older versions miss newer fields.
  const projectorSettings = { ...DEFAULT_PROJECTOR_SETTINGS, ...savedProjectorSettings };
  const [savedUiSettings, setUiSettings] = useSyncedStorage<UiSettings>(storageKeys.uiSettings, {
    ...DEFAULT_UI_SETTINGS,
    language: savedLanguage(),
  });
  const uiSettings = { ...DEFAULT_UI_SETTINGS, ...savedUiSettings };
  const [calls, setCalls] = useSyncedStorage<CallState>(storageKeys.calls(competitionId), EMPTY_CALLS);
  const [noise] = useSyncedStorage<NoiseStatus | null>(storageKeys.noise(competitionId), null);
  const [viewedIndex, setViewedIndex] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  // Only the control window adds templates and records, so the projector cannot add duplicates.
  useEffect(() => {
    const next = withRecords(withTemplates(announcements), model, results);
    if (next !== announcements) setAnnouncements(next);
  }, [announcements, model, results, setAnnouncements]);

  useEffect(() => {
    if (!confirmStop) return;
    const timer = setTimeout(() => setConfirmStop(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmStop]);

  const room = model.rooms.find((r) => r.id === stage.roomId) ?? model.rooms[0];
  const slots = room.slots;
  const status = roomStatus(room, stage.log);
  const times = slotTimes(room, stage.log);
  const currentIndex = status.currentIndex;
  const current = currentIndex >= 0 ? slots[currentIndex] : null;
  // After "Stop for today", the next Proceed starts the first group of the next day.
  const stopped = Boolean(stage.stoppedAt) && current !== null;
  const upcomingIndex = stopped ? firstSlotOfNextDay(room, currentIndex) : currentIndex + 1;
  const upcoming = slots[upcomingIndex] ?? null;
  const homeIndex = stopped && upcoming ? upcomingIndex : Math.max(currentIndex, 0);
  const viewIndex = viewedIndex ?? homeIndex;
  const viewed = slots[viewIndex];

  const people = useMemo(() => peopleForSlot(model.wcif, viewed.id), [model, viewed.id]);
  const reportsSavedAt = useAutoReports(model, stage.log, incidents);

  const previousCode =
    viewed.eventId && viewed.roundNumber ? previousRoundCode(viewed.eventId, viewed.roundNumber) : null;
  const previousStandings = useMemo(
    () => (previousCode ? roundStandings(model, results, previousCode, uiSettings.justMissedCount) : []),
    [model, results, previousCode, uiSettings.justMissedCount],
  );

  // A countdown always ends at the planned start of the day, whenever it was started.
  const running: RunningGroup | null =
    current && !stopped && times[currentIndex].kind === 'actual'
      ? {
          start: times[currentIndex].start,
          durationMs: isCountdown(current)
            ? current.plannedEnd - times[currentIndex].start
            : current.plannedEnd - current.plannedStart,
          segments: attemptSegments(model, current),
        }
      : null;

  const busyIds = useMemo(() => {
    if (!current) return new Set<number>();
    const lists = Object.values(peopleForSlot(model.wcif, current.id));
    return new Set(lists.flat().map(({ person }) => person.registrantId!));
  }, [model, current]);

  const nextSlot = slots[viewIndex + 1];
  const nextPreviousCode =
    nextSlot?.eventId && nextSlot.roundNumber ? previousRoundCode(nextSlot.eventId, nextSlot.roundNumber) : null;
  const nextJustMissed = nextPreviousCode
    ? justMissed(model, results, nextPreviousCode, uiSettings.justMissedCount)
    : [];

  useBrowseNavigation(
    {
      next: () => setViewedIndex(nextGroup(slots, viewIndex)),
      previous: () => setViewedIndex(previousGroup(viewIndex)),
      nextEvent: () => setViewedIndex(nextEvent(slots, viewIndex)),
      previousEvent: () => setViewedIndex(previousEvent(slots, viewIndex)),
    },
    modal === null,
  );

  const time = (ms: number) => formatClock(ms, room.timezone, i18n.language);
  const label = (slot: Slot) => activityLabel(t, model, slot.activityCode, slot.name);

  /** Text under activities without people. */
  function slotHint(slot: Slot): string {
    if (isFinale(slot)) return t('finale.controlHint');
    if (isCountdown(slot) && nextSlot) {
      return t('countdown.controlHint', { activity: label(nextSlot), time: time(slot.plannedEnd) });
    }
    return t('control.noAssignmentsForActivity');
  }

  function start(slot: Slot) {
    setStage((s) => ({ ...s, roomId: room.id, stoppedAt: null, log: startSlot(s.log, room.id, slot.id, Date.now()) }));
    setViewedIndex(null);
  }

  function undo() {
    if (stopped) setStage((s) => ({ ...s, stoppedAt: null }));
    else setStage((s) => ({ ...s, log: undoLast(s.log, room.id) }));
    setViewedIndex(null);
  }

  function stopForToday() {
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    setStage((s) => ({ ...s, stoppedAt: Date.now() }));
    setConfirmStop(false);
    setViewedIndex(null);
  }

  function shift(minutes: number) {
    setStage((s) => ({ ...s, log: shiftCurrentStart(s.log, room.id, minutes * 60_000) }));
  }

  function selectRoom(roomId: number) {
    setStage((s) => ({ ...s, roomId }));
    setViewedIndex(null);
  }

  function openProjector() {
    window.open(`/projector/${encodeURIComponent(competitionId)}`, 'wca-projector', 'popup,width=1280,height=720');
  }

  function exportLog() {
    downloadFile(`${competitionId}-schedule-log.csv`, scheduleLogCsv(t, model, stage.log, i18n.language), 'text/csv');
  }

  /** Downloads the three PDF reports, and saves them to the reports folder when the local server runs. */
  async function generatePdfReports(): Promise<string> {
    const files = await buildPdfReports({ t, language: i18n.language, model, log: stage.log, incidents, results });
    let savedAll = true;
    for (const file of files) {
      downloadBlob(`${competitionId}-${file.name}`, file.blob);
      const saved = await saveReport(competitionId, file.name, file.blob);
      savedAll = savedAll && saved;
    }
    return savedAll ? t('options.pdfSaved', { folder: `reports/${competitionId}/` }) : t('options.pdfDownloaded');
  }

  function exportIncidents() {
    downloadFile(`${competitionId}-incidents.md`, incidentsToMarkdown(t, model, incidents, i18n.language), 'text/markdown');
  }

  /** People already chosen for a call, or else the people assigned to that role in the viewed group. */
  function pickerStart(role: NamedCallRole): number[] {
    const chosen = calls.named[role] ?? [];
    if (chosen.length > 0 || role === 'delegates') return chosen;
    return people[role].map(({ person }) => person.registrantId!);
  }

  function changeUiSettings(settings: UiSettings) {
    setUiSettings(settings);
    if (settings.language !== i18n.language) i18n.changeLanguage(settings.language);
  }

  function saveIncident(incident: Incident) {
    setIncidents((list) => upsertIncident(list, incident));
    setModal({ type: 'incidents' });
  }

  function deleteIncident(id: string) {
    setIncidents((list) => removeIncident(list, id));
    setModal({ type: 'incidents' });
  }

  return (
    <main className="control">
      <header className="topbar">
        <Link className="btn" to="/competitions">
          {t('common.back')}
        </Link>
        <h1 className="topbar-title">{model.wcif.shortName || model.wcif.name}</h1>
        {model.rooms.length > 1 && (
          <select className="room-select" value={room.id} onChange={(e) => selectRoom(Number(e.target.value))}>
            {model.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <Clock timezone={room.timezone} withSeconds />
        <DelayBadge delayMs={status.delayMs} started={currentIndex >= 0} stopped={stopped} />
        <span className="spacer" />
        <button className="btn" onClick={() => setModal({ type: 'log' })}>
          {t('control.log')}
        </button>
        <button className="btn" onClick={() => setModal({ type: 'incidents' })}>
          {t('control.incidents', { count: incidents.length })}
        </button>
        <button className="btn" onClick={() => setModal({ type: 'incident', incident: null })}>
          {t('control.newIncident')}
        </button>
        <button className="btn" onClick={() => setModal({ type: 'options' })}>
          {t('control.options')}
        </button>
        <button className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? t('common.loading') : t('control.refresh')}
        </button>
      </header>
      <section className="topbar">
        <button className="btn btn-primary" onClick={openProjector}>
          {t('control.openProjector')}
        </button>
        <button className="btn" onClick={() => setModal({ type: 'announcements' })}>
          {t('control.announcements', { count: announcements.filter((a) => a.active).length })}
        </button>
        <NeedPanel calls={calls} onChange={setCalls} onPick={(role) => setModal({ type: 'picker', role })} />
      </section>
      {refreshError && <p className="error">{refreshError}</p>}

      <section className="slot-strip">
        <SlotMini
          slot={slots[viewIndex - 1]}
          time={times[viewIndex - 1]}
          caption={t('control.previous')}
          label={label}
          formatTime={time}
          onClick={() => setViewedIndex(previousGroup(viewIndex))}
        />
        <SlotCard
          model={model}
          slot={viewed}
          slotTime={times[viewIndex]}
          viewIndex={viewIndex}
          currentIndex={currentIndex}
          upcomingIndex={upcomingIndex}
          stopped={stopped}
          running={running}
          formatTime={time}
        />
        <SlotMini
          slot={nextSlot}
          time={times[viewIndex + 1]}
          caption={t('control.next')}
          label={label}
          formatTime={time}
          onClick={() => setViewedIndex(nextGroup(slots, viewIndex))}
          hover={
            nextJustMissed.length > 0 ? (
              <>
                <strong>{t('previousRound.hoverTitle')}</strong>
                <ol>
                  {nextJustMissed.map(({ row }) => (
                    <li key={row.registrantId}>
                      <span className="station">{row.ranking}</span> {row.name}
                    </li>
                  ))}
                </ol>
              </>
            ) : undefined
          }
        />
      </section>

      <section className="action-row">
        <button className="btn btn-proceed" onClick={() => upcoming && start(upcoming)} disabled={!upcoming}>
          <span>{t('control.proceedNow')}</span>
          {upcoming && <small>{label(upcoming)}</small>}
        </button>
        {viewIndex !== currentIndex && viewed !== upcoming && (
          <button className="btn btn-lg" onClick={() => start(viewed)}>
            {t('control.startThisNow')}
          </button>
        )}
        {viewedIndex !== null && (
          <button className="btn btn-lg" onClick={() => setViewedIndex(null)}>
            {t('control.backToNow')}
          </button>
        )}
        <button className="btn btn-lg" onClick={undo} disabled={!current}>
          {t('control.undo')}
        </button>
        <button
          className={confirmStop ? 'btn btn-lg btn-danger' : 'btn btn-lg'}
          onClick={stopForToday}
          disabled={!current || stopped}
        >
          {confirmStop ? t('control.confirmStop') : t('control.stopForToday')}
        </button>
        <div className="shift-group">
          <span className="muted">{t('control.adjustStart')}</span>
          {[-5, -1, 1, 5].map((minutes) => (
            <button key={minutes} className="btn btn-lg" onClick={() => shift(minutes)} disabled={!current}>
              {minutes > 0 ? `+${minutes}` : `−${-minutes}`}
            </button>
          ))}
        </div>
      </section>

      {viewed.eventId ? (
        <RoleColumns
          people={people}
          eventId={viewed.eventId}
          onSelect={(registrantId) => setModal({ type: 'person', registrantId })}
          previousRound={
            previousCode ? (
              <PreviousRoundColumn
                roundLabel={activityLabel(t, model, previousCode)}
                standings={previousStandings}
                eventId={viewed.eventId}
                format={model.rounds.get(previousCode)?.format}
                onSelect={(registrantId) => setModal({ type: 'person', registrantId })}
              />
            ) : undefined
          }
        />
      ) : (
        <p className={isAppSlot(viewed) ? 'finale-hint' : 'muted center-text'}>{slotHint(viewed)}</p>
      )}
      {viewed.eventId && Object.values(people).every((list) => list.length === 0) && (
        <p className="muted center-text">{t('control.noAssignments')}</p>
      )}

      {modal?.type === 'person' && (
        <PersonDetail
          model={model}
          log={stage.log}
          results={results}
          registrantId={modal.registrantId}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'incidents' && (
        <IncidentList
          model={model}
          incidents={incidents}
          onOpen={(incident) => setModal({ type: 'incident', incident })}
          onNew={() => setModal({ type: 'incident', incident: null })}
          onExport={exportIncidents}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'incident' && (
        <IncidentEditor
          model={model}
          incident={modal.incident}
          context={{ slotId: current?.id ?? null, slotLabel: current ? label(current) : null }}
          onSave={saveIncident}
          onDelete={deleteIncident}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'announcements' && (
        <AnnouncementsEditor
          announcements={announcements}
          onChange={setAnnouncements}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'picker' && (
        <PeoplePicker
          model={model}
          results={results}
          role={modal.role}
          initial={pickerStart(modal.role)}
          busyIds={busyIds}
          justMissedCount={uiSettings.justMissedCount}
          onSave={(ids) => {
            setCalls((c) => ({ ...c, named: { ...c.named, [modal.role]: ids } }));
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'options' && (
        <OptionsModal
          ui={uiSettings}
          projector={projectorSettings}
          noise={noise}
          onUiChange={changeUiSettings}
          onProjectorChange={setProjectorSettings}
          onPdfReports={generatePdfReports}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'log' && (
        <Modal
          title={t('control.log')}
          onClose={() => setModal(null)}
          actions={
            <button className="btn" onClick={exportLog} disabled={stage.log.length === 0}>
              {t('log.exportCsv')}
            </button>
          }
        >
          {reportsSavedAt !== null && (
            <p className="muted">
              {t('log.autoSaved', { folder: `reports/${competitionId}/`, time: time(reportsSavedAt) })}
            </p>
          )}
          {stage.log.length === 0 && <p className="muted">{t('log.empty')}</p>}
          <table className="table">
            <thead>
              <tr>
                <th>{t('log.activity')}</th>
                <th>{t('log.planned')}</th>
                <th>{t('log.actual')}</th>
                <th>{t('log.diffMinutes')}</th>
              </tr>
            </thead>
            <tbody>
              {stage.log
                .filter((entry) => entry.roomId === room.id)
                .map((entry, index) => {
                  const slot = model.activities.get(entry.slotId);
                  const diff = slot ? toMinutes(entry.actualStart - slot.plannedStart) : 0;
                  return (
                    <tr key={`${entry.slotId}-${index}`}>
                      <td>{slot ? label(slot) : entry.slotId}</td>
                      <td>{slot ? time(slot.plannedStart) : ''}</td>
                      <td>{time(entry.actualStart)}</td>
                      <td className={diff > 0 ? 'late' : diff < 0 ? 'early' : ''}>{diff > 0 ? `+${diff}` : diff}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Modal>
      )}
    </main>
  );
}

interface SlotCardProps {
  model: CompetitionModel;
  slot: Slot;
  slotTime: SlotTime;
  viewIndex: number;
  currentIndex: number;
  upcomingIndex: number;
  stopped: boolean;
  /** The running group, shown as a time bar along the top border when this card shows it. */
  running: RunningGroup | null;
  formatTime: (ms: number) => string;
}

function SlotCard(props: SlotCardProps) {
  const { model, slot, slotTime, viewIndex, currentIndex, upcomingIndex, stopped, running, formatTime } = props;
  const { t } = useTranslation();
  const { title, parts } = labelParts(t, model, slot.activityCode, slot.name);
  const isCurrent = viewIndex === currentIndex && !stopped;

  let state = t('control.done');
  if (viewIndex === currentIndex) state = stopped ? t('control.stopped') : t('control.runningNow');
  else if (viewIndex === upcomingIndex) state = t('control.upNext');
  else if (viewIndex > currentIndex) state = t('control.upcoming');

  const round =
    slot.eventId && slot.roundNumber ? model.rounds.get(roundCode(slot.eventId, slot.roundNumber)) : undefined;
  const rules = slot.eventId ? describeRound(t, round, slot.eventId) : null;

  return (
    <article className={isCurrent ? 'slot-card current' : 'slot-card'}>
      {isCurrent && running && <CardTimeBar running={running} />}
      <div className="slot-state">{state}</div>
      <div className="slot-title">{title}</div>
      {parts.length > 0 && <div className="slot-subtitle">{parts.join(' · ')}</div>}
      <div className="slot-times">
        <span>{t('control.planned', { time: formatTime(slot.plannedStart) })}</span>
        {slotTime.kind === 'actual' && <strong>{t('control.started', { time: formatTime(slotTime.start) })}</strong>}
        {slotTime.kind === 'projected' && <strong>{t('control.projected', { time: formatTime(slotTime.start) })}</strong>}
      </div>
      {rules && (
        <div className="slot-rules">
          {[rules.timeLimit, rules.cutoff, rules.advancement].filter(Boolean).join(' · ')}
        </div>
      )}
    </article>
  );
}

interface RunningGroup {
  start: number;
  durationMs: number;
  segments: number | undefined;
}

/** Own component so that only the bar re-renders every second. */
function CardTimeBar({ running }: { running: RunningGroup }) {
  const now = useNow(1000);
  return (
    <TimeBar
      start={running.start}
      durationMs={running.durationMs}
      now={now}
      label="left"
      segments={running.segments}
      className="card-time-bar"
    />
  );
}

interface SlotMiniProps {
  slot: Slot | undefined;
  time: SlotTime | undefined;
  caption: string;
  label: (slot: Slot) => string;
  formatTime: (ms: number) => string;
  onClick: () => void;
  /** Shown in a popup while the mouse is over the card. */
  hover?: ReactNode;
}

function SlotMini({ slot, time, caption, label, formatTime, onClick, hover }: SlotMiniProps) {
  const { t } = useTranslation();
  if (!slot || !time) return <div className="slot-mini empty" />;
  return (
    <div className="slot-mini-wrap">
      <button className="slot-mini" onClick={onClick}>
        <span className="muted">{caption}</span>
        <span className="slot-mini-title">{label(slot)}</span>
        <span className="time muted">{t('control.planned', { time: formatTime(slot.plannedStart) })}</span>
        {time.kind === 'actual' && (
          <span className="time time-actual">{t('control.started', { time: formatTime(time.start) })}</span>
        )}
        {time.kind === 'projected' && (
          <span className="time time-projected">{t('control.projected', { time: formatTime(time.start) })}</span>
        )}
      </button>
      {hover && <div className="hover-popup">{hover}</div>}
    </div>
  );
}
