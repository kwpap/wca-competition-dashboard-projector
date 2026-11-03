import { useTranslation } from 'react-i18next';
import { toMinutes } from '../format/time';

interface DelayBadgeProps {
  delayMs: number;
  started: boolean;
  stopped?: boolean;
}

export function DelayBadge({ delayMs, started, stopped = false }: DelayBadgeProps) {
  const { t } = useTranslation();
  const minutes = toMinutes(delayMs);

  if (!started) return <span className="badge badge-neutral">{t('delay.notStarted')}</span>;
  if (stopped) return <span className="badge badge-neutral">{t('delay.stopped')}</span>;
  if (minutes === 0) return <span className="badge badge-ok">{t('delay.onTime')}</span>;
  if (minutes > 0) return <span className="badge badge-late">{t('delay.behind', { count: minutes })}</span>;
  return <span className="badge badge-early">{t('delay.ahead', { count: -minutes })}</span>;
}
