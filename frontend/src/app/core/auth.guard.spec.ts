import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard, roleGuard } from './auth.guard';

function configureGuard(isAuthenticated: boolean, userRole = 'Viewer'): Router {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          get isAuthenticated() {
            return isAuthenticated;
          },
          get userRole() {
            return userRole;
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

describe('roleGuard (logic)', () => {
  it('allows role-matched authenticated users', () => {
    configureGuard(true, 'Publisher');
    const result = TestBed.runInInjectionContext(() =>
      roleGuard('Admin', 'Publisher')({} as never, { url: '/manage-media' } as never)
    );
    expect(result).toBe(true);
  });

  it('redirects unauthenticated users to /login with redirect param', () => {
    const router = configureGuard(false, 'Publisher');
    const result = TestBed.runInInjectionContext(() =>
      roleGuard('Admin', 'Publisher')({} as never, { url: '/manage-media' } as never)
    );
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?redirect=%2Fmanage-media');
  });

  it('redirects authenticated but unauthorized users to home', () => {
    const router = configureGuard(true, 'Viewer');
    const result = TestBed.runInInjectionContext(() =>
      roleGuard('Admin', 'Publisher')({} as never, { url: '/manage-media' } as never)
    );
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});
