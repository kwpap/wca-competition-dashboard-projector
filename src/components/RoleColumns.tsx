import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatResult } from '../format/result';
import { personalBest, type SlotPeople, type SlotPerson } from '../model/people';

interface RoleColumnsProps {
  people: SlotPeople;
  eventId: string | null;
  onSelect: (registrantId: number) => void;
  /** Previous round ranking, shown next to the competitors for round 2 and later. */
  previousRound?: ReactNode;
}

interface ColumnProps {
  title: string;
  list: SlotPerson[];
  eventId: string | null;
  showBests: boolean;
  onSelect: (registrantId: number) => void;
}

function Column({ title, list, eventId, showBests, onSelect }: ColumnProps) {
  const { t } = useTranslation();
  return (
    <section className="role-column">
      <h3>
        {title} <span className="count">{list.length}</span>
      </h3>
      <ul>
        {list.map(({ person, station }) => (
          <li key={person.registrantId}>
            <button className="person-row" onClick={() => onSelect(person.registrantId!)}>
              <span className="station">{station ?? ''}</span>
              <span className="person-name">{person.name}</span>
              {showBests && eventId && (
                <span className="person-bests">
                  <span title={t('person.bestSingle')}>
                    {formatResult(personalBest(person, eventId, 'single'), eventId, 'single') || '-'}
                  </span>
                  <span title={t('person.bestAverage')}>
                    {formatResult(personalBest(person, eventId, 'average'), eventId, 'average') || '-'}
                  </span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RoleColumns({ people, eventId, onSelect, previousRound }: RoleColumnsProps) {
  const { t } = useTranslation();
  return (
    <div className={previousRound ? 'role-columns with-previous' : 'role-columns'}>
      <Column title={t('roles.competitors')} list={people.competitors} eventId={eventId} showBests onSelect={onSelect} />
      {previousRound}
      <Column title={t('roles.judges')} list={people.judges} eventId={eventId} showBests={false} onSelect={onSelect} />
      <Column title={t('roles.scramblers')} list={people.scramblers} eventId={eventId} showBests={false} onSelect={onSelect} />
      <Column title={t('roles.runners')} list={people.runners} eventId={eventId} showBests={false} onSelect={onSelect} />
    </div>
  );
}
