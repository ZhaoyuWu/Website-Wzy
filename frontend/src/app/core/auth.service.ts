import { Injectable } from '@angular/core';
import { resolveApiBaseUrl, resolveSupabaseAnonKey, resolveSupabaseUrl } from './runtime-config';

type SessionSnapshot = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: string;
  email: string;
  role: string;
  expiresAt: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBaseUrl = resolveApiBaseUrl();
  private readonly supabaseUrl = resolveSupabaseUrl();
  private readonly supabaseAnonKey = resolveSupabaseAnonKey();
  private readonly storageKey = 'nanami_supabase_session';

  loginPayload: SessionSnapshot | null = null;

  constructor() {
    this.loginPayload = this.readSession();
    if (this.loginPayload && this.isExpired(this.loginPayload.expiresAt)) {
      this.clearSession();
    }
  }

  get isAuthenticated(): boolean {
    const session = this.readSession();
    if (!session) {
      return false;
    }

    if (this.isExpired(session.expiresAt)) {
      this.clearSession();
      return false;
    }

    return true;
  }

  get username(): string | null {
    return this.readSession()?.email ?? null;
  }

  get userRole(): string {
    return this.readSession()?.role ?? 'Viewer';
  }

  get isAdmin(): boolean {
    return this.userRole === 'Admin';
  }

  get isPublisherOrAdmin(): boolean {
    const role = this.userRole;
    return role === 'Admin' || role === 'Publisher';
  }

  async login(email: string, password: string): Promise<void> {
    this.ensureSupabaseAuthConfig();
    const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const message =
        typeof payload['message'] === 'string'
          ? payload['message']
          : 'Login failed. Please check your credentials.';
      throw new Error(message);
    }

    const session = this.parseSupabaseSession(payload);
    this.writeSession(session);
    await this.refreshRoleFromBackend();
  }

  async register(username: string, email: string, password: string): Promise<void> {
    this.ensureSupabaseAuthConfig();
    const response = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseAnonKey
      },
      body: JSON.stringify({
        email,
        password,
        data: { username }
      })
    });

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const message =
        typeof payload['message'] === 'string'
          ? payload['message']
          : 'Registration failed. Please try again.';
      throw new Error(message);
    }

    this.writeSession(this.parseSupabaseSession(payload));
  }

  async logout(): Promise<void> {
    const accessToken = this.getToken();
    if (accessToken && this.supabaseUrl && this.supabaseAnonKey) {
      try {
        await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`
          }
        });
      } catch {
        // Ignore API errors and still clear local state.
      }
    }

    this.clearSession();
  }

  getToken(): string | null {
    return this.readSession()?.accessToken ?? null;
  }

  authHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  apiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiBaseUrl}${cleanPath}`;
  }

  private async refreshRoleFromBackend(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/admin/overview`, {
        headers: this.authHeaders()
      });
      if (!response.ok) return;
      const data = (await response.json()) as { role?: string };
      if (typeof data.role === 'string' && data.role) {
        const session = this.readSession();
        if (session) {
          this.writeSession({ ...session, role: data.role });
        }
      }
    } catch {
      // Ignore — session still valid, role stays as Viewer fallback
    }
  }

  private ensureSupabaseAuthConfig(): void {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
    }
  }

  private parseSupabaseSession(payload: Record<string, unknown>): SessionSnapshot {
    const user =
      payload['user'] && typeof payload['user'] === 'object'
        ? (payload['user'] as Record<string, unknown>)
        : {};
    const appMetadata =
      user['app_metadata'] && typeof user['app_metadata'] === 'object'
        ? (user['app_metadata'] as Record<string, unknown>)
        : {};
    const expiresInRaw = Number(payload['expires_in'] ?? 0);
    const expiresAt = new Date(
      Date.now() + (Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : 3600) * 1000
    ).toISOString();

    const session: SessionSnapshot = {
      accessToken: String(payload['access_token'] ?? ''),
      refreshToken: String(payload['refresh_token'] ?? ''),
      tokenType: String(payload['token_type'] ?? 'bearer'),
      userId: String(user['id'] ?? ''),
      email: String(user['email'] ?? ''),
      role: String(appMetadata['role'] ?? 'Viewer'),
      expiresAt
    };

    if (!session.accessToken || !session.refreshToken || !session.email) {
      throw new Error(
        'Authentication succeeded, but no active session was returned. Check Supabase email confirmation settings.'
      );
    }

    return session;
  }

  private isExpired(expiresAt: string): boolean {
    const expiresAtMs = Date.parse(expiresAt);
    return Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now();
  }

  private readSession(): SessionSnapshot | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionSnapshot;
    } catch {
      return null;
    }
  }

  private writeSession(session: SessionSnapshot): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.loginPayload = session;
  }

  private clearSession(): void {
    localStorage.removeItem(this.storageKey);
    this.loginPayload = null;
  }
}
