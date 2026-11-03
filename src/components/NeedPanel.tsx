import { useTranslation } from 'react-i18next';
import { EMPTY_CALLS, hasActiveCall, type CallRole, type CallState, type NamedCallRole } from '../state/storage';

interface NeedPanelProps {
  calls: CallState;
  onChange: (calls: CallState) => void;
  /** Opens the people picker for a role. */
  onPick: (role: NamedCallRole) => void;
}

const ROLES: CallRole[] = ['judges', 'runners', 'scramblers'];

/** "Need for" buttons. Each role has a general call (left half) and a call for named people (right half). */
export function NeedPanel({ calls, onChange, onPick }: NeedPanelProps) {
  const { t } = useTranslation();

  function toggle(role: CallRole) {
    const general = calls.general.includes(role)
      ? calls.general.filter((r) => r !== role)
      : [...calls.general, role];
    onChange({ ...calls, general });
  }

  const namedCount = (role: NamedCallRole) => calls.named[role]?.length ?? 0;

  return (
    <div className="need-panel" role="group" aria-label={t('need.title')}>
      <span className="need-label">{t('need.title')}:</span>
      {ROLES.map((role) => (
        <div key={role} className="split-button">
          <button className={calls.general.includes(role) ? 'btn btn-danger' : 'btn'} onClick={() => toggle(role)}>
            {t(`roles.${role}`)}
          </button>
          <button className={namedCount(role) > 0 ? 'btn btn-danger' : 'btn'} onClick={() => onPick(role)}>
            {t('need.names')}
            {namedCount(role) > 0 && ` (${namedCount(role)})`}
          </button>
        </div>
      ))}
      <button className={namedCount('delegates') > 0 ? 'btn btn-danger' : 'btn'} onClick={() => onPick('delegates')}>
        {t('need.specify')}
        {namedCount('delegates') > 0 && ` (${namedCount('delegates')})`}
      </button>
      {hasActiveCall(calls) && (
        <button className="btn" onClick={() => onChange(EMPTY_CALLS)}>
          {t('need.clearAll')}
        </button>
      )}
    </div>
  );
}
