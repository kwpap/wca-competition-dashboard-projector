import { WCA_CLIENT_ID, WCA_ORIGIN } from '../config';

const TOKEN_KEY = 'wca-token';
// Client ID typed in on the login page. Lets a downloaded build use the user's own WCA application.
const CLIENT_ID_KEY = 'wca-client-id';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

export function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

/** True when the client ID comes from the build (.env.local), so the user cannot change it. */
export function isClientIdBuiltIn(): boolean {
  return WCA_CLIENT_ID !== '';
}

/** The OAuth client ID: from the build, else the one the user typed in. Empty when there is none. */
export function getClientId(): string {
  if (isClientIdBuiltIn()) return WCA_CLIENT_ID;
  return localStorage.getItem(CLIENT_ID_KEY) ?? '';
}

/** Saves the user's own client ID. An empty value removes it. */
export function setClientId(clientId: string): void {
  if (clientId) {
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  } else {
    localStorage.removeItem(CLIENT_ID_KEY);
  }
}

/** Sends the browser to the WCA login page (OAuth implicit grant). */
export function startLogin(): void {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: 'public manage_competitions',
  });
  window.location.href = `${WCA_ORIGIN}/oauth/authorize?${params}`;
}

/** Stores the token from the callback URL hash. Returns false when the hash has no token. */
export function handleCallback(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  if (!accessToken) return false;

  const expiresIn = Number(params.get('expires_in') || 7200);
  const token: StoredToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return true;
}

export function getToken(): string | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const token = JSON.parse(raw) as StoredToken;
  if (token.expiresAt < Date.now()) return null;
  return token.accessToken;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}
