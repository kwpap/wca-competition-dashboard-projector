import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { RecordsResponse } from '../api/wca';
import { formatResult } from '../format/result';
import { eventName } from '../model/activityCode';
import { recordsForEvent, type RecordRegion } from '../model/records';

interface RecordsTableProps {
  records: RecordsResponse | null;
  eventId: string | null;
  countryIso2: string;
}

/** Country names come from the browser, so all countries are translated without a list of our own. */
function regionName(t: TFunction, region: RecordRegion, language: string): string {
  if (region.kind === 'world') return t('records.world');
  if (region.kind === 'continent') return t(`continents.${region.name}`, { defaultValue: region.name });
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(region.iso2) ?? region.iso2;
  } catch {
    return region.iso2;
  }
}

export function RecordsTable({ records, eventId, countryIso2 }: RecordsTableProps) {
  const { t, i18n } = useTranslation();
  if (!records || !eventId) return null;

  const rows = recordsForEvent(records, eventId, countryIso2);
  return (
    <section className="records">
      <h3>{t('records.title', { event: eventName(t, eventId) })}</h3>
      <table>
        <thead>
          <tr>
            <th />
            <th>{t('records.single')}</th>
            <th>{t('records.average')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tag}>
              <th>
                <span className={`record-tag tag-${row.tag === 'WR' || row.tag === 'NR' ? row.tag : 'CR'}`}>{row.tag}</span>
                <span className="record-region">{regionName(t, row.region, i18n.language)}</span>
              </th>
              <td>{formatResult(row.single, eventId, 'single') || '-'}</td>
              <td>{formatResult(row.average, eventId, 'average') || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
