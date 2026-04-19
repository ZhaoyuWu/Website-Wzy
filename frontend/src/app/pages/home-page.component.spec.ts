import { HomePageComponent } from './home-page.component';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';

describe('HomePageComponent logic (T-005)', () => {
  let originalFetch: typeof fetch;
  let originalWindowFetch: typeof window.fetch;
  let originalRuntimeConfig: Window['__NANAMI_APP_CONFIG__'];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindowFetch = window.fetch;
    originalRuntimeConfig = window.__NANAMI_APP_CONFIG__;
    window.__NANAMI_APP_CONFIG__ = undefined;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: false,
            isPublisherOrAdmin: false,
            logout: async () => undefined
          }
        }
      ]
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.fetch = originalWindowFetch;
    window.__NANAMI_APP_CONFIG__ = originalRuntimeConfig;
  });

  it('loads public settings and applies them to page state', async () => {
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/settings');
      return new Response(
        JSON.stringify({
          ok: true,
          source: 'supabase',
          settings: {
            profileName: 'Nanami Star',
            heroTagline: 'Joy on every walk',
            aboutText: 'Nanami likes morning runs and calm evenings.',
            contactEmail: 'hello@nanami.test',
            showContactEmail: true
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    await component.ngOnInit();

    expect(component.settings.profileName).toBe('Nanami Star');
    expect(component.settings.showContactEmail).toBe(true);
    expect(component.settingsMessage).toBe('');
  });

  it('falls back to defaults when settings request fails', async () => {
    const mockedFetch: typeof fetch = async () => {
      throw new Error('network down');
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    await component.ngOnInit();

    expect(component.settings.profileName).toBe('Nanami');
    expect(component.settingsMessage).toContain('Unable to load custom settings');
  });

  it('uses runtime API base URL for settings request', async () => {
    window.__NANAMI_APP_CONFIG__ = { apiBaseUrl: 'https://api.nanami.test/' };
    let calledUrl = '';
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(
        JSON.stringify({ ok: true, source: 'default', settings: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = TestBed.runInInjectionContext(() => new HomePageComponent());
    await component.ngOnInit();

    expect(calledUrl).toBe('https://api.nanami.test/api/settings');
  });
});



