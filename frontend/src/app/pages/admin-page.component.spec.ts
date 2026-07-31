import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminPageComponent } from './admin-page.component';
import { AuthService } from '../core/auth.service';

class MockAuthService {
  role = 'Admin';

  readonly isAuthenticated = true;
  readonly username = 'admin';

  get userRole(): string {
    return this.role;
  }

  get isAdmin(): boolean {
    return this.role === 'Admin';
  }

  get isPublisherOrAdmin(): boolean {
    return this.role === 'Admin' || this.role === 'Publisher';
  }

  authHeaders(): HeadersInit {
    return { Authorization: 'Bearer fake-token' };
  }

  apiUrl(path: string): string {
    return `http://localhost:4000${path}`;
  }

  async apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(this.apiUrl(path), {
      ...init,
      headers: {
        ...((init.headers as Record<string, string>) || {}),
        ...this.authHeaders()
      }
    });
  }

  async logout(): Promise<void> {
    return;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('AdminPageComponent (logic)', () => {
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useClass: MockAuthService }]
    }).compileComponents();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createComponent(): AdminPageComponent {
    return TestBed.createComponent(AdminPageComponent).componentInstance;
  }

  it('ngOnInit loads users, bootstrap status, and settings for an admin', async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/overview')) {
        return jsonResponse({ ok: true, message: 'Admin API is reachable.' });
      }
      if (url.includes('/api/admin/users')) {
        return jsonResponse({
          ok: true,
          users: [{ id: 'u1', email: 'admin@example.com', role: 'Admin' }]
        });
      }
      if (url.includes('/api/admin/bootstrap/status')) {
        return jsonResponse({ ok: true, hasAdmin: true, canClaimAdmin: false });
      }
      if (url.includes('/api/admin/settings')) {
        return jsonResponse({
          ok: true,
          settings: {
            profileName: 'Nanami Star',
            heroTagline: 'tagline',
            aboutText: 'about',
            contactEmail: 'hello@nanami.test',
            showContactEmail: true,
            updatedAt: '2026-07-24T10:00:00Z'
          }
        });
      }
      return jsonResponse({ ok: true });
    };

    const component = createComponent();
    await component.ngOnInit();

    expect(component.authCheckStatus()).toBe('Authenticated');
    expect(component.users().length).toBe(1);
    expect(component.users()[0].email).toBe('admin@example.com');
    expect(component.settingsForm().profileName).toBe('Nanami Star');
    expect(component.canClaimAdmin()).toBe(false);
  });

  it('loadUsers surfaces backend error messages', async () => {
    globalThis.fetch = async () => jsonResponse({ ok: false, message: 'Failed to load users.' }, 500);

    const component = createComponent();
    await component.loadUsers();

    expect(component.users().length).toBe(0);
    expect(component.usersError()).toBe('Failed to load users.');
    expect(component.isLoadingUsers()).toBe(false);
  });

  it('updateUserRole patches the role and marks the row as saved', async () => {
    let patchedBody: unknown = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/admin/users/u2/role')) {
        patchedBody = JSON.parse(String(init?.body));
        return jsonResponse({
          ok: true,
          user: { id: 'u2', email: 'pub@example.com', role: 'Publisher' }
        });
      }
      return jsonResponse({ ok: true });
    };

    const component = createComponent();
    component.users.set([{ id: 'u2', email: 'pub@example.com', role: 'Viewer' }]);

    await component.updateUserRole(component.users()[0], 'Publisher');

    expect(patchedBody).toEqual({ role: 'Publisher' });
    expect(component.users()[0].role).toBe('Publisher');
    expect(component.savedRoleId()).toBe('u2');
    expect(component.savingRoleId()).toBeNull();
  });

  it('updateUserRole keeps the old role and reports the error on failure', async () => {
    globalThis.fetch = async () => jsonResponse({ ok: false, message: 'Role must be valid.' }, 400);

    const component = createComponent();
    component.users.set([{ id: 'u3', email: 'v@example.com', role: 'Viewer' }]);

    await component.updateUserRole(component.users()[0], 'Admin');

    expect(component.users()[0].role).toBe('Viewer');
    expect(component.roleUpdateError()).toBe('Role must be valid.');
  });

  it('saveSettings validates inputs before touching the network', async () => {
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return jsonResponse({ ok: true });
    };

    const component = createComponent();

    component.settingsForm.set({
      profileName: '',
      heroTagline: 'tag',
      aboutText: 'about',
      contactEmail: '',
      showContactEmail: false,
      updatedAt: null
    });
    await component.saveSettings();
    expect(component.settingsError()).toContain('Profile name');

    component.settingsForm.set({
      profileName: 'Nanami',
      heroTagline: 'tag',
      aboutText: 'about',
      contactEmail: 'not-an-email',
      showContactEmail: false,
      updatedAt: null
    });
    await component.saveSettings();
    expect(component.settingsError()).toContain('valid email');

    expect(fetchCalls).toBe(0);
  });

  it('saveSettings persists the patch and reflects the merged response', async () => {
    let sentBody: Record<string, unknown> | null = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/admin/settings') && String(init?.method) === 'PATCH') {
        sentBody = JSON.parse(String(init?.body));
        return jsonResponse({
          ok: true,
          message: 'Settings saved.',
          settings: {
            profileName: 'Nanami Star',
            heroTagline: 'Golden joy',
            aboutText: 'About text',
            contactEmail: 'hello@nanami.test',
            showContactEmail: true,
            updatedAt: '2026-07-24T12:00:00Z'
          }
        });
      }
      return jsonResponse({ ok: true });
    };

    const component = createComponent();
    component.settingsForm.set({
      profileName: '  Nanami Star  ',
      heroTagline: 'Golden joy',
      aboutText: 'About text',
      contactEmail: 'HELLO@nanami.test',
      showContactEmail: true,
      updatedAt: null
    });

    await component.saveSettings();

    expect(sentBody?.['profileName']).toBe('Nanami Star');
    expect(sentBody?.['contactEmail']).toBe('hello@nanami.test');
    expect(component.settingsSuccess()).toBe('Settings saved.');
    expect(component.settingsForm().updatedAt).toBe('2026-07-24T12:00:00Z');
    expect(component.isSavingSettings()).toBe(false);
  });

  it('claimAdminRole reports success and hides the claim card', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/admin/bootstrap/claim') && String(init?.method) === 'POST') {
        return jsonResponse({ ok: true, message: 'Admin role granted.' });
      }
      return jsonResponse({ ok: true });
    };

    const component = createComponent();
    component.canClaimAdmin.set(true);

    await component.claimAdminRole();

    expect(component.claimAdminSuccess()).toBe('Admin role granted.');
    expect(component.canClaimAdmin()).toBe(false);
    expect(component.isClaimingAdmin()).toBe(false);
  });

  it('formatDateTime falls back to the raw string for unparseable dates', () => {
    const component = createComponent();
    expect(component.formatDateTime('not-a-date')).toBe('not-a-date');
  });
});
