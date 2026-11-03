import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPublicWcif, getRecords } from '../api/wca';
import { saveCompetition } from '../state/storage';

/** Loads a competition from the public WCIF, without login, and opens the control screen. */
export default function OpenPublic() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { competitionId = '' } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPublicWcif(competitionId), getRecords()])
      .then(([wcif, records]) => {
        saveCompetition(wcif, records);
        navigate(`/control/${encodeURIComponent(wcif.id)}`, { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [competitionId, navigate]);

  return (
    <main className="page center">
      {error ? (
        <>
          <p className="error">{error}</p>
          <Link className="btn" to="/">
            {t('common.back')}
          </Link>
        </>
      ) : (
        <p>{t('common.loading')}</p>
      )}
    </main>
  );
}
