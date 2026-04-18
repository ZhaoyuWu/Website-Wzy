type RuntimeAppConfig = {
  apiBaseUrl?: string;
};

declare global {
  interface Window {
    __NANAMI_APP_CONFIG__?: RuntimeAppConfig;
    API_BASE_URL?: string;
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

