import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getToken, startLogin } from '../api/auth';
import { WCA_CLIENT_ID } from '../config';
import { cachedCompetitions } from '../state/storage';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [publicId, setPublicId] = useState('');
  const cached = cachedCompetitions();

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

      {WCA_CLIENT_ID ? (
        <button className="btn btn-primary btn-xl" onClick={startLogin}>
          {t('login.button')}
        </button>
      ) : (
        <p className="error">{t('login.missingClientId')}</p>
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
