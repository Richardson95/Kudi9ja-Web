/** Where the API lives. Relative in development (the dev server proxies it). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

/** How the server labels this session in the customer's list of devices. */
export const DEVICE_LABEL = 'Kudi9ja web';

export const APP_NAME = 'Kudi9ja';
export const TAGLINE = 'Easy money.';
export const APP_VERSION = '1.0.0';

/** Code lengths are fixed: every stored code is a hash of a code this long. */
export const PASSCODE_LENGTH = 6;
export const PIN_LENGTH = 4;

/**
 * Turns a link the server hands back into one the browser can fetch.
 * Receipt and document links arrive root-relative (`/api/v1/admin/...`)
 * because the server does not know what hostname it is reached on.
 */
export function absoluteUrl(url: string): string {
  if (!url) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const base = API_BASE_URL.startsWith('http') ? new URL(API_BASE_URL).origin : window.location.origin;
  return new URL(url, base).toString();
}
