import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ScreenApp from './pages/ScreenApp';
import i18n, { savedLanguage } from './i18n';
import { detectScreenMode } from './state/screenSync';
import { connectToServer } from './state/server';
import { isAppKey } from './state/storage';
import '@cubing/icons';
import './styles.css';

/** Startup steps. No top-level await: old smart TV browsers cannot parse it. */
async function start() {
  // A TV on the network only shows the projector. It reads state from the server and never writes.
  const screenMode = await detectScreenMode();
  if (!screenMode) {
    await connectToServer(isAppKey);
    // The data folder may hold a language that this browser profile does not know yet.
    await i18n.changeLanguage(savedLanguage());
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>{screenMode ? <ScreenApp /> : <App />}</StrictMode>,
  );
}

void start();
