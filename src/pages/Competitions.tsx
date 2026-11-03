import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import {
  AuthError,
  getManagedCompetitions,
  getMe,
  getRecords,
  getWcif,
  type CompetitionSummary,
  type Me,
} from '../api/wca';
import { saveCompetition } from '../state/storage';

export default function Competitions() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  function handleError(err: unknown) {
    if (err instanceof AuthError) {
      logout();
      navigate('/', { replace: true });
      return;
    }
    setError(err instanceof Error ? err.message : String(err));
  }

  useEffect(() => {
    Promise.all([getMe(), getManagedCompetitions()])
      .then(([user, list]) => {
        setMe(user);
        setCompetitions(list);
      })
      .catch(handleError);
  }, []);

  async function open(competitionId: string) {
    setOpeningId(competitionId);
    setError(null);
    try {
      const [wcif, records] = await Promise.all([getWcif(competitionId), getRecords()]);
      saveCompetition(wcif, records);
      navigate(`/control/${encodeURIComponent(competitionId)}`);
    } catch (err) {
      handleError(err);
    } finally {
      setOpeningId(null);
    }
  }

  function signOut() {
    logout();
    navigate('/', { replace: true });
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="page">
      <header className="page-header">
        <h1>{t('competitions.title')}</h1>
        <div className="row">
          {me && <span className="muted">{me.name}</span>}
          <button className="btn" onClick={signOut}>
            {t('competitions.logout')}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {!competitions && !error && <p>{t('common.loading')}</p>}
      {competitions?.length === 0 && <p className="muted">{t('competitions.none')}</p>}

      <div className="competition-grid">
        {competitions?.map((competition) => (
          <button
            key={competition.id}
            className="competition-card"
            onClick={() => open(competition.id)}
            disabled={openingId !== null}
          >
            <span className="competition-name">{competition.name}</span>
            <span className="muted">
              {dateFormat.formatRange(new Date(competition.startDate), new Date(competition.endDate))} ·{' '}
              {competition.city}
            </span>
            {openingId === competition.id && <span>{t('common.loading')}</span>}
          </button>
        ))}
      </div>
    </main>
  );
}
