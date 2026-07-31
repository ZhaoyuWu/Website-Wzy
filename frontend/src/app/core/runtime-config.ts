interface RuntimeAppConfig {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

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

  // Intentionally no localStorage fallback: a writable persistent override
  // would let a one-time XSS or shared-device tamper redirect every API call
  // (including auth headers) to an attacker-controlled host.
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

  // Intentionally no localStorage fallback (see resolveApiBaseUrl).
  return '';
}

export function resolveSupabaseUrl(): string {
  const value = readSupabaseConfig('supabaseUrl', 'SUPABASE_URL', 'NANAMI_SUPABASE_URL');
  return value.replace(/\/+$/, '');
}

export function resolveSupabaseAnonKey(): string {
  return readSupabaseConfig('supabaseAnonKey', 'SUPABASE_ANON_KEY', 'NANAMI_SUPABASE_ANON_KEY');
}
