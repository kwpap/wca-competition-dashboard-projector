import { useTranslation } from 'react-i18next';
import { Modal } from '../components/Modal';
import { formatClock } from '../format/time';
import type { CompetitionModel } from '../model/competition';
import type { Incident } from './types';

interface IncidentListProps {
  model: CompetitionModel;
  incidents: Incident[];
  onOpen: (incident: Incident) => void;
  onNew: () => void;
  onExport: () => void;
  onClose: () => void;
}

export function IncidentList({ model, incidents, onOpen, onNew, onExport, onClose }: IncidentListProps) {
  const { t, i18n } = useTranslation();
  const sorted = [...incidents].sort((a, b) => b.createdAt - a.createdAt);

  const actions = (
    <>
      <button className="btn" onClick={onExport} disabled={incidents.length === 0}>
        {t('incidents.export')}
      </button>
      <button className="btn btn-primary" onClick={onNew}>
        {t('incidents.new')}
      </button>
    </>
  );

  return (
    <Modal title={t('incidents.title')} onClose={onClose} actions={actions}>
      {sorted.length === 0 && <p className="muted">{t('incidents.empty')}</p>}
      <ul className="incident-list">
        {sorted.map((incident) => (
          <li key={incident.id}>
            <button className="incident-row" onClick={() => onOpen(incident)}>
              <span className="incident-time">{formatClock(incident.createdAt, model.timezone, i18n.language)}</span>
              <span className="incident-slot">{incident.slotLabel ?? ''}</span>
              <span className="incident-preview">{incident.text.split('\n')[0]}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
