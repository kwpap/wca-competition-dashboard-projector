import { WCA_CLIENT_ID, WCA_ORIGIN } from '../config';

const TOKEN_KEY = 'wca-token';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Sends the browser to the WCA login page (OAuth implicit grant). */
export function startLogin(): void {
  const params = new URLSearchParams({
    client_id: WCA_CLIENT_ID,
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
