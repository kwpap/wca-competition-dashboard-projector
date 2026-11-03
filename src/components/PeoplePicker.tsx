import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultsCache } from '../api/results';
import { formatResult } from '../format/result';
import { buildCandidates, searchCandidates } from '../incidents/mentions';
import { eventName } from '../model/activityCode';
import type { CompetitionModel } from '../model/competition';
import { personalBest } from '../model/people';
import { pickerGroups } from '../model/pickerGroups';
import type { NamedCallRole } from '../state/storage';
import type { Person } from '../types/wcif';
import { Modal } from './Modal';

interface PeoplePickerProps {
  model: CompetitionModel;
  results: ResultsCache | null;
  role: NamedCallRole;
  initial: number[];
  /** People in the running group, shown as busy. */
  busyIds: Set<number>;
  justMissedCount: number;
  onSave: (registrantIds: number[]) => void;
  onClose: () => void;
}

const SEARCH_LIMIT = 30;

/** Choose people for a call: type to search, or pick an event to see who just missed and who is fast. */
export function PeoplePicker(props: PeoplePickerProps) {
  const { model, results, role, busyIds, justMissedCount } = props;
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<number[]>(props.initial);
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);

  const people = useMemo(() => [...model.persons.values()].sort((a, b) => a.name.localeCompare(b.name)), [model]);
  const candidates = useMemo(() => buildCandidates(t, model).filter((c) => c.ref.type === 'person'), [t, model]);
  const groups = useMemo(
    () => (eventId ? pickerGroups(model, results, people, eventId, justMissedCount) : null),
    [model, results, people, eventId, justMissedCount],
  );

  const matches: Person[] = [];
  if (query.trim()) {
    for (const candidate of searchCandidates(candidates, query, SEARCH_LIMIT)) {
      const person = candidate.ref.type === 'person' ? model.persons.get(candidate.ref.registrantId) : undefined;
      if (person) matches.push(person);
    }
  }

  function toggle(registrantId: number) {
    setChosen((list) => (list.includes(registrantId) ? list.filter((id) => id !== registrantId) : [...list, registrantId]));
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && matches.length > 0) {
      toggle(matches[0].registrantId!);
      setQuery('');
    }
  }

  function bestText(person: Person): string {
    if (!eventId) return '';
    const average = personalBest(person, eventId, 'average');
    if (average !== null) return formatResult(average, eventId, 'average');
    const single = personalBest(person, eventId, 'single');
    return single !== null ? formatResult(single, eventId, 'single') : '';
  }

  function personButton(person: Person) {
    const id = person.registrantId!;
    return (
      <button
        key={id}
        className={chosen.includes(id) ? 'picker-person picked' : 'picker-person'}
        onClick={() => toggle(id)}
      >
        <span className="person-name">{person.name}</span>
        {busyIds.has(id) && <span className="busy-tag">{t('picker.busy')}</span>}
        <span className="muted">{bestText(person)}</span>
      </button>
    );
  }

  function column(list: Person[], title?: string) {
    return (
      <section className="picker-column">
        {title && (
          <h3>
            {title} <span className="count">{list.length}</span>
          </h3>
        )}
        {list.map(personButton)}
      </section>
    );
  }

  let listing = column(people);
  if (query.trim()) {
    listing = column(matches);
  } else if (groups) {
    listing = (
      <div className="picker-columns">
        {column(groups.justMissed, t('picker.justMissed'))}
        {column(groups.fast, t('picker.fast'))}
        {column(groups.rest, t('picker.rest'))}
      </div>
    );
  }

  return (
    <Modal
      title={t(`picker.${role}`)}
      onClose={props.onClose}
      wide
      actions={
        <>
          <button className="btn" onClick={() => setChosen([])} disabled={chosen.length === 0}>
            {t('picker.clear')}
          </button>
          <button className="btn btn-primary" onClick={() => props.onSave(chosen)}>
            {t('picker.show')}
          </button>
        </>
      }
    >
      <input
        className="text-input picker-search"
        autoFocus
        value={query}
        placeholder={t('picker.search')}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onSearchKey}
      />

      {chosen.length > 0 && (
        <div className="chips">
          {chosen.map((id) => (
            <button key={id} className="chip" onClick={() => toggle(id)}>
              {model.persons.get(id)?.name ?? `#${id}`} ×
            </button>
          ))}
        </div>
      )}

      <div className="event-icons">
        {model.wcif.events.map((event) => (
          <button
            key={event.id}
            className={eventId === event.id ? 'event-icon selected' : 'event-icon'}
            title={eventName(t, event.id)}
            onClick={() => setEventId(eventId === event.id ? null : event.id)}
          >
            <span className={`cubing-icon event-${event.id}`} />
          </button>
        ))}
      </div>

      {listing}
    </Modal>
  );
}
