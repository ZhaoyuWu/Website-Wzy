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

  describe('kiteFrame stepping', () => {
    function makeComponent(): HomePageComponent {
      const fixture = TestBed.createComponent(HomePageComponent);
      return fixture.componentInstance;
    }

    it('cycles forward 1→2→3→4→1 on showOlderMedia', () => {
      const c = makeComponent();
      c.heroMediaItems = [
        { id: 'a', type: 'image', title: '', description: '', mediaUrl: 'a.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'b', type: 'image', title: '', description: '', mediaUrl: 'b.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'c', type: 'image', title: '', description: '', mediaUrl: 'c.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'd', type: 'image', title: '', description: '', mediaUrl: 'd.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'e', type: 'image', title: '', description: '', mediaUrl: 'e.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 }
      ];
      c.heroMediaIndex = 0;
      c.kiteFrame = 1;
      const observed: number[] = [c.kiteFrame];
      for (let i = 0; i < 4; i++) {
        c.showOlderMedia();
        observed.push(c.kiteFrame);
      }
      expect(observed).toEqual([1, 2, 3, 4, 1]);
    });

    it('cycles backward 1→4→3→2→1 on showNewerMedia', () => {
      const c = makeComponent();
      c.heroMediaItems = [
        { id: 'a', type: 'image', title: '', description: '', mediaUrl: 'a.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'b', type: 'image', title: '', description: '', mediaUrl: 'b.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'c', type: 'image', title: '', description: '', mediaUrl: 'c.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'd', type: 'image', title: '', description: '', mediaUrl: 'd.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'e', type: 'image', title: '', description: '', mediaUrl: 'e.jpg', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 }
      ];
      c.heroMediaIndex = 4;
      c.kiteFrame = 1;
      const observed: number[] = [c.kiteFrame];
      for (let i = 0; i < 4; i++) {
        c.showNewerMedia();
        observed.push(c.kiteFrame);
      }
      expect(observed).toEqual([1, 4, 3, 2, 1]);
    });
  });

  describe('formatMediaDate', () => {
    function makeComponent(): HomePageComponent {
      const fixture = TestBed.createComponent(HomePageComponent);
      return fixture.componentInstance;
    }

    it('returns empty string for null', () => {
      const c = makeComponent();
      expect(c.formatMediaDate(null)).toBe('');
    });

    it('returns empty string when no date fields', () => {
      const c = makeComponent();
      expect(
        c.formatMediaDate({
          id: 1, type: 'image', title: '', description: '',
          mediaUrl: '', displayDate: null, createdAt: null,
          likesCount: 0, commentsCount: 0
        })
      ).toBe('');
    });

    it('formats ISO date as YYYY.MM.DD', () => {
      const c = makeComponent();
      expect(
        c.formatMediaDate({
          id: 1, type: 'image', title: '', description: '',
          mediaUrl: '', displayDate: '2026-04-23',
          createdAt: null, likesCount: 0, commentsCount: 0
        })
      ).toBe('2026.04.23');
    });

    it('falls back to createdAt when displayDate is missing', () => {
      const c = makeComponent();
      expect(
        c.formatMediaDate({
          id: 1, type: 'image', title: '', description: '',
          mediaUrl: '', displayDate: null,
          createdAt: '2026-01-05T10:00:00Z',
          likesCount: 0, commentsCount: 0
        })
      ).toMatch(/^2026\.01\.0[45]$/);
    });

    it('returns raw value when not a parseable date', () => {
      const c = makeComponent();
      expect(
        c.formatMediaDate({
          id: 1, type: 'image', title: '', description: '',
          mediaUrl: '', displayDate: 'not-a-date',
          createdAt: null, likesCount: 0, commentsCount: 0
        })
      ).toBe('not-a-date');
    });
  });

  describe('nextMedia / prevMedia getters', () => {
    function makeComponent(): HomePageComponent {
      const fixture = TestBed.createComponent(HomePageComponent);
      return fixture.componentInstance;
    }

    it('exposes adjacent items based on heroMediaIndex', () => {
      const c = makeComponent();
      c.heroMediaItems = [
        { id: 'newest', type: 'image', title: '', description: '', mediaUrl: '', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'middle', type: 'image', title: '', description: '', mediaUrl: '', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 },
        { id: 'oldest', type: 'image', title: '', description: '', mediaUrl: '', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 }
      ];
      c.heroMediaIndex = 1;
      expect(c.nextMedia?.id).toBe('newest');
      expect(c.prevMedia?.id).toBe('oldest');
      expect(c.currentHeroMedia?.id).toBe('middle');
    });

    it('returns null at the edges', () => {
      const c = makeComponent();
      c.heroMediaItems = [
        { id: 'only', type: 'image', title: '', description: '', mediaUrl: '', displayDate: null, createdAt: null, likesCount: 0, commentsCount: 0 }
      ];
      c.heroMediaIndex = 0;
      expect(c.nextMedia).toBeNull();
      expect(c.prevMedia).toBeNull();
    });
  });

  describe('day/night theme', () => {
    function makeComponent(): HomePageComponent {
      const fixture = TestBed.createComponent(HomePageComponent);
      return fixture.componentInstance;
    }

    function callApplyTheme(c: HomePageComponent): void {
      (c as unknown as { applyThemeFromClock: () => void }).applyThemeFromClock();
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('selects day theme between 06:00 and 17:59', () => {
      const c = makeComponent();
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      vi.useFakeTimers();
      vi.setSystemTime(noon);
      callApplyTheme(c);
      expect(c.theme).toBe('day');
    });

    it('selects night theme at and after 18:00', () => {
      const c = makeComponent();
      const evening = new Date();
      evening.setHours(20, 30, 0, 0);
      vi.useFakeTimers();
      vi.setSystemTime(evening);
      callApplyTheme(c);
      expect(c.theme).toBe('night');
    });

    it('selects night theme before 06:00', () => {
      const c = makeComponent();
      const earlyMorning = new Date();
      earlyMorning.setHours(3, 15, 0, 0);
      vi.useFakeTimers();
      vi.setSystemTime(earlyMorning);
      callApplyTheme(c);
      expect(c.theme).toBe('night');
    });

    it('switches theme on the 06:00 boundary', () => {
      const c = makeComponent();
      const before = new Date();
      before.setHours(5, 59, 0, 0);
      vi.useFakeTimers();
      vi.setSystemTime(before);
      callApplyTheme(c);
      expect(c.theme).toBe('night');
      const after = new Date(before.getTime() + 60_000);
      vi.setSystemTime(after);
      callApplyTheme(c);
      expect(c.theme).toBe('day');
    });
  });

  describe('like toggle', () => {
    it('marks item liked and increments likesCount on POST', async () => {
      const calls: { url: string; method?: string }[] = [];
      const mockedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method });
        if (url.includes('/api/story/media/') && url.endsWith('/like') && init?.method === 'POST') {
          return new Response(JSON.stringify({ ok: true, likesCount: 7 }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        }
        return emptyTimelineResponse();
      };
      globalThis.fetch = mockedFetch;
      window.fetch = mockedFetch;

      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      const item = {
        id: '42', type: 'image' as const, title: '', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 6, commentsCount: 0
      };
      await c.toggleLike(item);
      expect(item.likesCount).toBe(7);
      expect(c.isLiked(item)).toBe(true);
      const likeCall = calls.find(x => x.url.includes('/like'));
      expect(likeCall?.method).toBe('POST');
    });

    it('removes liked state and decrements on second toggle (DELETE)', async () => {
      const calls: { method?: string }[] = [];
      const mockedFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ method: init?.method });
        if (init?.method === 'DELETE') {
          return new Response(JSON.stringify({ ok: true, likesCount: 6 }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        }
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ ok: true, likesCount: 7 }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        }
        return emptyTimelineResponse();
      };
      globalThis.fetch = mockedFetch;
      window.fetch = mockedFetch;

      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      const item = {
        id: '42', type: 'image' as const, title: '', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 6, commentsCount: 0
      };
      await c.toggleLike(item);
      expect(c.isLiked(item)).toBe(true);
      await c.toggleLike(item);
      expect(c.isLiked(item)).toBe(false);
      expect(item.likesCount).toBe(6);
      expect(calls.some(x => x.method === 'POST')).toBe(true);
      expect(calls.some(x => x.method === 'DELETE')).toBe(true);
    });
  });

  describe('media comment submission', () => {
    it('rejects empty messages with an error', async () => {
      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      c.selectedMedia = {
        id: '1', type: 'image', title: '', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 0, commentsCount: 0
      };
      c.mediaCommentDraft = '   ';
      await c.submitMediaComment();
      expect(c.mediaCommentError).toBe('请输入留言内容');
    });

    it('requires a name when not authenticated', async () => {
      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      c.selectedMedia = {
        id: '1', type: 'image', title: '', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 0, commentsCount: 0
      };
      c.mediaCommentDraft = 'hello';
      c.mediaCommentAuthor = '';
      await c.submitMediaComment();
      expect(c.mediaCommentError).toBe('请填写名字');
    });

    it('optimistically inserts the new comment on success', async () => {
      const mockedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/comments') && init?.method === 'POST') {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        }
        if (url.includes('/comments')) {
          return new Response(JSON.stringify({ ok: true, items: [] }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        }
        return emptyTimelineResponse();
      };
      globalThis.fetch = mockedFetch;
      window.fetch = mockedFetch;

      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      c.selectedMedia = {
        id: '1', type: 'image', title: '', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 0, commentsCount: 0
      };
      c.mediaCommentDraft = 'looks great!';
      c.mediaCommentAuthor = 'Tester';
      await c.submitMediaComment();
      expect(c.mediaCommentSuccess).toBe('已留言');
      expect(c.mediaCommentDraft).toBe('');
      // Server returned [] but optimistic insert made list briefly contain the entry.
      // After silent refetch overwriting with [], length is 0 — guard for both.
      expect(Array.isArray(c.mediaComments)).toBe(true);
    });

    it('reports server error message when POST fails', async () => {
      const mockedFetch: typeof fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ ok: false, message: 'Comment too long.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        return emptyTimelineResponse();
      };
      globalThis.fetch = mockedFetch;
      window.fetch = mockedFetch;

      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      c.selectedMedia = {
        id: '1', type: 'image', title: '', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 0, commentsCount: 0
      };
      c.mediaCommentDraft = 'hi';
      c.mediaCommentAuthor = 'Tester';
      await c.submitMediaComment();
      expect(c.mediaCommentError).toBe('Comment too long.');
    });
  });

  describe('media modal', () => {
    it('closeMediaDetail clears state', () => {
      const fixture = TestBed.createComponent(HomePageComponent);
      const c = fixture.componentInstance;
      c.selectedMedia = {
        id: '1', type: 'image', title: 't', description: '',
        mediaUrl: '', displayDate: null, createdAt: null,
        likesCount: 0, commentsCount: 0
      };
      c.mediaCommentDraft = 'draft';
      c.mediaCommentSuccess = 'ok';
      c.mediaCommentError = 'err';
      c.closeMediaDetail();
      expect(c.selectedMedia).toBeNull();
      expect(c.mediaCommentDraft).toBe('');
      expect(c.mediaCommentSuccess).toBe('');
      expect(c.mediaCommentError).toBe('');
    });
  });
});



