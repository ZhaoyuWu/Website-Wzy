import { AuthService } from './auth.service';

describe('AuthService (logic)', () => {
  const storageKey = 'nanami_supabase_session';
  let originalFetch: typeof fetch;
  let originalRuntimeConfig: Window['__NANAMI_APP_CONFIG__'];
  let originalApiBaseUrl: Window['API_BASE_URL'];
  let originalNanamiApiBaseUrl: string | undefined;

  beforeEach(() => {
    localStorage.clear();
    originalFetch = globalThis.fetch;
    originalRuntimeConfig = window.__NANAMI_APP_CONFIG__;
    originalApiBaseUrl = window.API_BASE_URL;
    originalNanamiApiBaseUrl = (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'] as
      | string
      | undefined;
    window.__NANAMI_APP_CONFIG__ = undefined;
    window.API_BASE_URL = undefined;
    delete (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    window.__NANAMI_APP_CONFIG__ = originalRuntimeConfig;
    window.API_BASE_URL = originalApiBaseUrl;
    if (originalNanamiApiBaseUrl) {
      (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'] = originalNanamiApiBaseUrl;
    } else {
      delete (window as unknown as Record<string, unknown>)['NANAMI_API_BASE_URL'];
    }
  });

  it('returns false when no session exists', () => {
    const service = new AuthService();
    expect(service.isAuthenticated).toBe(false);
  });

  it('clears expired session and returns false', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        tokenType: 'bearer',
        userId: 'user-1',
        email: 'admin@nanami.test',
        expiresAt: new Date(Date.now() - 60_000).toISOString()
      })
    );

    const service = new AuthService();
    expect(service.isAuthenticated).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('login stores supabase session on success', async () => {
    window.__NANAMI_APP_CONFIG__ = {
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'anon-key'
    };
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: 'token-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            email: 'admin@nanami.test',
            app_metadata: { role: 'Admin' }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const service = new AuthService();
    await service.login('admin@nanami.test', 'admin123456');

    const raw = localStorage.getItem(storageKey);
    expect(raw).not.toBeNull();
    expect(service.isAuthenticated).toBe(true);
    expect(service.username).toBe('admin@nanami.test');
    expect(service.userRole).toBe('Admin');
  });

  it('login throws backend message for failed authentication', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, message: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });

    window.__NANAMI_APP_CONFIG__ = {
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'anon-key'
    };
    const service = new AuthService();
    await expect(service.login('admin@nanami.test', 'wrong-password')).rejects.toThrow(
      'Invalid username or password'
    );
  });

  it('logout clears local session even when backend call fails', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        accessToken: 'active-token',
        refreshToken: 'refresh-token',
        tokenType: 'bearer',
        userId: 'user-1',
        email: 'admin@nanami.test',
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      })
    );

    globalThis.fetch = async () => {
      throw new Error('network down');
    };

    const service = new AuthService();
    await service.logout();
    expect(service.isAuthenticated).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('register stores supabase session on success', async () => {
    window.__NANAMI_APP_CONFIG__ = {
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'anon-key'
    };
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          access_token: 'token-register-1',
          refresh_token: 'refresh-register-1',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'user-2',
            email: 'new-user@example.com',
            app_metadata: { role: 'Viewer' }
          }
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );

    const service = new AuthService();
    await service.register('new-user', 'new-user@example.com', 'superpass123');

    const raw = localStorage.getItem(storageKey);
    expect(raw).not.toBeNull();
    expect(service.isAuthenticated).toBe(true);
    expect(service.username).toBe('new-user@example.com');
  });

  it('register throws backend message when registration fails', async () => {
    window.__NANAMI_APP_CONFIG__ = {
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'anon-key'
    };
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, message: 'Username or email already exists.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });

    const service = new AuthService();
    await expect(
      service.register('existing-user', 'existing@example.com', 'superpass123')
    ).rejects.toThrow('Username or email already exists.');
  });

  it('throws a clear message when supabase config is missing', async () => {
    const service = new AuthService();
    await expect(service.login('admin@nanami.test', 'password123')).rejects.toThrow(
      'Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY.'
    );
  });

  it('uses runtime API base URL when available', () => {
    window.__NANAMI_APP_CONFIG__ = { apiBaseUrl: 'https://api.nanami.test/' };

    const service = new AuthService();
    expect(service.apiUrl('/api/health')).toBe('https://api.nanami.test/api/health');
  });
});
