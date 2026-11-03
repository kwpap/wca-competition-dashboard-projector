import type { Person, Wcif } from '../types/wcif';

export interface SlotPerson {
  person: Person;
  station: number | null;
}

export interface SlotPeople {
  competitors: SlotPerson[];
  judges: SlotPerson[];
  scramblers: SlotPerson[];
  runners: SlotPerson[];
}

const COLUMN_BY_CODE: Record<string, keyof SlotPeople> = {
  competitor: 'competitors',
  'staff-judge': 'judges',
  'staff-scrambler': 'scramblers',
  'staff-runner': 'runners',
};

function compareByStationThenName(a: SlotPerson, b: SlotPerson): number {
  const stationA = a.station ?? Number.MAX_SAFE_INTEGER;
  const stationB = b.station ?? Number.MAX_SAFE_INTEGER;
  return stationA - stationB || a.person.name.localeCompare(b.person.name);
}

export function peopleForSlot(wcif: Wcif, slotId: number): SlotPeople {
  const people: SlotPeople = { competitors: [], judges: [], scramblers: [], runners: [] };
  for (const person of wcif.persons) {
    for (const assignment of person.assignments) {
      if (assignment.activityId !== slotId) continue;
      const column = COLUMN_BY_CODE[assignment.assignmentCode];
      if (column) people[column].push({ person, station: assignment.stationNumber });
    }
  }
  for (const list of Object.values(people)) list.sort(compareByStationThenName);
  return people;
}

export function personalBest(person: Person, eventId: string, type: 'single' | 'average'): number | null {
  const best = person.personalBests?.find((pb) => pb.eventId === eventId && pb.type === type);
  return best?.best ?? null;
}
