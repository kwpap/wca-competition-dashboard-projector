import { useTranslation } from 'react-i18next';
import type { TimeBarLabel } from '../state/storage';

interface TimeBarProps {
  /** Actual start of the running group. */
  start: number;
  /** Planned length of the group. */
  durationMs: number;
  now: number;
  label: TimeBarLabel;
  /** Splits the bar into equal parts with alternating colors, one per attempt plus one. */
  segments?: number;
  className?: string;
}

const WARN_FRACTION = 0.8;
/** Number of colors defined in styles.css (.segment-0 and .segment-1). */
const SEGMENT_COLORS = 2;

/** Shows how much of the planned time of the running group has passed. */
export function TimeBar({ start, durationMs, now, label, segments, className = '' }: TimeBarProps) {
  const { t } = useTranslation();
  if (durationMs <= 0) return null;

  const elapsed = Math.max(0, now - start);
  const fraction = Math.min(1, elapsed / durationMs);
  const over = elapsed > durationMs;
  const segmented = segments !== undefined && segments > 1 && !over;

  let state = 'ok';
  if (over) state = 'over';
  else if (fraction >= WARN_FRACTION) state = 'warn';

  let text = '';
  if (label === 'left') {
    text = over
      ? t('timeBar.over', { count: Math.ceil((elapsed - durationMs) / 60_000) })
      : t('timeBar.left', { count: Math.ceil((durationMs - elapsed) / 60_000) });
  } else if (label === 'elapsed') {
    text = t('timeBar.elapsed', { elapsed: Math.floor(elapsed / 60_000), total: Math.round(durationMs / 60_000) });
  }

  const parts = [];
  if (segmented) {
    for (let i = 0; i < segments; i++) {
      const filled = Math.min(1, Math.max(0, fraction * segments - i));
      parts.push(
        <div key={i} className={`time-bar-segment segment-${i % SEGMENT_COLORS}`}>
          <div className="time-bar-segment-fill" style={{ width: `${filled * 100}%` }} />
        </div>,
      );
    }
  }

  return (
    <div className={`time-bar time-bar-${state} ${segmented ? 'segmented-bar' : ''} ${className}`}>
      <div className="time-bar-track">
        {segmented ? parts : <div className="time-bar-fill" style={{ width: `${fraction * 100}%` }} />}
      </div>
      {text && <span className="time-bar-text">{text}</span>}
    </div>
  );
}
