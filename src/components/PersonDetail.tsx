import { useTranslation } from 'react-i18next';
import type { ResultsCache } from '../api/results';
import { formatResult } from '../format/result';
import { formatDayClock } from '../format/time';
import { eventName, roundCode } from '../model/activityCode';
import type { CompetitionModel } from '../model/competition';
import { activityLabel } from '../model/labels';
import { personalBest } from '../model/people';
import { activityTime, type LogEntry } from '../model/scheduleEngine';
import { Modal } from './Modal';

interface PersonDetailProps {
  model: CompetitionModel;
  log: LogEntry[];
  results: ResultsCache | null;
  registrantId: number;
  onClose: () => void;
}

export function PersonDetail({ model, log, results, registrantId, onClose }: PersonDetailProps) {
  const { t, i18n } = useTranslation();
  const person = model.persons.get(registrantId);
  if (!person) return null;

  const assignments = person.assignments
    .map((assignment) => {
      const activity = model.activities.get(assignment.activityId);
      if (!activity) return null;
      return { assignment, activity, time: activityTime(model, log, activity) };
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.time.start - b.time.start);

  const eventIds = person.registration?.eventIds ?? [];
  const personResults = (results?.rounds ?? []).flatMap((round) => {
    const row = round.rows.find((r) => r.registrantId === registrantId);
    return row ? [{ round, row }] : [];
  });

  const subtitle = [person.wcaId ?? t('person.newcomer'), `#${person.registrantId}`, person.countryIso2].join(' · ');

  return (
    <Modal title={person.name} onClose={onClose}>
      <p className="muted">{subtitle}</p>

      <h3>{t('person.personalBests')}</h3>
      <table className="table">
        <thead>
          <tr>
            <th>{t('person.event')}</th>
            <th>{t('person.bestSingle')}</th>
            <th>{t('person.bestAverage')}</th>
          </tr>
        </thead>
        <tbody>
          {eventIds.map((eventId) => (
            <tr key={eventId}>
              <td>{eventName(t, eventId)}</td>
              <td>{formatResult(personalBest(person, eventId, 'single'), eventId, 'single') || '-'}</td>
              <td>{formatResult(personalBest(person, eventId, 'average'), eventId, 'average') || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{t('person.assignments')}</h3>
      {assignments.length === 0 && <p className="muted">{t('person.noAssignments')}</p>}
      <table className="table">
        <tbody>
          {assignments.map(({ assignment, activity, time }) => (
            <tr key={`${assignment.activityId}-${assignment.assignmentCode}`}>
              <td className={`time time-${time.kind}`}>{formatDayClock(time.start, activity.timezone, i18n.language)}</td>
              <td>{activityLabel(t, model, activity.activityCode, activity.name)}</td>
              <td>{t(`roles.code.${assignment.assignmentCode}`, { defaultValue: assignment.assignmentCode })}</td>
              <td>{assignment.stationNumber !== null ? t('person.station', { number: assignment.stationNumber }) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{t('person.results')}</h3>
      {personResults.length === 0 && <p className="muted">{t('person.noResults')}</p>}
      <table className="table">
        <tbody>
          {personResults.map(({ round, row }) => (
            <tr key={round.roundCode}>
              <td>{activityLabel(t, model, roundCode(round.eventId, round.roundNumber))}</td>
              <td>{row.ranking ?? ''}</td>
              <td>
                {t('person.averageShort')} {formatResult(row.average, round.eventId, 'average') || '-'}
              </td>
              <td>
                {t('person.singleShort')} {formatResult(row.best, round.eventId, 'single') || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
