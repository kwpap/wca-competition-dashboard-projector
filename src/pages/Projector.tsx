import { useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import type { ResultsCache } from '../api/results';
import type { RecordsResponse } from '../api/wca';
import { CallOverlay } from '../components/CallOverlay';
import { Clock } from '../components/Clock';
import { Countdown } from '../components/Countdown';
import { Finale } from '../components/Finale';
import { ProjectorBanner, type BannerMessage } from '../components/ProjectorBanner';
import { RecordsTable } from '../components/RecordsTable';
import { ResultsCarousel } from '../components/ResultsCarousel';
import { describeRound } from '../components/roundRules';
import { TimeBar } from '../components/TimeBar';
import { GET_READY_MS } from '../config';
import { formatResult } from '../format/result';
import { dayKey, formatClock, formatWeekday } from '../format/time';
import { useNoiseMonitor } from '../hooks/useNoiseMonitor';
import { useNow } from '../hooks/useNow';
import { roundCode } from '../model/activityCode';
import { estimateAdvanceResult } from '../model/advanceEstimate';
import { announcementText } from '../model/announcements';
import { attemptSegments } from '../model/attempts';
import { buildModel, isCountdown, isFinale } from '../model/competition';
import { activityLabel, labelParts } from '../model/labels';
import { firstSlotOfNextDay, roomStatus, slotTimes } from '../model/scheduleEngine';
import {
  DEFAULT_PROJECTOR_SETTINGS,
  EMPTY_CALLS,
  EMPTY_STAGE,
  storageKeys,
  useSyncedStorage,
  type Announcement,
  type CallState,
  type NoiseStatus,
  type ProjectorSettings,
  type StageState,
} from '../state/storage';
import type { Wcif } from '../types/wcif';

const EMPTY_ANNOUNCEMENTS: Announcement[] = [];

/** Public screen. Reads everything from localStorage, written by the control window. */
export default function Projector() {
  const { t, i18n } = useTranslation();
  const { competitionId = '' } = useParams();
  const [wcif] = useSyncedStorage<Wcif | null>(storageKeys.wcif(competitionId), null);
  const [records] = useSyncedStorage<RecordsResponse | null>(storageKeys.records, null);
  const [results] = useSyncedStorage<ResultsCache | null>(storageKeys.results(competitionId), null);
  const [stage] = useSyncedStorage<StageState>(storageKeys.stage(competitionId), EMPTY_STAGE);
  const [announcements] = useSyncedStorage<Announcement[]>(storageKeys.announcements(competitionId), EMPTY_ANNOUNCEMENTS);
  const [calls] = useSyncedStorage<CallState>(storageKeys.calls(competitionId), EMPTY_CALLS);
  const [, setNoise] = useSyncedStorage<NoiseStatus | null>(storageKeys.noise(competitionId), null);
  const [savedSettings] = useSyncedStorage<ProjectorSettings>(
    storageKeys.projector(competitionId),
    DEFAULT_PROJECTOR_SETTINGS,
  );
  // Settings saved by older versions miss newer fields.
  const settings = { ...DEFAULT_PROJECTOR_SETTINGS, ...savedSettings };

  // This window has its own language, independent of the control screen.
  useLayoutEffect(() => {
    if (i18n.language !== settings.language) i18n.changeLanguage(settings.language);
  }, [i18n, settings.language]);
  const model = useMemo(() => (wcif ? buildModel(wcif, settings.countdownMinutes) : null), [wcif, settings.countdownMinutes]);
  const now = useNow(1000);
  const tooLoud = useNoiseMonitor(settings.noiseMeter, settings.noiseSensitivity, setNoise);

  if (!model || model.rooms.length === 0) {
    return (
      <main className="projector projector-empty">
        <p>{t('projector.notLoaded')}</p>
      </main>
    );
  }

  const room = model.rooms.find((r) => r.id === stage.roomId) ?? model.rooms[0];
  const status = roomStatus(room, stage.log);
  const times = slotTimes(room, stage.log);
  const current = status.currentIndex >= 0 ? room.slots[status.currentIndex] : null;
  const stopped = Boolean(stage.stoppedAt) && current !== null;
  const followingIndex = stopped ? firstSlotOfNextDay(room, status.currentIndex) : status.currentIndex + 1;
  // "Next" names the activity a countdown leads to, not the countdown itself.
  const nextIndex = isCountdown(room.slots[followingIndex]) ? followingIndex + 1 : followingIndex;
  const next = room.slots[nextIndex] ?? null;
  const nextStart = next ? times[nextIndex].start : null;

  // The finale slot, or "Stop for today" on the last day, ends the competition.
  if (isFinale(current) || (stopped && !next)) {
    return (
      <main className="projector-finale">
        <Finale model={model} results={results} festive={settings.festive} />
        <CallOverlay calls={calls} model={model} seconds={settings.callSeconds} now={now} />
      </main>
    );
  }

  const currentLabel = current ? labelParts(t, model, current.activityCode, current.name) : null;
  const nextLabel = next ? activityLabel(t, model, next.activityCode, next.name) : '';
  const showGetReady = !stopped && next?.eventId && nextStart !== null && now >= nextStart - GET_READY_MS;

  const round =
    current?.eventId && current.roundNumber ? model.rounds.get(roundCode(current.eventId, current.roundNumber)) : undefined;
  const rules = current?.eventId ? describeRound(t, round, current.eventId) : null;
  const recordsEventId = stopped ? (next?.eventId ?? null) : (current?.eventId ?? next?.eventId ?? null);
  // The running round, or the next one during breaks. Nothing after the end of the day.
  const estimateSlot = stopped ? null : current?.eventId ? current : next;
  const estimate =
    estimateSlot?.eventId && estimateSlot.roundNumber
      ? estimateAdvanceResult(model, results, estimateSlot.eventId, estimateSlot.roundNumber)
      : null;

  const bannerMessages: BannerMessage[] = announcements
    .filter((a) => a.active)
    .map((a) => ({ key: a.id, text: announcementText(t, a, i18n.language), kind: 'info' as const }))
    .filter((m) => m.text.trim());
  if (showGetReady) {
    bannerMessages.unshift({ key: 'get-ready', text: t('projector.getReady', { activity: nextLabel }), kind: 'ready' });
  }
  const shownMessages: BannerMessage[] = tooLoud
    ? [{ key: 'quiet', text: t('noise.quiet'), kind: 'quiet' }]
    : bannerMessages;

  const footer = (
    <footer className="pj-footer">
      <ProjectorBanner messages={shownMessages} rotateMs={settings.bannerSeconds * 1000} />
      <Clock timezone={room.timezone} className="pj-clock" />
    </footer>
  );

  const timeBar =
    settings.timeBar && current && times[status.currentIndex].kind === 'actual' ? (
      <TimeBar
        start={times[status.currentIndex].start}
        durationMs={current.plannedEnd - current.plannedStart}
        now={now}
        label={settings.timeBarLabel}
        segments={attemptSegments(model, current)}
        className="pj-time-bar"
      />
    ) : null;
  const nextLine =
    next && nextStart !== null ? (
      <>
        <span className="pj-next-caption">{t('projector.next')}</span>
        <span className="pj-next-title">{nextLabel}</span>
        <span className="pj-next-time">
          {t('projector.at', { time: formatClock(nextStart, room.timezone, i18n.language) })}
        </span>
      </>
    ) : null;

  // Lunch and other breaks have nothing to show on the left, so the results take the whole screen.
  const hasResults = results?.rounds.some((r) => r.rows.length > 0) ?? false;
  if (current && currentLabel && !current.eventId && !isCountdown(current) && !stopped && hasResults) {
    return (
      <main className="projector projector-break">
        <section className="pj-break-bar">
          <div className="pj-break-now">
            <div className="pj-break-title">{currentLabel.title}</div>
            {timeBar}
          </div>
          {nextLine && <div className="pj-break-next">{nextLine}</div>}
        </section>
        <ResultsCarousel model={model} results={results} pageMs={settings.resultsPageSeconds * 1000} wide />
        {footer}
        <CallOverlay calls={calls} model={model} seconds={settings.callSeconds} now={now} />
      </main>
    );
  }

  if (current && isCountdown(current) && !stopped) {
    const day = dayKey(current.plannedEnd, room.timezone);
    const eventIds = new Set<string>();
    for (const slot of room.slots) {
      if (slot.eventId && dayKey(slot.plannedStart, room.timezone) === day) eventIds.add(slot.eventId);
    }
    return (
      <main className={settings.festive ? 'projector-countdown festive' : 'projector-countdown plain'}>
        <Countdown
          festive={settings.festive}
          competitionName={model.wcif.name}
          start={times[status.currentIndex].start}
          target={current.plannedEnd}
          now={now}
          timezone={room.timezone}
          firstActivity={next ? nextLabel : null}
          eventIds={[...eventIds]}
        />
        {footer}
        <CallOverlay calls={calls} model={model} seconds={settings.callSeconds} now={now} />
      </main>
    );
  }

  return (
    <main className="projector">
      <section className="pj-left">
        {stopped && nextStart !== null && (
          <div className="pj-current">
            <div className="pj-title">{t('projector.dayEnded')}</div>
            <div className="pj-subtitle">
              {t('projector.continueOn', {
                day: formatWeekday(nextStart, room.timezone, i18n.language),
                time: formatClock(nextStart, room.timezone, i18n.language),
                activity: nextLabel,
              })}
            </div>
          </div>
        )}

        {!stopped && (
          <div className="pj-current">
            {currentLabel ? (
              <>
                <div className="pj-title">{currentLabel.title}</div>
                {currentLabel.parts.length > 0 && <div className="pj-subtitle">{currentLabel.parts.join(' · ')}</div>}
              </>
            ) : (
              <div className="pj-title">{t('projector.startingSoon')}</div>
            )}
            {rules && (
              <div className="pj-rules">{[rules.timeLimit, rules.cutoff].filter(Boolean).join(' · ')}</div>
            )}
            {timeBar}
          </div>
        )}

        {!stopped && nextLine && <div className="pj-next">{nextLine}</div>}

        <RecordsTable records={records} eventId={recordsEventId} countryIso2={model.countryIso2} />
        {estimate && estimateSlot?.eventId && (
          <div className="pj-estimate">
            {t('projector.advanceEstimate', {
              time: formatResult(estimate.value, estimateSlot.eventId, estimate.type),
            })}
          </div>
        )}
      </section>

      <section className="pj-right">
        <ResultsCarousel model={model} results={results} pageMs={settings.resultsPageSeconds * 1000} />
      </section>

      {footer}

      <CallOverlay calls={calls} model={model} seconds={settings.callSeconds} now={now} />
    </main>
  );
}
