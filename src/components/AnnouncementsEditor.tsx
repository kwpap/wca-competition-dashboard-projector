import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { announcementText, isTemplate } from '../model/announcements';
import type { Announcement } from '../state/storage';
import { Modal } from './Modal';

interface AnnouncementsEditorProps {
  announcements: Announcement[];
  onChange: (announcements: Announcement[]) => void;
  onClose: () => void;
}

export function AnnouncementsEditor({ announcements, onChange, onClose }: AnnouncementsEditorProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState('');
  const templates = announcements.filter(isTemplate);
  const custom = announcements.filter((a) => !isTemplate(a));

  function add(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onChange([...announcements, { id: crypto.randomUUID(), text: draft.trim(), active: true }]);
    setDraft('');
  }

  function update(id: string, changes: Partial<Announcement>) {
    onChange(announcements.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }

  function remove(id: string) {
    onChange(announcements.filter((a) => a.id !== id));
  }

  function toggle(announcement: Announcement) {
    return (
      <button
        className={announcement.active ? 'btn btn-showing' : 'btn'}
        onClick={() => update(announcement.id, { active: !announcement.active })}
      >
        {announcement.active ? t('announcements.showing') : t('announcements.hidden')}
      </button>
    );
  }

  return (
    <Modal title={t('announcements.title')} onClose={onClose}>
      <p className="muted">{t('announcements.help')}</p>

      {templates.length > 0 && (
        <>
          <h3 className="option-section">{t('announcements.templates')}</h3>
          <ul className="announcement-list">
            {templates.map((announcement) => (
              <li
                key={announcement.id}
                className={`announcement ${announcement.active ? 'active' : ''} ${announcement.kind === 'record' ? 'announcement-record' : ''}`}
              >
                {toggle(announcement)}
                <span className="announcement-text">{announcementText(t, announcement, i18n.language)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="option-section">{t('announcements.custom')}</h3>
      <form className="announcement-add" onSubmit={add}>
        <input
          className="text-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('announcements.placeholder')}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
          {t('announcements.add')}
        </button>
      </form>

      {custom.length === 0 && <p className="muted">{t('announcements.empty')}</p>}
      <ul className="announcement-list">
        {custom.map((announcement) => (
          <li key={announcement.id} className={announcement.active ? 'announcement active' : 'announcement'}>
            {toggle(announcement)}
            <input
              className="text-input"
              value={announcement.text}
              onChange={(e) => update(announcement.id, { text: e.target.value })}
            />
            <button className="btn" onClick={() => remove(announcement.id)}>
              {t('announcements.delete')}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
