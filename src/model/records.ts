import type { RecordsResponse } from '../api/wca';
import { COUNTRIES } from '../data/countries';

const CONTINENTAL_TAGS: Record<string, string> = {
  _Europe: 'ER',
  _Asia: 'AsR',
  _Africa: 'AfR',
  '_North America': 'NAR',
  '_South America': 'SAR',
  _Oceania: 'OcR',
};

/** Where a record applies. Names are translated when shown. */
export type RecordRegion =
  | { kind: 'world' }
  | { kind: 'continent'; name: string }
  | { kind: 'country'; iso2: string };

export interface RecordRow {
  tag: string;
  region: RecordRegion;
  single?: number;
  average?: number;
}

export function recordsForEvent(records: RecordsResponse, eventId: string, countryIso2: string): RecordRow[] {
  const rows: RecordRow[] = [{ tag: 'WR', region: { kind: 'world' }, ...records.world_records[eventId] }];

  const country = COUNTRIES[countryIso2];
  if (!country) return rows;

  const [countryId, continentId] = country;
  rows.push({
    tag: CONTINENTAL_TAGS[continentId] ?? 'CR',
    region: { kind: 'continent', name: continentId.replace(/^_/, '') },
    ...records.continental_records[continentId]?.[eventId],
  });
  rows.push({
    tag: 'NR',
    region: { kind: 'country', iso2: countryIso2 },
    ...records.national_records[countryId]?.[eventId],
  });
  return rows;
}
