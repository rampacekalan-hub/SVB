import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const ACCESS_KEY = 'domovplus.access';
const REFRESH_KEY = 'domovplus.refresh';
const DEVICE_KEY = 'domovplus.deviceId';

/**
 * Stabilný identifikátor zariadenia pre anti-replay pri hlasovaní.
 * Generuje sa raz pri prvom spustení a drží sa v SecureStore (keychain/keystore).
 * Nikdy sa neposiela v tejto forme — iba sa primiešava do hashu session fingerprintu.
 */
export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id) {
    const bytes = new Uint8Array(16);
    (globalThis.crypto ?? require('expo-crypto')).getRandomValues(bytes);
    id = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(DEVICE_KEY, id);
  }
  return id;
}

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:3100/api';

export async function storeTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

const BIOMETRIC_CREDENTIALS_KEY = 'domovplus.bioCreds';

/** Uloží email+heslo za biometric zámkom (iOS keychain / Android keystore). */
export async function storeBiometricCredentials(email: string, password: string) {
  await SecureStore.setItemAsync(
    BIOMETRIC_CREDENTIALS_KEY,
    JSON.stringify({ email, password }),
    { requireAuthentication: true, authenticationPrompt: 'Odomknúť DomovPlus' } as any,
  );
}

export async function readBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Prihlásiť sa do DomovPlus',
    } as any);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials() {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
