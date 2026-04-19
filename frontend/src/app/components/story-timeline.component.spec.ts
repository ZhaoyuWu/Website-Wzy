import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { StoryTimelineComponent } from './story-timeline.component';

function makeComponent(): StoryTimelineComponent {
  return TestBed.runInInjectionContext(() => new StoryTimelineComponent());
}

describe('StoryTimelineComponent logic', () => {
  let originalFetch: typeof fetch;
  let originalWindowFetch: typeof window.fetch;
  let originalConfig: Window['__NANAMI_APP_CONFIG__'];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
    originalFetch = globalThis.fetch;
    originalWindowFetch = window.fetch;
    originalConfig = window.__NANAMI_APP_CONFIG__;
    window.__NANAMI_APP_CONFIG__ = { apiBaseUrl: 'http://localhost:4000' };
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.fetch = originalWindowFetch;
    window.__NANAMI_APP_CONFIG__ = originalConfig;
    localStorage.clear();
  });

  it('loads mixed media and text entries and sets pagination metadata', async () => {
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain('/api/story/timeline');
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              type: 'text',
              id: 5,
              title: 'Newest',
              body: 'Hello timeline',
              likesCount: 2,
              createdAt: '2026-04-19T11:00:00Z'
            },
            {
              type: 'image',
              id: 9,
              title: 'Older photo',
              description: 'Sunrise',
              mediaUrl: 'https://cdn.example.com/a.jpg',
              likesCount: 3,
              createdAt: '2026-04-01T10:00:00Z'
            }
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = makeComponent();
    await component.ngOnInit();

    expect(component.entries.length).toBe(2);
    expect(component.entries[0].type).toBe('text');
    expect(component.entries[0].body).toBe('Hello timeline');
    expect(component.entries[1].type).toBe('image');
    expect(component.entries[1].likesCount).toBe(3);
    expect(component.totalPages).toBe(1);
  });

  it('drops entries with unsafe or missing media URLs but keeps text entries', async () => {
    const mockedFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          items: [
            { type: 'image', id: 1, title: 'Unsafe', mediaUrl: 'javascript:alert(1)' },
            { type: 'image', id: 2, title: 'Safe', mediaUrl: 'https://cdn.example.com/a.jpg' },
            { type: 'text', id: 3, title: 'Note', body: 'body text' }
          ],
          total: 3,
          page: 1,
          pageSize: 20,
          totalPages: 1
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = makeComponent();
    await component.ngOnInit();

    expect(component.entries.map((e) => e.id)).toEqual([2, 3]);
  });

  it('toggles likes against the typed endpoint and namespaces localStorage by type', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const mockedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (url.includes('/api/story/text/5/like')) {
        calls.push({ url, method });
        return new Response(JSON.stringify({ ok: true, likesCount: method === 'DELETE' ? 2 : 3 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          items: [{ type: 'text', id: 5, title: 'T', body: 'b', likesCount: 2 }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = makeComponent();
    await component.ngOnInit();
    const entry = component.entries[0];

    await component.onToggleLike(entry);
    expect(calls[0]).toEqual({
      url: 'http://localhost:4000/api/story/text/5/like',
      method: 'POST'
    });
    expect(entry.likesCount).toBe(3);
    expect(component.isLiked(entry)).toBe(true);
    expect(localStorage.getItem('nanami.story.likes')).toContain('text');

    await component.onToggleLike(entry);
    expect(calls[1]).toEqual({
      url: 'http://localhost:4000/api/story/text/5/like',
      method: 'DELETE'
    });
    expect(entry.likesCount).toBe(2);
    expect(component.isLiked(entry)).toBe(false);
  });

  it('opens the lightbox only for image entries and closes on escape', async () => {
    const mockedFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          items: [
            { type: 'image', id: 1, title: 'Img', mediaUrl: 'https://cdn.example.com/a.jpg' },
            { type: 'text', id: 2, title: 'Txt', body: 'hello' }
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    globalThis.fetch = mockedFetch;
    window.fetch = mockedFetch;

    const component = makeComponent();
    await component.ngOnInit();

    component.openFullscreen(component.entries[1]);
    expect(component.activeImage).toBeNull();

    component.openFullscreen(component.entries[0]);
    expect(component.activeImage?.id).toBe(1);

    component.onEscape();
    expect(component.activeImage).toBeNull();
  });
});
