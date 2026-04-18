import { resolveApiBaseUrl } from './runtime-config';

describe('runtime-config', () => {
  const defaultBase = 'http://localhost:4000';
  let originalWindowApiBase: unknown;
  let originalWindowNanamiApiBase: unknown;
  let originalWindowConfig: unknown;

  beforeEach(() => {
    originalWindowApiBase = (window as unknown as Record<string, unknown>)['API_BASE_URL'];
    originalWindowNanamiApiBase = (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
    originalWindowConfig = (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'];
    delete (window as unknown as Record<string, unknown>)['API_BASE_URL'];
    delete (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
    delete (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'];
    localStorage.clear();
  });

  afterEach(() => {
    if (originalWindowApiBase !== undefined) {
      (window as unknown as Record<string, unknown>)['API_BASE_URL'] = originalWindowApiBase;
    } else {
      delete (window as unknown as Record<string, unknown>)['API_BASE_URL'];
    }

    if (originalWindowNanamiApiBase !== undefined) {
      (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'] = originalWindowNanamiApiBase;
    } else {
      delete (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
    }

    if (originalWindowConfig !== undefined) {
      (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'] = originalWindowConfig;
    } else {
      delete (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'];
    }
    localStorage.clear();
  });

  it('uses __NANAMI_APP_CONFIG__.apiBaseUrl first', () => {
    (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'] = {
      apiBaseUrl: 'https://api.nanami.test///'
    };
    expect(resolveApiBaseUrl()).toBe('https://api.nanami.test');
  });

  it('falls back to API_BASE_URL and then localStorage', () => {
    (window as unknown as Record<string, unknown>)['API_BASE_URL'] = 'https://env-api.test/';
    expect(resolveApiBaseUrl()).toBe('https://env-api.test');

    delete (window as unknown as Record<string, unknown>)['API_BASE_URL'];
    localStorage.setItem('API_BASE_URL', 'https://storage-api.test/');
    expect(resolveApiBaseUrl()).toBe('https://storage-api.test');
  });

  it('returns localhost default when no runtime override exists', () => {
    expect(resolveApiBaseUrl()).toBe(defaultBase);
  });
});
