import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultsCache } from '../api/results';
import { FINALE_SLIDE_MS } from '../config';
import { formatResult } from '../format/result';
import { formatDateRange } from '../format/time';
import { eventName } from '../model/activityCode';
import { countryName } from '../model/announcements';
import type { CompetitionModel } from '../model/competition';
import { buildFinale, type Finale as FinaleData, type Highlight, type Podium, type PodiumPerson } from '../model/finale';
import type { RecordInfo } from '../state/storage';
import { Clock } from './Clock';

interface FinaleProps {
  model: CompetitionModel;
  results: ResultsCache | null;
  /** Dark theme with glows, confetti and fireworks. Otherwise a plain light look. */
  festive: boolean;
}

type Slide =
  | { key: string; kind: 'welcome' }
  | { key: string; kind: 'podium'; podium: Podium }
  | { key: string; kind: 'records'; records: RecordInfo[] }
  | { key: string; kind: 'numbers' }
  | { key: string; kind: 'highlights' }
  | { key: string; kind: 'thanks' };

const RECORDS_PER_SLIDE = 3;
const CONFETTI_PIECES = 70;
const FIREWORK_BURSTS = 4;
const FIREWORK_SPARKS = 18;
const COUNT_UP_MS = 1800;
/** Podium blocks rise in this order: third, second, first. */
const PODIUM_ORDER = [2, 1, 3] as const;
const RISE_DELAY_S: Record<1 | 2 | 3, number> = { 1: 1.1, 2: 0.6, 3: 0.2 };

function buildSlides(finale: FinaleData): Slide[] {
  const slides: Slide[] = [{ key: 'welcome', kind: 'welcome' }];
  for (const podium of finale.podiums) slides.push({ key: `podium-${podium.eventId}`, kind: 'podium', podium });
  for (let i = 0; i < finale.records.length; i += RECORDS_PER_SLIDE) {
    slides.push({ key: `records-${i}`, kind: 'records', records: finale.records.slice(i, i + RECORDS_PER_SLIDE) });
  }
  slides.push({ key: 'numbers', kind: 'numbers' });
  if (finale.highlights.length > 0) slides.push({ key: 'highlights', kind: 'highlights' });
  slides.push({ key: 'thanks', kind: 'thanks' });
  return slides;
}

/** Closing screen of the competition: podiums, records and stats in one carousel. */
export function Finale({ model, results, festive }: FinaleProps) {
  const { t, i18n } = useTranslation();
  const finale = useMemo(() => buildFinale(model, results), [model, results]);
  const slides = useMemo(() => buildSlides(finale), [finale]);
  const [turn, setTurn] = useState(0);
  const index = turn % slides.length;
  const slide = slides[index];

  useEffect(() => {
    const timer = setTimeout(() => setTurn((n) => n + 1), FINALE_SLIDE_MS);
    return () => clearTimeout(timer);
  }, [turn]);

  const { schedule } = model.wcif;
  const venue = model.rooms[0]?.venueName;
  const dates = formatDateRange(schedule.startDate, schedule.numberOfDays, i18n.language);

  return (
    <div className={festive ? 'finale festive' : 'finale plain'}>
      {festive && (
        <>
          <div className="fn-glow fn-glow-a" aria-hidden="true" />
          <div className="fn-glow fn-glow-b" aria-hidden="true" />
          <Confetti />
        </>
      )}

      <header className="fn-header">
        <div className="fn-kicker">{t('finale.title')}</div>
        <h1 className="fn-name">{model.wcif.name}</h1>
        <div className="fn-meta">{[dates, venue].filter(Boolean).join(' · ')}</div>
      </header>

      <section className="fn-stage">
        <div key={`${turn}-${slide.key}`} className={`fn-slide fn-slide-${slide.kind}`}>
          {slide.kind === 'welcome' && <WelcomeSlide finale={finale} />}
          {slide.kind === 'podium' && <PodiumSlide podium={slide.podium} />}
          {slide.kind === 'records' && <RecordsSlide records={slide.records} festive={festive} />}
          {slide.kind === 'numbers' && <NumbersSlide finale={finale} />}
          {slide.kind === 'highlights' && <HighlightsSlide highlights={finale.highlights} />}
          {slide.kind === 'thanks' && <ThanksSlide finale={finale} />}
        </div>
      </section>

      <footer className="fn-footer">
        <div className="fn-dots">
          {slides.map((s, i) => (
            <span key={s.key} className={i === index ? `fn-dot active dot-${s.kind}` : `fn-dot dot-${s.kind}`} />
          ))}
        </div>
        <Clock timezone={model.timezone} className="fn-clock" />
        <div className="fn-progress">
          <div key={turn} className="fn-progress-fill" style={{ animationDuration: `${FINALE_SLIDE_MS}ms` }} />
        </div>
      </footer>
    </div>
  );
}

/** Falling stickers in the six cube colors. Positions come from the index, so they stay stable between renders. */
function Confetti() {
  const pieces = [];
  for (let i = 0; i < CONFETTI_PIECES; i++) {
    const style = {
      left: `${(i * 53) % 100}%`,
      animationDuration: `${7 + ((i * 7) % 6)}s`,
      animationDelay: `-${(i * 0.61) % 12}s`,
      '--drift': `${((i * 29) % 21) - 10}vw`,
      '--spin': `${360 + ((i * 97) % 540)}deg`,
      '--size': `${0.5 + ((i * 13) % 6) / 10}vw`,
    } as CSSProperties;
    pieces.push(<span key={i} className={`fn-confetti-piece sticker-${i % 6}`} style={style} />);
  }
  return (
    <div className="fn-confetti" aria-hidden="true">
      {pieces}
    </div>
  );
}

function Fireworks() {
  const bursts = [];
  for (let b = 0; b < FIREWORK_BURSTS; b++) {
    const sparks = [];
    for (let s = 0; s < FIREWORK_SPARKS; s++) {
      const style = { '--angle': `${(360 / FIREWORK_SPARKS) * s}deg` } as CSSProperties;
      sparks.push(<span key={s} className={`fn-spark sticker-${(b + s) % 6}`} style={style} />);
    }
    const style = {
      left: `${12 + ((b * 61) % 76)}%`,
      top: `${10 + ((b * 37) % 50)}%`,
      '--delay': `${b * 0.7}s`,
    } as CSSProperties;
    bursts.push(
      <div key={b} className="fn-burst" style={style}>
        {sparks}
      </div>,
    );
  }
  return (
    <div className="fn-fireworks" aria-hidden="true">
      {bursts}
    </div>
  );
}

/** Counts up from zero when the slide appears. */
function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const { i18n } = useTranslation();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / COUNT_UP_MS);
      const eased = 1 - (1 - progress) ** 3;
      setShown(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const format = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <>{format.format(decimals === 0 ? Math.round(shown) : shown)}</>;
}

function EventIcon({ eventId }: { eventId: string }) {
  return <span className={`cubing-icon event-${eventId} fn-event-icon`} aria-hidden="true" />;
}

function RecordTag({ tag }: { tag: string | null }) {
  if (!tag) return null;
  const kind = tag === 'WR' || tag === 'NR' || tag === 'PR' ? tag : 'CR';
  return <span className={`fn-tag fn-tag-${kind}`}>{tag}</span>;
}

function WelcomeSlide({ finale }: { finale: FinaleData }) {
  const { t } = useTranslation();
  const { stats } = finale;
  return (
    <>
      <div className="fn-wrap">{t('finale.wrap')}</div>
      <div className="fn-wrap-sub">{t('finale.wrapSub')}</div>
      <div className="fn-big-counters">
        <BigCounter value={stats.competitors} label={t('finale.competitors')} color={0} />
        <BigCounter value={stats.countries} label={t('finale.countries')} color={1} />
        <BigCounter value={stats.events} label={t('finale.events')} color={2} />
      </div>
    </>
  );
}

function BigCounter({ value, label, color }: { value: number; label: string; color: number }) {
  return (
    <div className={`fn-big-counter accent-${color}`}>
      <div className="fn-big-number">
        <CountUp value={value} />
      </div>
      <div className="fn-big-label">{label}</div>
    </div>
  );
}

function PodiumSlide({ podium }: { podium: Podium }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <div className="fn-slide-head">
        <EventIcon eventId={podium.eventId} />
        <h2>{eventName(t, podium.eventId)}</h2>
        <span className="fn-chip">{t('activity.final')}</span>
      </div>
      <div className="fn-podium">
        {PODIUM_ORDER.map((place) => {
          const people = podium.places.find((p) => p.place === place)?.people ?? [];
          return (
            <div key={place} className={`fn-col fn-col-${place}`} style={{ '--rise': `${RISE_DELAY_S[place]}s` } as CSSProperties}>
              <div className="fn-col-people">
                {people.map((person) => (
                  <PodiumName key={person.registrantId} person={person} podium={podium} language={i18n.language} />
                ))}
              </div>
              <div className="fn-block">
                <span className="fn-medal">{place}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PodiumName({ person, podium, language }: { person: PodiumPerson; podium: Podium; language: string }) {
  return (
    <div className="fn-person">
      <div className="fn-person-name">{person.name}</div>
      <div className="fn-person-result">
        {formatResult(person.result, podium.eventId, podium.type)}
        <RecordTag tag={person.tag} />
      </div>
      <div className="fn-person-country">{countryName(person.countryIso2, language)}</div>
    </div>
  );
}

function recordLabel(t: ReturnType<typeof useTranslation>['t'], record: RecordInfo, language: string): string {
  if (record.tag === 'WR') return t('finale.recordWR');
  if (record.tag === 'NR') return t('finale.recordNR', { country: countryName(record.countryIso2, language) });
  return t('finale.recordCR');
}

function RecordsSlide({ records, festive }: { records: RecordInfo[]; festive: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {festive && <Fireworks />}
      <div className="fn-slide-head">
        <h2 className="fn-shine">{t('finale.newRecords')}</h2>
      </div>
      <div className="fn-records">
        {records.map((record, i) => {
          const kind = record.tag === 'WR' || record.tag === 'NR' ? record.tag : 'CR';
          return (
            <div
              key={`${record.eventId}-${record.type}-${record.name}`}
              className={`fn-record fn-record-${kind}`}
              style={{ animationDelay: `${0.3 + i * 0.35}s` }}
            >
              <div className="fn-record-tag">{record.tag}</div>
              <div className="fn-record-label">{recordLabel(t, record, i18n.language)}</div>
              <div className="fn-record-name">{record.name}</div>
              <div className="fn-record-event">
                <EventIcon eventId={record.eventId} />
                {eventName(t, record.eventId)} · {t(`records.${record.type}`)}
              </div>
              <div className="fn-record-result">{formatResult(record.result, record.eventId, record.type)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function NumbersSlide({ finale }: { finale: FinaleData }) {
  const { t } = useTranslation();
  const { stats } = finale;
  const tiles: { key: string; value: number; decimals?: number }[] = [
    { key: 'competitors', value: stats.competitors },
    { key: 'newcomers', value: stats.newcomers },
    { key: 'countries', value: stats.countries },
    { key: 'rounds', value: stats.rounds },
    { key: 'solves', value: stats.solves },
    { key: 'hours', value: stats.solvingHours, decimals: 1 },
  ];
  if (stats.personalRecords > 0) tiles.push({ key: 'personalRecords', value: stats.personalRecords });
  if (stats.records > 0) tiles.push({ key: 'records', value: stats.records });
  tiles.push({ key: 'dnfs', value: stats.dnfs });

  return (
    <>
      <div className="fn-slide-head">
        <h2>{t('finale.numbers')}</h2>
      </div>
      <div className="fn-tiles">
        {tiles.map((tile, i) => (
          <div key={tile.key} className={`fn-tile accent-${i % 6}`} style={{ animationDelay: `${0.1 + i * 0.12}s` }}>
            <div className="fn-tile-number">
              <CountUp value={tile.value} decimals={tile.decimals} />
            </div>
            <div className="fn-tile-label">{t(`finale.${tile.key}`)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function highlightTitle(t: ReturnType<typeof useTranslation>['t'], highlight: Highlight): string {
  if (highlight.kind === 'mostPersonalRecords') return t('finale.mostPersonalRecords');
  return t(`finale.${highlight.kind}`, { event: eventName(t, highlight.eventId) });
}

function highlightValue(t: ReturnType<typeof useTranslation>['t'], highlight: Highlight): string {
  if (highlight.kind === 'mostPersonalRecords') return t('finale.personalRecordCount', { count: highlight.value });
  const result = formatResult(highlight.value, highlight.eventId, highlight.type);
  return highlight.kind === 'bestNewcomer' ? `${result} ${t(`records.${highlight.type}`)}` : result;
}

function HighlightsSlide({ highlights }: { highlights: Highlight[] }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="fn-slide-head">
        <h2>{t('finale.highlights')}</h2>
      </div>
      <div className="fn-highlights">
        {highlights.map((highlight, i) => (
          <div
            key={highlight.kind}
            className={`fn-highlight accent-${(i + 3) % 6}`}
            style={{ animationDelay: `${0.2 + i * 0.3}s` }}
          >
            <div className="fn-highlight-icon">
              {highlight.kind === 'mostPersonalRecords' ? <span className="fn-tag fn-tag-PR">PR</span> : <EventIcon eventId={highlight.eventId} />}
            </div>
            <div className="fn-highlight-text">
              <div className="fn-highlight-title">{highlightTitle(t, highlight)}</div>
              <div className="fn-highlight-name">{highlight.name}</div>
            </div>
            <div className="fn-highlight-value">{highlightValue(t, highlight)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ThanksSlide({ finale }: { finale: FinaleData }) {
  const { t } = useTranslation();
  const { thanks } = finale;
  return (
    <>
      <div className="fn-thanks">{t('finale.thanks')}</div>
      {thanks.organizers.length > 0 && (
        <div className="fn-credit" style={{ animationDelay: '0.6s' }}>
          <span className="fn-credit-label">{t('finale.organizers')}</span>
          {thanks.organizers.join(' · ')}
        </div>
      )}
      {thanks.delegates.length > 0 && (
        <div className="fn-credit" style={{ animationDelay: '1s' }}>
          <span className="fn-credit-label">{t('finale.delegates')}</span>
          {thanks.delegates.join(' · ')}
        </div>
      )}
      <div className="fn-credit" style={{ animationDelay: '1.4s' }}>
        {t('finale.volunteers', { count: thanks.volunteers })}
      </div>
      <div className="fn-see-you">{t('finale.seeYou')}</div>
    </>
  );
}
