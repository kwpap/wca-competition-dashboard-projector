import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { LANGUAGES } from '../i18n';
import { fetchScreenList, startScreenSync, type ScreenList } from '../state/screenSync';
import Projector from './Projector';

/** Show "reconnecting" only after this long, so one slow answer does not flash it. */
const OFFLINE_AFTER_MS = 6000;

/** The app on a TV or phone on the network: a start page and the projector, nothing else. */
export default function ScreenApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/projector/:competitionId" element={<ScreenProjector />} />
        <Route path="*" element={<ScreenStart />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Lists the saved competitions, so a TV user only has to type the short address.
 * With one competition it opens the projector directly: every click on a TV remote is slow.
 */
function ScreenStart() {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState<ScreenList | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchScreenList()
      .then((result) => {
        if (result.language && result.language in LANGUAGES) void i18n.changeLanguage(result.language);
        setList(result);
      })
      .catch(() => setError(true));
  }, [i18n]);

  if (list?.competitions.length === 1) {
    return <Navigate to={`/projector/${encodeURIComponent(list.competitions[0].id)}`} replace />;
  }

  return (
    <main className="page screen-start">
      <h1>{t('screens.startTitle')}</h1>
      {error && <p className="error">{t('screens.startError')}</p>}
      {!list && !error && <p>{t('common.loading')}</p>}
      {list?.competitions.length === 0 && <p className="muted">{t('screens.startNone')}</p>}
      <div className="competition-grid">
        {list?.competitions.map((competition) => (
          <Link
            key={competition.id}
            className="competition-card"
            to={`/projector/${encodeURIComponent(competition.id)}`}
          >
            <span className="competition-name">{competition.name}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

/** The projector, fed from the server. Waits for the first answer, then follows the control screen. */
function ScreenProjector() {
  const { t } = useTranslation();
  const { competitionId = '' } = useParams();
  const [loaded, setLoaded] = useState(false);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return startScreenSync(competitionId, (ok) => {
      if (ok) {
        setLoaded(true);
        setLastOkAt(Date.now());
        setOffline(false);
      } else {
        setOffline(true);
      }
    });
  }, [competitionId]);

  // A failed fetch can be a blip. Show the badge only when answers stay away.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const showOffline = offline && (lastOkAt === null || now - lastOkAt > OFFLINE_AFTER_MS);

  if (!loaded) {
    return (
      <main className="projector projector-empty">
        <p>{showOffline ? t('screens.cannotReach') : t('common.loading')}</p>
      </main>
    );
  }

  return (
    <>
      <Projector />
      {showOffline && <div className="screen-offline">{t('screens.reconnecting')}</div>}
    </>
  );
}
