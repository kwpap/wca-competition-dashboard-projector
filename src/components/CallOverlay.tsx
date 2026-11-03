import { useTranslation } from 'react-i18next';
import type { CompetitionModel } from '../model/competition';
import { hasActiveCall, type CallState, type NamedCallRole } from '../state/storage';

interface CallOverlayProps {
  calls: CallState;
  model: CompetitionModel;
  /** Seconds the call is shown, then seconds the normal screen is shown. */
  seconds: number;
  now: number;
}

const NAMED_ORDER: NamedCallRole[] = ['delegates', 'judges', 'scramblers', 'runners'];
/** Above this many names, a smaller font keeps a whole group's staff on screen. */
const LONG_CALL_NAMES = 10;

/** Full-screen call that alternates with the normal projector screen to catch attention. */
export function CallOverlay({ calls, model, seconds, now }: CallOverlayProps) {
  const { t } = useTranslation();
  if (!hasActiveCall(calls)) return null;

  const visible = Math.floor(now / (seconds * 1000)) % 2 === 0;

  const namedLines: string[] = [];
  let nameCount = 0;
  for (const role of NAMED_ORDER) {
    const names = (calls.named[role] ?? []).map((id) => model.persons.get(id)?.name ?? `#${id}`);
    nameCount += names.length;
    if (names.length > 0) namedLines.push(t(`call.${role}`, { names: names.join(', ') }));
  }
  const namedClass = nameCount > LONG_CALL_NAMES ? 'call-named call-named-long' : 'call-named';
  const roles = calls.general.map((role) => t(`roles.${role}`)).join(', ');

  return (
    <div className={visible ? 'call-overlay visible' : 'call-overlay'} aria-live="assertive">
      {namedLines.map((line) => (
        <div key={line} className={namedClass}>
          {line}
        </div>
      ))}
      {roles && <div className="call-need">{t('call.weNeed', { roles })}</div>}
    </div>
  );
}
