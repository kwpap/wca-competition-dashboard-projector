import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n, { savedLanguage } from './i18n';
import { connectToServer } from './state/server';
import { isAppKey } from './state/storage';
import '@cubing/icons';
import './styles.css';

await connectToServer(isAppKey);
// The data folder may hold a language that this browser profile does not know yet.
await i18n.changeLanguage(savedLanguage());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
