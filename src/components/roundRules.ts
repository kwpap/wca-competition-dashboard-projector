import type { TFunction } from 'i18next';
import { formatLimit, formatResult } from '../format/result';
import type { Round } from '../types/wcif';

export interface RoundRules {
  timeLimit: string | null;
  cutoff: string | null;
  advancement: string | null;
}

function formatAttemptResult(value: number, eventId: string): string {
  if (eventId === '333fm' || eventId === '333mbf') return formatResult(value, eventId, 'single');
  return formatLimit(value);
}

export function describeRound(t: TFunction, round: Round | undefined, eventId: string): RoundRules {
  if (!round) return { timeLimit: null, cutoff: null, advancement: null };

  let timeLimit: string | null = null;
  if (round.timeLimit) {
    const time = formatLimit(round.timeLimit.centiseconds);
    timeLimit =
      round.timeLimit.cumulativeRoundIds.length > 0
        ? t('round.timeLimitCumulative', { time })
        : t('round.timeLimit', { time });
  }

  const cutoff = round.cutoff
    ? t('round.cutoff', {
        count: round.cutoff.numberOfAttempts,
        time: formatAttemptResult(round.cutoff.attemptResult, eventId),
      })
    : null;

  let advancement: string | null = null;
  const condition = round.advancementCondition;
  if (condition?.type === 'ranking') advancement = t('round.advanceRanking', { level: condition.level });
  if (condition?.type === 'percent') advancement = t('round.advancePercent', { level: condition.level });
  if (condition?.type === 'attemptResult') {
    advancement = t('round.advanceResult', { time: formatAttemptResult(condition.level, eventId) });
  }

  return { timeLimit, cutoff, advancement };
}
