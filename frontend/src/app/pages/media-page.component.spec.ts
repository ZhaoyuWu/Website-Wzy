import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MediaPageComponent } from './media-page.component';
import { AuthService } from '../core/auth.service';

class MockAuthService {
  get isAuthenticated(): boolean {
    return true;
  }

  get username(): string {
    return 'admin';
  }

  get userRole(): string {
    return 'Admin';
  }

  authHeaders(): HeadersInit {
    return { Authorization: 'Bearer fake-token' };
  }

  apiUrl(path: string): string {
    return `http://localhost:4000${path}`;
  }

  async logout(): Promise<void> {
    return;
  }
}

describe('MediaPageComponent (logic + performance)', () => {
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/overview')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('/api/admin/media')) {
        return new Response(JSON.stringify({ ok: true, items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await TestBed.configureTestingModule({
      imports: [MediaPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useClass: MockAuthService }]
    }).compileComponents();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects unsupported upload file type in selection logic', () => {
    const fixture = TestBed.createComponent(MediaPageComponent);
    const component = fixture.componentInstance;

    const file = new File([new Uint8Array([1, 2, 3])], 'bad.pdf', { type: 'application/pdf' });
    const event = {
      target: {
        files: [file]
      }
    } as unknown as Event;

    component.onFileSelected(event);

    expect(component.selectedFile).toBeNull();
    expect(component.uploadError).toContain('Unsupported file type');
  });

  it('uses fallback string when date value is missing', () => {
    const fixture = TestBed.createComponent(MediaPageComponent);
    const component = fixture.componentInstance;

    expect(component.formatDateTime(undefined)).toBe('--');
  });

  it('keeps edit toggle latency under baseline for repeated open-close cycles', () => {
    const fixture = TestBed.createComponent(MediaPageComponent);
    const component = fixture.componentInstance;
    const item = { id: 1, title: 'Nanami', description: 'desc' };

    const durations: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const startedAt = performance.now();
      component.startEdit(item);
      component.cancelEdit();
      durations.push(performance.now() - startedAt);
    }

    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1];
    expect(p95).toBeLessThan(5);
  });
});
