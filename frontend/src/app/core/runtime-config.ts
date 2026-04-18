type RuntimeAppConfig = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

declare global {
  interface Window {
    __NANAMI_APP_CONFIG__?: RuntimeAppConfig;
    API_BASE_URL?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
  }
}

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

function readWindowString(key: string): string {
  const runtimeWindow = window as unknown as Record<string, unknown>;
  const value = runtimeWindow[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveApiBaseUrl(): string {
  const appConfig = window.__NANAMI_APP_CONFIG__ ?? {};
  const configuredApiBase =
    String(appConfig.apiBaseUrl || '').trim() ||
    readWindowString('API_BASE_URL') ||
    readWindowString('NANAMI_API_BASE_URL');

  if (configuredApiBase) {
    return configuredApiBase.replace(/\/+$/, '');
  }

  try {
    const localStorageBase = String(localStorage.getItem('API_BASE_URL') || '').trim();
    if (localStorageBase) {
      return localStorageBase.replace(/\/+$/, '');
    }
  } catch {
    // Ignore browser storage read errors and fallback to local default.
  }

  return DEFAULT_API_BASE_URL;
}

function readSupabaseConfig(key: 'supabaseUrl' | 'supabaseAnonKey', ...windowKeys: string[]): string {
  const appConfig = window.__NANAMI_APP_CONFIG__ ?? {};
  const runtimeValue = String(appConfig[key] || '').trim();
  if (runtimeValue) {
    return runtimeValue;
  }

  for (const windowKey of windowKeys) {
    const value = readWindowString(windowKey);
    if (value) {
      return value;
    }
  }

  try {
    for (const windowKey of windowKeys) {
      const value = String(localStorage.getItem(windowKey) || '').trim();
      if (value) {
        return value;
      }
    }
  } catch {
    // Ignore storage read errors and use empty fallback.
  }

  return '';
}

export function resolveSupabaseUrl(): string {
  const value = readSupabaseConfig('supabaseUrl', 'SUPABASE_URL', 'NANAMI_SUPABASE_URL');
  return value.replace(/\/+$/, '');
}

export function resolveSupabaseAnonKey(): string {
  return readSupabaseConfig('supabaseAnonKey', 'SUPABASE_ANON_KEY', 'NANAMI_SUPABASE_ANON_KEY');
}
