import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../components/Modal';
import { formatClock } from '../format/time';
import type { CompetitionModel } from '../model/competition';
import { buildCandidates, searchCandidates, type MentionCandidate } from './mentions';
import type { Incident, IncidentRef } from './types';

interface IncidentEditorProps {
  model: CompetitionModel;
  /** Null for a new incident. */
  incident: Incident | null;
  /** The slot running now, attached to new incidents. */
  context: { slotId: number | null; slotLabel: string | null };
  onSave: (incident: Incident) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

interface MentionState {
  start: number;
  end: number;
  query: string;
}

const MENTION_PATTERN = /@([^@\n]{0,40})$/;

function uniqueRefs(refs: IncidentRef[]): IncidentRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.label)) return false;
    seen.add(ref.label);
    return true;
  });
}

export function IncidentEditor({ model, incident, context, onSave, onDelete, onClose }: IncidentEditorProps) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState(incident?.text ?? '');
  const [refs, setRefs] = useState<IncidentRef[]>(incident?.refs ?? []);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const candidates = useMemo(() => buildCandidates(t, model), [t, model]);
  const matches = mention ? searchCandidates(candidates, mention.query) : [];

  const [createdAt] = useState(() => incident?.createdAt ?? Date.now());
  const slotLabel = incident ? incident.slotLabel : context.slotLabel;

  function updateMention(value: string, caret: number) {
    const match = value.slice(0, caret).match(MENTION_PATTERN);
    setMention(match ? { start: caret - match[0].length, end: caret, query: match[1] } : null);
    setHighlight(0);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value);
    updateMention(event.target.value, event.target.selectionStart);
  }

  function insertMention(candidate: MentionCandidate) {
    if (!mention) return;
    const inserted = `${candidate.ref.label} `;
    setText(text.slice(0, mention.start) + inserted + text.slice(mention.end));
    setRefs((list) => [...list, candidate.ref]);
    setMention(null);
    pendingCaret.current = mention.start + inserted.length;
  }

  // Place the caret right after an inserted mention, before the next keystroke arrives.
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null || !textareaRef.current) return;
    pendingCaret.current = null;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(caret, caret);
  }, [text]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || matches.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertMention(matches[highlight]);
    } else if (event.key === 'Escape') {
      setMention(null);
    }
  }

  function save() {
    const now = Date.now();
    onSave({
      id: incident?.id ?? crypto.randomUUID(),
      createdAt,
      updatedAt: now,
      slotId: incident ? incident.slotId : context.slotId,
      slotLabel,
      text,
      // References removed from the text are dropped.
      refs: uniqueRefs(refs.filter((ref) => text.includes(ref.label))),
    });
  }

  const actions = (
    <>
      {incident && (
        <button
          className={confirmDelete ? 'btn btn-danger' : 'btn'}
          onClick={() => (confirmDelete ? onDelete(incident.id) : setConfirmDelete(true))}
        >
          {confirmDelete ? t('incidents.confirmDelete') : t('incidents.delete')}
        </button>
      )}
      <button className="btn btn-primary" onClick={save} disabled={!text.trim()}>
        {t('common.save')}
      </button>
    </>
  );

  return (
    <Modal title={incident ? t('incidents.edit') : t('incidents.new')} onClose={onClose} actions={actions}>
      <p className="muted">
        {t('incidents.createdAt', { time: formatClock(createdAt, model.timezone, i18n.language) })}
        {slotLabel && ` · ${slotLabel}`}
      </p>
      <textarea
        ref={textareaRef}
        className="incident-text"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(event) => updateMention(text, event.currentTarget.selectionStart)}
        placeholder={t('incidents.placeholder')}
        autoFocus
      />
      {matches.length > 0 && (
        <ul className="mention-list">
          {matches.map((candidate, index) => (
            <li key={`${candidate.ref.type}-${candidate.ref.label}`}>
              <button
                className={index === highlight ? 'mention active' : 'mention'}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => insertMention(candidate)}
              >
                <span className="mention-kind">
                  {candidate.ref.type === 'person' ? t('incidents.kindPerson') : t('incidents.kindActivity')}
                </span>
                {candidate.ref.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
