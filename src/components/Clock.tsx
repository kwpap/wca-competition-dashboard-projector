import { useTranslation } from 'react-i18next';
import { formatClock, formatClockWithSeconds } from '../format/time';
import { useNow } from '../hooks/useNow';

interface ClockProps {
  timezone: string;
  withSeconds?: boolean;
  className?: string;
}

export function Clock({ timezone, withSeconds = false, className = 'clock' }: ClockProps) {
  const { i18n } = useTranslation();
  const now = useNow(1000);
  const text = withSeconds
    ? formatClockWithSeconds(now, timezone, i18n.language)
    : formatClock(now, timezone, i18n.language);
  return <span className={className}>{text}</span>;
}
