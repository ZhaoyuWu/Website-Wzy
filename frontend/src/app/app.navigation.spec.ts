import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { AdminPageComponent } from './pages/admin-page.component';

class MockAuthService {
  authenticated = true;
  logoutCallCount = 0;

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  get username(): string {
    return 'admin';
  }

  authHeaders(): HeadersInit {
    return { Authorization: 'Bearer fake-token' };
  }

  async logout(): Promise<void> {
    this.logoutCallCount += 1;
    this.authenticated = false;
  }
}

describe('Navigation (functional + performance)', () => {
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/overview')) {
        return new Response(JSON.stringify({ message: 'Admin area access granted' }), {
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
      imports: [App, AdminPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: AuthService, useClass: MockAuthService }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('supports click-based page switch through admin logout button', async () => {
    const harness = await RouterTestingHarness.create('/admin');
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    const router = TestBed.inject(Router);

    const button = harness.routeNativeElement?.querySelector('button') as HTMLButtonElement | null;
    expect(button).toBeTruthy();

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await harness.fixture.whenStable();

    expect(auth.logoutCallCount).toBe(1);
    expect(router.url).toBe('/login');
  });

  it('keeps route-switch latency under baseline for repeated toggles', async () => {
    const harness = await RouterTestingHarness.create('/login');
    const router = TestBed.inject(Router);
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    auth.authenticated = true;

    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();
      await harness.navigateByUrl('/login');
      await harness.navigateByUrl('/admin');
      durations.push(performance.now() - startedAt);
    }

    expect(router.url).toBe('/admin');
    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95) - 1];
    expect(p95).toBeLessThan(250);
  });
});
