import { ShowcasePageComponent } from './showcase-page.component';

describe('ShowcasePageComponent logic (T-003)', () => {
  let originalFetch: typeof fetch;
  let originalWindowFetch: typeof window.fetch;
  let originalConfig: Window['__NANAMI_SHOWCASE_CONFIG__'];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindowFetch = window.fetch;
    originalConfig = window.__NANAMI_SHOWCASE_CONFIG__;
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.fetch = originalWindowFetch;
    window.__NANAMI_SHOWCASE_CONFIG__ = originalConfig;
    localStorage.clear();
  });

  it('loads showcase rows and maps image/video items with configured limit', async () => {
    window.__NANAMI_SHOWCASE_CONFIG__ = {
      apiBaseUrl: 'http://localhost:4000',
      mediaLimit: '30'
    };

    let calledUrl = '';
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              id: 1,
              title: 'Nanami Morning',
              description: 'Sunrise walk',
              media_type: 'image',
              public_url: 'https://cdn.example.com/n1.jpg'
            },
            {
              id: 2,
              title: 'Nanami Zoomies',
              description: 'Park run',
              media_type: 'video',
              public_url: 'https://cdn.example.com/n2.mp4',
              thumbnail_url: 'https://cdn.example.com/n2.jpg'
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = new ShowcasePageComponent();
    await component.ngOnInit();

    expect(calledUrl).toContain('/api/showcase/media');
    expect(calledUrl).toContain('limit=30');
    expect(component.errorMessage).toBe('');
    expect(component.items.length).toBe(2);
    expect(component.items[0].mediaType).toBe('image');
    expect(component.items[1].mediaType).toBe('video');
    expect(component.isLoading).toBe(false);
  });

  it('shows empty state data when Supabase returns no rows', async () => {
    window.__NANAMI_SHOWCASE_CONFIG__ = {
      apiBaseUrl: 'http://localhost:4000'
    };
    const mockedFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: true, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = new ShowcasePageComponent();
    await component.ngOnInit();

    expect(component.items.length).toBe(0);
    expect(component.errorMessage).toBe('');
    expect(component.isLoading).toBe(false);
  });

  it('sets readable error when showcase endpoint is unavailable', async () => {
    window.__NANAMI_SHOWCASE_CONFIG__ = {
      apiBaseUrl: 'http://localhost:4000'
    };
    const mockedFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = new ShowcasePageComponent();
    await component.ngOnInit();

    expect(component.errorMessage).toContain('Showcase request failed');
    expect(component.items.length).toBe(0);
    expect(component.isLoading).toBe(false);
  });

  it('filters unsafe URLs and keeps only http/https media items', async () => {
    window.__NANAMI_SHOWCASE_CONFIG__ = {
      apiBaseUrl: 'http://localhost:4000'
    };
    const mockedFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          items: [
            { id: 1, title: 'Unsafe', media_type: 'image', public_url: 'javascript:alert(1)' },
            { id: 2, title: 'Safe', media_type: 'image', public_url: 'https://cdn.example.com/safe.jpg' }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = new ShowcasePageComponent();
    await component.ngOnInit();

    expect(component.items.length).toBe(1);
    expect(component.items[0].title).toBe('Safe');
  });
});



