// Subset of WCIF v1 used by the app. See https://github.com/thewca/wcif

export interface Wcif {
  id: string;
  name: string;
  shortName: string;
  persons: Person[];
  events: WcifEvent[];
  schedule: Schedule;
}

export interface Person {
  registrantId: number | null;
  name: string;
  wcaUserId: number;
  wcaId: string | null;
  countryIso2: string;
  roles?: string[];
  registration: { eventIds: string[]; status: string } | null;
  assignments: Assignment[];
  personalBests?: PersonalBest[];
}

export interface Assignment {
  activityId: number;
  assignmentCode: string;
  stationNumber: number | null;
}

export interface PersonalBest {
  eventId: string;
  best: number;
  type: 'single' | 'average';
  worldRanking: number;
  continentalRanking: number;
  nationalRanking: number;
}

export interface WcifEvent {
  id: string;
  rounds: Round[];
}

/** "5" is best of 5, used for 3x3x3 Blindfolded. It ranks by single like 1, 2 and 3. */
export type RoundFormat = '1' | '2' | '3' | '5' | 'a' | 'm';

export interface Round {
  id: string;
  format: RoundFormat;
  timeLimit: TimeLimit | null;
  cutoff: Cutoff | null;
  advancementCondition: AdvancementCondition | null;
  results: WcifResult[];
}

export interface TimeLimit {
  centiseconds: number;
  cumulativeRoundIds: string[];
}

export interface Cutoff {
  numberOfAttempts: number;
  attemptResult: number;
}

export interface AdvancementCondition {
  type: 'ranking' | 'percent' | 'attemptResult';
  level: number;
}

export interface WcifResult {
  personId: number;
  ranking: number | null;
  attempts: { result: number }[];
  best: number;
  average: number;
}

export interface Schedule {
  startDate: string;
  numberOfDays: number;
  venues: Venue[];
}

export interface Venue {
  id: number;
  name: string;
  timezone: string;
  countryIso2: string;
  rooms: Room[];
}

export interface Room {
  id: number;
  name: string;
  color: string;
  activities: Activity[];
}

export interface Activity {
  id: number;
  name: string;
  activityCode: string;
  startTime: string;
  endTime: string;
  childActivities: Activity[];
}
