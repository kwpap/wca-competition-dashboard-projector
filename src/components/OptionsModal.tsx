import type { TFunction } from 'i18next';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '../i18n';
import type { NoiseSensitivity, NoiseStatus, ProjectorSettings, TimeBarLabel, UiSettings } from '../state/storage';
import { Modal } from './Modal';

interface OptionsModalProps {
  ui: UiSettings;
  projector: ProjectorSettings;
  /** Live level from the projector's noise meter, or null when it is not running. */
  noise: NoiseStatus | null;
  onUiChange: (settings: UiSettings) => void;
  onProjectorChange: (settings: ProjectorSettings) => void;
  /** Creates the PDF reports. Resolves to a message that says where they went. */
  onPdfReports: () => Promise<string>;
  onClose: () => void;
}

const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

const TIME_BAR_LABELS: { value: TimeBarLabel; key: string }[] = [
  { value: 'left', key: 'timeBar.labelLeft' },
  { value: 'elapsed', key: 'timeBar.labelElapsed' },
  { value: 'none', key: 'timeBar.labelNone' },
];

const SENSITIVITIES: { value: NoiseSensitivity; key: string }[] = [
  { value: 'low', key: 'options.noiseLow' },
  { value: 'medium', key: 'options.noiseMedium' },
  { value: 'high', key: 'options.noiseHigh' },
];

/** A status older than this means the projector is closed or the meter stopped. */
const NOISE_STALE_MS = 5000;

interface ChoiceProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

function Choice<T extends string>({ value, options, onChange, disabled }: ChoiceProps<T>) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'btn btn-primary' : 'btn'}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LanguagePicker({ value, onChange }: { value: Language; onChange: (language: Language) => void }) {
  return (
    <div className="segmented">
      {LANGUAGE_CODES.map((code) => (
        <button
          key={code}
          className={value === code ? 'btn btn-primary' : 'btn'}
          lang={code}
          onClick={() => onChange(code)}
        >
          {LANGUAGES[code]}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function Stepper({ value, min, max, step = 1, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <button className="btn" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button className="btn" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

type ReportState = { kind: 'idle' } | { kind: 'working' } | { kind: 'done'; message: string } | { kind: 'failed'; message: string };

/** Runs the report generator and shows its progress and result. */
function PdfReportsButton({ onGenerate }: { onGenerate: () => Promise<string> }) {
  const { t } = useTranslation();
  const [state, setState] = useState<ReportState>({ kind: 'idle' });

  async function generate() {
    setState({ kind: 'working' });
    try {
      setState({ kind: 'done', message: await onGenerate() });
    } catch (error) {
      setState({ kind: 'failed', message: t('options.pdfFailed', { error: String(error) }) });
    }
  }

  return (
    <>
      <Row label={t('options.pdfHelp')}>
        <button className="btn btn-primary" onClick={generate} disabled={state.kind === 'working'}>
          {state.kind === 'working' ? t('options.pdfWorking') : t('options.pdfReports')}
        </button>
      </Row>
      {state.kind === 'done' && <p className="muted">{state.message}</p>}
      {state.kind === 'failed' && <p className="error">{state.message}</p>}
    </>
  );
}

function noiseText(t: TFunction, noise: NoiseStatus | null): string {
  if (!noise) return t('options.noiseWaiting');
  if (noise.blocked) return t('options.noiseBlocked');
  const level = Math.round(noise.level);
  if (noise.average === null) return t('options.noiseLearning', { level });
  return t('options.noiseLevel', { level, average: Math.round(noise.average) });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="option-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function OptionsModal({ ui, projector, noise, onUiChange, onProjectorChange, onPdfReports, onClose }: OptionsModalProps) {
  const { t } = useTranslation();
  const setProjector = (changes: Partial<ProjectorSettings>) => onProjectorChange({ ...projector, ...changes });
  const liveNoise = noise && Date.now() - noise.updatedAt < NOISE_STALE_MS ? noise : null;

  return (
    <Modal title={t('options.title')} onClose={onClose}>
      <Row label={t('options.controlLanguage')}>
        <LanguagePicker value={ui.language} onChange={(language) => onUiChange({ ...ui, language })} />
      </Row>
      <Row label={t('options.justMissedCount')}>
        <Stepper
          value={ui.justMissedCount}
          min={1}
          max={20}
          onChange={(justMissedCount) => onUiChange({ ...ui, justMissedCount })}
        />
      </Row>

      <h3 className="option-section">{t('options.projectorSection')}</h3>
      <Row label={t('options.projectorLanguage')}>
        <LanguagePicker value={projector.language} onChange={(language) => setProjector({ language })} />
      </Row>
      <Row label={t('options.bannerSeconds')}>
        <Stepper
          value={projector.bannerSeconds}
          min={3}
          max={60}
          onChange={(bannerSeconds) => setProjector({ bannerSeconds })}
        />
      </Row>
      <Row label={t('options.resultsSeconds')}>
        <Stepper
          value={projector.resultsPageSeconds}
          min={3}
          max={60}
          onChange={(resultsPageSeconds) => setProjector({ resultsPageSeconds })}
        />
      </Row>
      <Row label={t('options.callSeconds')}>
        <Stepper value={projector.callSeconds} min={2} max={20} onChange={(callSeconds) => setProjector({ callSeconds })} />
      </Row>
      <Row label={t('options.countdownMinutes')}>
        <Stepper
          value={projector.countdownMinutes}
          min={5}
          max={120}
          step={5}
          onChange={(countdownMinutes) => setProjector({ countdownMinutes })}
        />
      </Row>
      <Row label={t('options.festive')}>
        <button
          className={projector.festive ? 'btn btn-showing' : 'btn'}
          onClick={() => setProjector({ festive: !projector.festive })}
        >
          {projector.festive ? t('options.on') : t('options.off')}
        </button>
      </Row>

      <h3 className="option-section">{t('options.timeBarSection')}</h3>
      <Row label={t('timeBar.onProjector')}>
        <button
          className={projector.timeBar ? 'btn btn-showing' : 'btn'}
          onClick={() => setProjector({ timeBar: !projector.timeBar })}
        >
          {projector.timeBar ? t('timeBar.shown') : t('timeBar.hidden')}
        </button>
      </Row>
      <Row label={t('options.timeBarText')}>
        <Choice
          value={projector.timeBarLabel}
          options={TIME_BAR_LABELS.map((o) => ({ value: o.value, label: t(o.key) }))}
          onChange={(timeBarLabel) => setProjector({ timeBarLabel })}
          disabled={!projector.timeBar}
        />
      </Row>

      <h3 className="option-section">{t('options.noiseMeter')}</h3>
      <Row label={t('options.noiseListen')}>
        <button
          className={projector.noiseMeter ? 'btn btn-showing' : 'btn'}
          onClick={() => setProjector({ noiseMeter: !projector.noiseMeter })}
        >
          {projector.noiseMeter ? t('options.on') : t('options.off')}
        </button>
      </Row>
      <Row label={t('options.noiseSensitivity')}>
        <Choice
          value={projector.noiseSensitivity}
          options={SENSITIVITIES.map((o) => ({ value: o.value, label: t(o.key) }))}
          onChange={(noiseSensitivity) => setProjector({ noiseSensitivity })}
          disabled={!projector.noiseMeter}
        />
      </Row>
      {projector.noiseMeter && <p className="muted">{noiseText(t, liveNoise)}</p>}

      <h3 className="option-section">{t('options.reportsSection')}</h3>
      <PdfReportsButton onGenerate={onPdfReports} />
    </Modal>
  );
}
