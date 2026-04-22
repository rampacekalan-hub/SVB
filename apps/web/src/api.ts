const TOKEN_KEY = 'domovplus.accessToken';
const REFRESH_KEY = 'domovplus.refreshToken';

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Strukturovaná API chyba — obsahuje HTTP status + clean message + prípadne
 * originálny backend error code (Conflict, BadRequest, Forbidden, …).
 *
 * Frontend používa `err.message` pre zobrazenie — vždy už je to SK friendly
 * text (nie raw JSON). `err.status` použiteľné pre špeciálne UX (napr. 409
 * pre email konflikt v aktivácii).
 */
export class ApiError extends Error {
  status: number;
  code?: string; // napr. "Conflict", "BadRequest", "ValidationError"
  raw?: unknown;

  constructor(status: number, message: string, code?: string, raw?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.raw = raw;
  }
}

/** Bezpečne vytiahne user-friendly message z NestJS / HTTP chybovej odpovede. */
function extractError(status: number, statusText: string, body: string): ApiError {
  // Network-level / 5xx môže vrátiť HTML — fallback na statusText.
  if (!body || body.trim().startsWith('<')) {
    return new ApiError(status, friendlyStatus(status, statusText));
  }
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new ApiError(status, body.length < 200 ? body : friendlyStatus(status, statusText));
  }
  // class-validator vracia `message: string[]` → spojíme
  let msg: string;
  if (Array.isArray(parsed.message)) msg = parsed.message.join(' · ');
  else if (typeof parsed.message === 'string') msg = parsed.message;
  else msg = friendlyStatus(status, statusText);
  return new ApiError(status, msg, parsed.error, parsed);
}

function friendlyStatus(status: number, statusText: string): string {
  switch (status) {
    case 400: return 'Neplatné údaje vo formulári.';
    case 401: return 'Prihlásenie sa skončilo alebo ste neprihlásený. Prihláste sa znova.';
    case 403: return 'Na túto akciu nemáte oprávnenie.';
    case 404: return 'Požadovaný záznam neexistuje.';
    case 409: return 'Konflikt — záznam už existuje alebo je v nesprávnom stave.';
    case 429: return 'Príliš veľa pokusov, skúste o chvíľu.';
    case 500: return 'Chyba servera. Skúste znova, alebo nám napíšte.';
    default: return statusText || `HTTP ${status}`;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw extractError(res.status, res.statusText, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiUpload<T = unknown>(
  path: string,
  file: File,
  fieldName = 'file',
): Promise<T> {
  const token = getAccessToken();
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    body: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw extractError(res.status, res.statusText, body);
  }
  return (await res.json()) as T;
}
