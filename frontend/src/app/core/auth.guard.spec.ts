import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

function configureGuard(isAuthenticated: boolean): Router {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          get isAuthenticated() {
            return isAuthenticated;
          }
        }
      }
    ]
  });
  return TestBed.inject(Router);
}

describe('authGuard (logic)', () => {
  it('allows navigation when authenticated', () => {
    configureGuard(true);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/admin' } as never)
    );
    expect(result).toBe(true);
  });

  it('redirects to /login with redirect param when unauthenticated', () => {
    const router = configureGuard(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/admin' } as never)
    );
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?redirect=%2Fadmin');
  });
});
