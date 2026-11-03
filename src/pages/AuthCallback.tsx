import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { handleCallback } from '../api/auth';

export default function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (handleCallback(window.location.hash)) navigate('/competitions', { replace: true });
    else setFailed(true);
  }, [navigate]);

  return (
    <main className="page center">
      {failed ? (
        <>
          <p className="error">{t('login.failed')}</p>
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
