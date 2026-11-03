import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getClientId, getToken, isClientIdBuiltIn, redirectUri, setClientId, startLogin } from '../api/auth';
import { cachedCompetitions } from '../state/storage';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [publicId, setPublicId] = useState('');
  const cached = cachedCompetitions();
  const [clientId, setClientIdState] = useState(getClientId);
  const [clientIdInput, setClientIdInput] = useState('');

  function saveClientId(value: string) {
    setClientId(value);
    setClientIdState(getClientId());
    setClientIdInput('');
  }

  function submitClientId(event: FormEvent) {
    event.preventDefault();
    if (clientIdInput.trim()) saveClientId(clientIdInput.trim());
  }

  useEffect(() => {
    if (getToken()) navigate('/competitions', { replace: true });
  }, [navigate]);

  function openPublic(event: FormEvent) {
    event.preventDefault();
    if (publicId.trim()) navigate(`/open/${encodeURIComponent(publicId.trim())}`);
  }

  return (
    <main className="page center">
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('login.intro')}</p>

      {clientId ? (
        <>
          <button className="btn btn-primary btn-xl" onClick={startLogin}>
            {t('login.button')}
          </button>
          {!isClientIdBuiltIn() && (
            <button className="btn" onClick={() => saveClientId('')}>
              {t('login.clientIdChange')}
            </button>
          )}
        </>
      ) : (
        <form className="public-form" onSubmit={submitClientId}>
          <label className="muted" htmlFor="client-id">
            {t('login.missingClientId')}
          </label>
          <div className="row">
            <input
              id="client-id"
              className="text-input"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn" type="submit" disabled={!clientIdInput.trim()}>
              {t('login.clientIdSave')}
            </button>
          </div>
          <p className="muted">{t('login.clientIdHint', { uri: redirectUri() })}</p>
        </form>
      )}

      <form className="public-form" onSubmit={openPublic}>
        <label className="muted" htmlFor="public-id">
          {t('login.publicLabel')}
        </label>
        <div className="row">
          <input
            id="public-id"
            className="text-input"
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            placeholder="SalonicaAutumnOpen2026"
          />
          <button className="btn" type="submit" disabled={!publicId.trim()}>
            {t('login.publicOpen')}
          </button>
        </div>
      </form>

      {cached.length > 0 && (
        <section className="offline-list">
          <h2>{t('login.offline')}</h2>
          {cached.map((competition) => (
            <button
              key={competition.id}
              className="btn btn-block"
              onClick={() => navigate(`/control/${encodeURIComponent(competition.id)}`)}
            >
              {competition.name}
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
