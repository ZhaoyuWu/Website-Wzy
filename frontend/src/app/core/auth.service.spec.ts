import { AuthService } from './auth.service';

describe('AuthService (logic)', () => {
  const storageKey = 'nanami_admin_session';
  let originalFetch: typeof fetch;

  beforeEach(() => {
    localStorage.clear();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it('returns false when no session exists', () => {
    const service = new AuthService();
    expect(service.isAuthenticated).toBe(false);
  });

  it('clears expired session and returns false', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        token: 'expired-token',
        username: 'admin',
        expiresAt: new Date(Date.now() - 60_000).toISOString()
      })
    );

    const service = new AuthService();
    expect(service.isAuthenticated).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('login stores token, username and expiresAt on success', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          token: 'token-1',
          username: 'admin',
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const service = new AuthService();
    await service.login('admin', 'admin123456');

    const raw = localStorage.getItem(storageKey);
    expect(raw).not.toBeNull();
    expect(service.isAuthenticated).toBe(true);
    expect(service.username).toBe('admin');
  });

  it('login throws backend message for failed authentication', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, message: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });

    const service = new AuthService();
    await expect(service.login('admin', 'wrong-password')).rejects.toThrow(
      'Invalid username or password'
    );
  });

  it('logout clears local session even when backend call fails', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        token: 'active-token',
        username: 'admin',
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

  it('register stores token, username and expiresAt on success', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          token: 'token-register-1',
          username: 'new-user',
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );

    const service = new AuthService();
    await service.register('new-user', 'new-user@example.com', 'superpass123');

    const raw = localStorage.getItem(storageKey);
    expect(raw).not.toBeNull();
    expect(service.isAuthenticated).toBe(true);
    expect(service.username).toBe('new-user');
  });

  it('register throws backend message when registration fails', async () => {
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
});
