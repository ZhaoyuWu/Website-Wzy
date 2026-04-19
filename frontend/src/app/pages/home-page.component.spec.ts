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

  function emptyTimelineResponse(): Response {
    return new Response(
      JSON.stringify({ ok: true, items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  it('loads public settings and applies them to page state', async () => {
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/settings')) {
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
      }
      return emptyTimelineResponse();
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const fixture = TestBed.createComponent(HomePageComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();

    expect(component.settings.profileName).toBe('Nanami Star');
    expect(component.settings.showContactEmail).toBe(true);
    expect(component.settingsMessage).toBe('');
  });

  it('falls back to defaults when settings request fails', async () => {
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/settings')) {
        throw new Error('network down');
      }
      return emptyTimelineResponse();
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const fixture = TestBed.createComponent(HomePageComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();

    expect(component.settings.profileName).toBe('Nanami');
    expect(component.settingsMessage).toContain('Unable to load custom settings');
  });

  it('uses runtime API base URL for settings request', async () => {
    window.__NANAMI_APP_CONFIG__ = { apiBaseUrl: 'https://api.nanami.test/' };
    const settingsUrls: string[] = [];
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/settings')) {
        settingsUrls.push(url);
        return new Response(
          JSON.stringify({ ok: true, source: 'default', settings: {} }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return emptyTimelineResponse();
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const fixture = TestBed.createComponent(HomePageComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();

    expect(settingsUrls).toContain('https://api.nanami.test/api/settings');
  });
});



