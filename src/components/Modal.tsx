import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

export function Modal({ title, onClose, actions, wide = false, children }: ModalProps) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={wide ? 'modal modal-wide' : 'modal'} onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <div className="modal-actions">
            {actions}
            <button className="btn" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
