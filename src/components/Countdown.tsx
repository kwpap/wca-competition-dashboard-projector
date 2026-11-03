import { useTranslation } from 'react-i18next';
import { formatClock, formatWeekday } from '../format/time';

interface CountdownProps {
  competitionName: string;
  /** When the countdown started, for the progress bar. */
  start: number;
  /** Planned start of the day's first activity. */
  target: number;
  now: number;
  timezone: string;
  firstActivity: string | null;
  /** Events planned for this day, shown as icons. */
  eventIds: string[];
  festive: boolean;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Full-screen "Starting in HH:MM:SS" before the first activity of a day. */
export function Countdown({ competitionName, start, target, now, timezone, firstActivity, eventIds, festive }: CountdownProps) {
  const { t, i18n } = useTranslation();
  const leftMs = Math.max(0, target - now);
  const totalSeconds = Math.ceil(leftMs / 1000);
  const parts = [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60];
  const progress = target > start ? Math.min(1, Math.max(0, (now - start) / (target - start))) : 1;
  const weekday = formatWeekday(target, timezone, i18n.language);

  return (
    <div className="countdown">
      {festive && (
        <>
          <div className="fn-glow fn-glow-a" aria-hidden="true" />
          <div className="fn-glow fn-glow-b" aria-hidden="true" />
        </>
      )}
      <div className="cd-kicker">{weekday}</div>
      <h1 className="cd-name">{competitionName}</h1>

      {leftMs > 0 ? (
        <>
          <div className="cd-caption">{t('countdown.startingIn')}</div>
          <div className="cd-digits">
            {parts.map((value, i) => (
              <span key={i} className="cd-group">
                {i > 0 && <span className="cd-colon">:</span>}
                <span className="cd-number">{pad2(value)}</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="cd-now">{t('countdown.startingNow')}</div>
      )}

      <div className="cd-progress">
        <div className="cd-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {firstActivity && (
        <div className="cd-first">
          {t('countdown.first', { activity: firstActivity, time: formatClock(target, timezone, i18n.language) })}
        </div>
      )}
      {eventIds.length > 0 && (
        <div className="cd-events" aria-hidden="true">
          {eventIds.map((eventId) => (
            <span key={eventId} className={`cubing-icon event-${eventId}`} />
          ))}
        </div>
      )}
    </div>
  );
}
