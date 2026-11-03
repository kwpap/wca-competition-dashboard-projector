function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}

export function formatCentiseconds(centiseconds: number): string {
  const totalSeconds = Math.floor(centiseconds / 100);
  const fraction = pad2(centiseconds % 100);
  if (totalSeconds < 60) return `${totalSeconds}.${fraction}`;
  return `${formatSeconds(totalSeconds)}.${fraction}`;
}

/** Time limits and cutoffs are whole seconds in practice, so "10:00.00" becomes "10:00". */
export function formatLimit(centiseconds: number): string {
  return formatCentiseconds(centiseconds).replace(/\.00$/, '');
}

/**
 * Multi-blind values use two encodings:
 * new: 0DDTTTTTMM (difference = 99 - DD, time in seconds, missed)
 * old: 1SSAATTTTT (solved = 99 - SS, attempted, time in seconds)
 */
function formatMultiBlind(value: number): string {
  let solved: number;
  let attempted: number;
  let seconds: number;

  if (value >= 1_000_000_000) {
    solved = 99 - (Math.floor(value / 10_000_000) % 100);
    attempted = Math.floor(value / 100_000) % 100;
    seconds = value % 100_000;
  } else {
    const missed = value % 100;
    const difference = 99 - (Math.floor(value / 10_000_000) % 100);
    seconds = Math.floor(value / 100) % 100_000;
    solved = difference + missed;
    attempted = solved + missed;
  }

  const time = seconds === 99_999 ? '?' : formatSeconds(seconds);
  return `${solved}/${attempted} ${time}`;
}

/** Formats a WCA attempt result. 0 = no result, -1 = DNF, -2 = DNS. */
export function formatResult(value: number | null | undefined, eventId: string, type: 'single' | 'average'): string {
  if (value === null || value === undefined || value === 0) return '';
  if (value === -1) return 'DNF';
  if (value === -2) return 'DNS';
  if (eventId === '333fm') return type === 'single' ? String(value) : (value / 100).toFixed(2);
  if (eventId === '333mbf' || eventId === '333mbo') return formatMultiBlind(value);
  return formatCentiseconds(value);
}
