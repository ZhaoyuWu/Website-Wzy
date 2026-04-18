import { Injectable } from '@angular/core';

type SessionSnapshot = {
  token: string;
  username: string;
  expiresAt: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBaseUrl = 'http://localhost:4000';
  private readonly storageKey = 'nanami_admin_session';

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
    return this.readSession()?.username ?? null;
  }

  async login(username: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
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
          : 'Login failed. Please try again.';
      throw new Error(message);
    }

    const session: SessionSnapshot = {
      token: String(payload['token'] ?? ''),
      username: String(payload['username'] ?? ''),
      expiresAt: String(payload['expiresAt'] ?? '')
    };

    if (!session.token || !session.username || !session.expiresAt) {
      throw new Error('Login response is incomplete.');
    }

    this.writeSession(session);
  }

  async register(username: string, email: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
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

    const session: SessionSnapshot = {
      token: String(payload['token'] ?? ''),
      username: String(payload['username'] ?? ''),
      expiresAt: String(payload['expiresAt'] ?? '')
    };

    if (!session.token || !session.username || !session.expiresAt) {
      throw new Error('Registration response is incomplete.');
    }

    this.writeSession(session);
  }

  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Ignore API errors and still clear local state.
      }
    }

    this.clearSession();
  }

  getToken(): string | null {
    return this.readSession()?.token ?? null;
  }

  authHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  apiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiBaseUrl}${cleanPath}`;
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
