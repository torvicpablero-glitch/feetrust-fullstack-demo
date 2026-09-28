import { getSavedToken } from './auth';

/**
 * JSON headers with the caller's bearer token attached when available.
 * Use on every mutating API call so the server can enforce ownership.
 */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
  try {
    const token = getSavedToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // ignore
  }
  return headers;
}
