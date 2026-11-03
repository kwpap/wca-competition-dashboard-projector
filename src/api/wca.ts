import { WCA_ORIGIN } from '../config';
import type { Activity, Wcif } from '../types/wcif';
import { getToken } from './auth';

export class AuthError extends Error {}

async function wcaGet<T>(path: string, auth = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    const token = getToken();
    if (!token) throw new AuthError('Not logged in');
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${WCA_ORIGIN}${path}`, { headers });
  if (response.status === 401) throw new AuthError('Unauthorized');
  if (!response.ok) throw new Error(`WCA API ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}

export interface Me {
  id: number;
  name: string;
  wca_id: string | null;
}

export async function getMe(): Promise<Me> {
  const data = await wcaGet<{ me: Me }>('/api/v0/me');
  return data.me;
}

export interface CompetitionSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string;
  countryIso2: string;
}

interface RawCompetition {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  country_iso2: string;
}

type RawCompetitionList =
  | RawCompetition[]
  | { future_competitions?: RawCompetition[]; past_competitions?: RawCompetition[] };

function normalizeCompetitions(data: RawCompetitionList): CompetitionSummary[] {
  const list = Array.isArray(data)
    ? data
    : [...(data.future_competitions ?? []), ...(data.past_competitions ?? [])];
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    startDate: c.start_date,
    endDate: c.end_date,
    city: c.city,
    countryIso2: c.country_iso2,
  }));
}

/**
 * Competitions the logged-in user manages, from 30 days ago onwards.
 * Tries several endpoints because the WCA API is being migrated from v0 to v1.
 */
export async function getManagedCompetitions(): Promise<CompetitionSummary[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const paths = [
    `/api/v0/competitions?managed_by_me=true&start=${since}&sort=start_date&per_page=100`,
    '/api/v1/competitions/managed',
    '/api/v0/competitions/mine',
  ];

  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const list = normalizeCompetitions(await wcaGet<RawCompetitionList>(path));
      return list
        .filter((c) => c.endDate >= since)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    } catch (error) {
      if (error instanceof AuthError) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

function trimActivity(activity: Activity): Activity {
  return {
    id: activity.id,
    name: activity.name,
    activityCode: activity.activityCode,
    startTime: activity.startTime,
    endTime: activity.endTime,
    childActivities: (activity.childActivities ?? []).map(trimActivity),
  };
}

/**
 * Keeps only the fields the app uses so the WCIF fits in localStorage.
 * Scrambles must never be stored or shown, so scramble sets are dropped here.
 */
function trimWcif(wcif: Wcif): Wcif {
  return {
    id: wcif.id,
    name: wcif.name,
    shortName: wcif.shortName,
    persons: wcif.persons
      .filter((p) => p.registrantId !== null)
      .filter((p) => p.registration?.status === 'accepted' || p.assignments.length > 0)
      .map((p) => ({
        registrantId: p.registrantId,
        name: p.name,
        wcaUserId: p.wcaUserId,
        wcaId: p.wcaId,
        countryIso2: p.countryIso2,
        roles: p.roles ?? [],
        registration: p.registration
          ? { eventIds: p.registration.eventIds, status: p.registration.status }
          : null,
        assignments: p.assignments,
        personalBests: p.personalBests ?? [],
      })),
    events: wcif.events.map((e) => ({
      id: e.id,
      rounds: e.rounds.map((r) => ({
        id: r.id,
        format: r.format,
        timeLimit: r.timeLimit,
        cutoff: r.cutoff,
        advancementCondition: r.advancementCondition,
        results: r.results ?? [],
      })),
    })),
    schedule: {
      startDate: wcif.schedule.startDate,
      numberOfDays: wcif.schedule.numberOfDays,
      venues: wcif.schedule.venues.map((v) => ({
        id: v.id,
        name: v.name,
        timezone: v.timezone,
        countryIso2: v.countryIso2,
        rooms: v.rooms.map((room) => ({
          id: room.id,
          name: room.name,
          color: room.color,
          activities: room.activities.map(trimActivity),
        })),
      })),
    },
  };
}

export async function getWcif(competitionId: string): Promise<Wcif> {
  const wcif = await wcaGet<Wcif>(`/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif`);
  return trimWcif(wcif);
}

/** Public WCIF, no login needed. Has schedule, assignments and PBs, but may be cached up to 5 minutes. */
export async function getPublicWcif(competitionId: string): Promise<Wcif> {
  const wcif = await wcaGet<Wcif>(`/api/v0/competitions/${encodeURIComponent(competitionId)}/wcif/public`, false);
  return trimWcif(wcif);
}

type EventRecords = Record<string, { single?: number; average?: number }>;

export interface RecordsResponse {
  world_records: EventRecords;
  continental_records: Record<string, EventRecords>;
  national_records: Record<string, EventRecords>;
}

export function getRecords(): Promise<RecordsResponse> {
  return wcaGet<RecordsResponse>('/api/v0/records', false);
}
