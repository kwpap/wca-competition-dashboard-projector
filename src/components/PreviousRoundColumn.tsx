import { useTranslation } from 'react-i18next';
import { formatResult } from '../format/result';
import type { Standing } from '../model/advancement';
import type { RoundFormat } from '../types/wcif';

interface PreviousRoundColumnProps {
  /** Label of the previous round, e.g. "3x3x3 Cube Round 1". */
  roundLabel: string;
  standings: Standing[];
  eventId: string;
  format: RoundFormat | undefined;
  onSelect: (registrantId: number) => void;
}

/** Ranking of the previous round: who advanced (green) and who just missed (yellow). */
export function PreviousRoundColumn({ roundLabel, standings, eventId, format, onSelect }: PreviousRoundColumnProps) {
  const { t } = useTranslation();
  const usesAverage = format === 'a' || format === 'm';

  return (
    <section className="role-column previous-round">
      <h3>
        {t('previousRound.title')} <span className="count">{roundLabel}</span>
      </h3>
      {standings.length === 0 && <p className="muted">{t('previousRound.none')}</p>}
      <ul>
        {standings.map(({ row, status }) => (
          <li key={row.registrantId}>
            <button
              className={`person-row standing-${status}`}
              title={status === 'advanced' ? t('previousRound.advanced') : undefined}
              onClick={() => onSelect(row.registrantId)}
            >
              <span className="station">{row.ranking ?? ''}</span>
              <span className="person-name">
                {row.name}
                {status === 'justMissed' && <span className="just-missed-tag">{t('previousRound.justMissed')}</span>}
              </span>
              <span className="person-bests">
                <span>
                  {formatResult(usesAverage ? row.average : row.best, eventId, usesAverage ? 'average' : 'single')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
