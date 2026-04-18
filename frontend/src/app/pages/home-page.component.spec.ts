import { HomePageComponent } from './home-page.component';

describe('HomePageComponent logic (T-005)', () => {
  let originalFetch: typeof fetch;
  let originalWindowFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindowFetch = window.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.fetch = originalWindowFetch;
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

    const component = new HomePageComponent();
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

    const component = new HomePageComponent();
    await component.ngOnInit();

    expect(component.settings.profileName).toBe('Nanami');
    expect(component.settingsMessage).toContain('Unable to load custom settings');
  });
});
