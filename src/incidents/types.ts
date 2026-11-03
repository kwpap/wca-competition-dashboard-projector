export type IncidentRef =
  | { type: 'person'; registrantId: number; label: string }
  | { type: 'activity'; activityCode: string; label: string };

export interface Incident {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Slot running when the incident was created. */
  slotId: number | null;
  slotLabel: string | null;
  text: string;
  refs: IncidentRef[];
}

export function upsertIncident(list: Incident[], incident: Incident): Incident[] {
  const exists = list.some((i) => i.id === incident.id);
  if (!exists) return [...list, incident];
  return list.map((i) => (i.id === incident.id ? incident : i));
}

export function removeIncident(list: Incident[], id: string): Incident[] {
  return list.filter((i) => i.id !== id);
}
