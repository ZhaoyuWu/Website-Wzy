import { resolveApiBaseUrl, resolveSupabaseAnonKey, resolveSupabaseUrl } from './runtime-config';

describe('runtime-config', () => {
  const defaultBase = 'http://localhost:4000';
  let originalWindowApiBase: unknown;
  let originalWindowNanamiApiBase: unknown;
  let originalWindowSupabaseUrl: unknown;
  let originalWindowSupabaseAnonKey: unknown;
  let originalWindowConfig: unknown;

  beforeEach(() => {
    originalWindowApiBase = (window as unknown as Record<string, unknown>)['API_BASE_URL'];
    originalWindowNanamiApiBase = (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
    originalWindowSupabaseUrl = (window as unknown as Record<string, unknown>)['SUPABASE_URL'];
    originalWindowSupabaseAnonKey = (window as unknown as Record<string, unknown>)['SUPABASE_ANON_KEY'];
    originalWindowConfig = (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'];
    delete (window as unknown as Record<string, unknown>)['API_BASE_URL'];
    delete (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
    delete (window as unknown as Record<string, unknown>)['SUPABASE_URL'];
    delete (window as unknown as Record<string, unknown>)['SUPABASE_ANON_KEY'];
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

    if (originalWindowSupabaseUrl !== undefined) {
      (window as unknown as Record<string, unknown>)['SUPABASE_URL'] = originalWindowSupabaseUrl;
    } else {
      delete (window as unknown as Record<string, unknown>)['SUPABASE_URL'];
    }

    if (originalWindowSupabaseAnonKey !== undefined) {
      (window as unknown as Record<string, unknown>)['SUPABASE_ANON_KEY'] = originalWindowSupabaseAnonKey;
    } else {
      delete (window as unknown as Record<string, unknown>)['SUPABASE_ANON_KEY'];
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

  it('resolves supabase config from runtime app config first', () => {
    (window as unknown as Record<string, unknown>)['__NANAMI_APP_CONFIG__'] = {
      supabaseUrl: 'https://demo.supabase.co///',
      supabaseAnonKey: 'runtime-anon-key'
    };
    expect(resolveSupabaseUrl()).toBe('https://demo.supabase.co');
    expect(resolveSupabaseAnonKey()).toBe('runtime-anon-key');
  });

  it('falls back to window and localStorage values for supabase config', () => {
    (window as unknown as Record<string, unknown>)['SUPABASE_URL'] = 'https://fallback.supabase.co/';
    (window as unknown as Record<string, unknown>)['SUPABASE_ANON_KEY'] = 'fallback-anon-key';
    expect(resolveSupabaseUrl()).toBe('https://fallback.supabase.co');
    expect(resolveSupabaseAnonKey()).toBe('fallback-anon-key');

    delete (window as unknown as Record<string, unknown>)['SUPABASE_URL'];
    delete (window as unknown as Record<string, unknown>)['SUPABASE_ANON_KEY'];
    localStorage.setItem('SUPABASE_URL', 'https://storage.supabase.co/');
    localStorage.setItem('SUPABASE_ANON_KEY', 'storage-anon-key');
    expect(resolveSupabaseUrl()).toBe('https://storage.supabase.co');
    expect(resolveSupabaseAnonKey()).toBe('storage-anon-key');
  });

  it('returns empty supabase config when no runtime value exists', () => {
    expect(resolveSupabaseUrl()).toBe('');
    expect(resolveSupabaseAnonKey()).toBe('');
  });
});
