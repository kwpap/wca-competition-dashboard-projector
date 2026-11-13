import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { QrCode } from './QrCode';

/** How often the wizard checks which TV screens are connected. */
const REFRESH_MS = 2000;

interface NetworkAddress {
  name: string;
  address: string;
  virtual: boolean;
}

interface NetworkInfo {
  lan: boolean;
  port: number;
  addresses: NetworkAddress[];
  screens: { address: string; competitionId: string; seenAt: number }[];
  platform: string;
}

interface ScreensWizardProps {
  competitionId: string;
  onClose: () => void;
}

/** Step-by-step help to show the projector on a smart TV or phone on the same Wi-Fi. */
export function ScreensWizard({ competitionId, onClose }: ScreensWizardProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const response = await fetch('/api/network', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = (await response.json()) as NetworkInfo;
        if (!stopped) {
          setInfo(next);
          setFailed(false);
        }
      } catch {
        if (!stopped) setFailed(true);
      }
    }
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Modal title={t('screens.title')} onClose={onClose} wide>
      <p>{t('screens.intro')}</p>
      {failed && !info && <p className="error">{t('screens.noServer')}</p>}
      {!failed && !info && <p>{t('common.loading')}</p>}
      {info && <WizardSteps info={info} competitionId={competitionId} />}
    </Modal>
  );
}

function WizardSteps({ info, competitionId }: { info: NetworkInfo; competitionId: string }) {
  const { t } = useTranslation();

  if (!info.lan) return <p className="error">{t('screens.lanOff')}</p>;
  if (info.addresses.length === 0) return <p className="error">{t('screens.noNetwork')}</p>;

  const [main, ...others] = info.addresses;
  const shortAddress = `${main.address}:${info.port}`;
  const projectorUrl = `http://${shortAddress}/projector/${encodeURIComponent(competitionId)}`;

  return (
    <div className="screens-wizard">
      <ol className="screens-steps">
        <li>{t('screens.step1')}</li>
        <li>
          {t('screens.step2')}
          <div className="screens-address">{shortAddress}</div>
          <div className="muted">{t('screens.step2Pick')}</div>
          <div className="muted">{t('screens.browserHint')}</div>
        </li>
        <li>
          {t('screens.step3')}
          <ScreenList info={info} competitionId={competitionId} />
        </li>
      </ol>

      <div className="screens-side">
        <QrCode text={projectorUrl} />
        <div className="muted">{t('screens.qr')}</div>
        <div className="muted">{t('screens.direct')}</div>
        <code className="screens-url">{projectorUrl}</code>
      </div>

      {others.length > 0 && (
        <div className="screens-others">
          <p>{t('screens.otherAddresses')}</p>
          <ul>
            {others.map((address) => (
              <li key={address.address}>
                <code>
                  {address.address}:{info.port}
                </code>{' '}
                <span className="muted">
                  ({address.name}
                  {address.virtual ? `, ${t('screens.virtual')}` : ''})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="muted screens-notes">{t('screens.notes')}</p>

      <details className="screens-help">
        <summary>{t('screens.helpTitle')}</summary>
        <ul>
          <li>{t('screens.helpPhone')}</li>
          {info.platform === 'win32' && <li>{t('screens.helpFirewallWindows')}</li>}
          {info.platform === 'win32' && <li>{t('screens.helpNetworkProfile')}</li>}
          {info.platform === 'linux' && <li>{t('screens.helpFirewallLinux', { port: info.port })}</li>}
          <li>{t('screens.helpIsolation')}</li>
          <li>{t('screens.helpHttp')}</li>
          <li>{t('screens.helpOldTv')}</li>
          <li>{t('screens.helpTvSleep')}</li>
          <li>{t('screens.helpPcSleep')}</li>
          <li>{t('screens.helpAddressChanged')}</li>
        </ul>
      </details>
    </div>
  );
}

function ScreenList({ info, competitionId }: { info: NetworkInfo; competitionId: string }) {
  const { t } = useTranslation();
  if (info.screens.length === 0) return <div className="screens-status waiting">{t('screens.waiting')}</div>;
  return (
    <div className="screens-status connected">
      <strong>{t('screens.connectedCount', { count: info.screens.length })}</strong>
      <ul>
        {info.screens.map((screen) => (
          <li key={screen.address}>
            {screen.address}
            {screen.competitionId !== competitionId && (
              <span className="muted"> · {t('screens.otherCompetition', { id: screen.competitionId })}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
