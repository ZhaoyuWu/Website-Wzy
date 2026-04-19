import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { resolveApiBaseUrl } from '../core/runtime-config';

type SiteSettings = {
  profileName: string;
  heroTagline: string;
  aboutText: string;
  contactEmail: string;
  showContactEmail: boolean;
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  profileName: 'Nanami',
  heroTagline: 'Nanami, the sunshine of every walk.',
  aboutText: "This page shares Nanami's personality, daily routine, and favorite places in a warm timeline style.",
  contactEmail: '',
  showContactEmail: false
};

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="home">
      <header class="top-nav">
        <a class="brand" [routerLink]="['/']">{{ settings.profileName }} Journal</a>
        <nav>
          <a [routerLink]="['/']" fragment="moments">Moments</a>
          <a [routerLink]="['/showcase']">Showcase</a>
          <ng-container *ngIf="!auth.isAuthenticated">
            <a [routerLink]="['/register']">Register</a>
            <a [routerLink]="['/login']">Login</a>
          </ng-container>
          <ng-container *ngIf="auth.isAuthenticated">
            <a *ngIf="auth.isPublisherOrAdmin" [routerLink]="['/manage-media']">Media</a>
            <a *ngIf="auth.isPublisherOrAdmin" [routerLink]="['/admin']">Settings</a>
            <button type="button" class="nav-logout" (click)="logout()" [disabled]="isLoggingOut">
              {{ isLoggingOut ? '...' : 'Logout' }}
            </button>
          </ng-container>
        </nav>
      </header>

      <section class="hero">
        <p class="eyebrow">Public Homepage</p>
        <h1>{{ settings.heroTagline }}</h1>
        <p>{{ settings.aboutText }}</p>
        <div class="hero-actions">
          <a class="primary" [routerLink]="['/']" fragment="moments">View Story Moments</a>
          <a class="secondary" [routerLink]="['/showcase']">Open Showcase</a>
          <ng-container *ngIf="!auth.isAuthenticated">
            <a class="secondary" [routerLink]="['/register']">Create Account</a>
            <a class="secondary" [routerLink]="['/login']">Member Login</a>
          </ng-container>
          <a *ngIf="auth.isPublisherOrAdmin" class="secondary" [routerLink]="['/manage-media']">Manage Media</a>
          <a *ngIf="auth.isPublisherOrAdmin" class="secondary" [routerLink]="['/admin']">Settings</a>
        </div>
      </section>

      <section class="profile-card">
        <h2>About {{ settings.profileName }}</h2>
        <p>{{ settings.aboutText }}</p>
        <p class="contact" *ngIf="settings.showContactEmail && settings.contactEmail">
          Contact: <a [href]="'mailto:' + settings.contactEmail">{{ settings.contactEmail }}</a>
        </p>
        <p class="message" *ngIf="settingsMessage">{{ settingsMessage }}</p>
      </section>

      <section id="moments" class="moments">
        <article>
          <h2>Morning Energy</h2>
          <p>Nanami starts the day with a quick sprint, then waits politely for breakfast.</p>
        </article>
        <article>
          <h2>Afternoon Adventures</h2>
          <p>Park time means photo-ready smiles, playful zoomies, and curious nose work.</p>
        </article>
        <article>
          <h2>Evening Wind-down</h2>
          <p>After dinner, Nanami checks every corner of home and naps near the family.</p>
        </article>
      </section>
    </main>
  `,
  styles: `
    .home {
      min-height: 100vh;
      padding: 20px;
      background:
        radial-gradient(circle at 14% 20%, var(--fx-warm-glow-45), transparent 38%),
        radial-gradient(circle at 84% 12%, var(--fx-cool-glow-34), transparent 34%),
        linear-gradient(180deg, var(--clr-fff6ed) 0%, var(--clr-f6fbff) 100%);
    }

    .top-nav {
      width: min(1100px, 100%);
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 10px 0 18px;
    }

    .brand {
      color: var(--clr-673716);
      font-weight: 800;
      text-decoration: none;
      letter-spacing: 0.02em;
    }

    nav {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    nav a,
    .nav-logout {
      color: var(--color-text-secondary);
      text-decoration: none;
      border: 1px solid var(--color-border-warm);
      border-radius: 999px;
      padding: 8px 12px;
      background: var(--fx-glass-78);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }

    .nav-logout:disabled { opacity: 0.6; cursor: not-allowed; }

    .hero {
      width: min(1100px, 100%);
      margin: 0 auto;
      border: 1px solid var(--clr-ebd7c6);
      border-radius: 22px;
      padding: clamp(24px, 5vw, 44px);
      background: var(--color-surface-glass-93);
      box-shadow: 0 22px 46px var(--fx-shadow-warm-12);
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-size: 12px;
      font-weight: 700;
      color: var(--clr-9a5a2f);
    }

    h1 {
      margin: 10px 0 10px;
      color: var(--color-text-strong);
      font-size: clamp(31px, 4vw, 50px);
      line-height: 1.08;
      max-width: 14ch;
    }

    .hero p {
      margin: 0;
      color: var(--clr-5b4534);
      font-size: 17px;
      max-width: 65ch;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 24px;
    }

    .profile-card {
      width: min(1100px, 100%);
      margin: 16px auto 0;
      border: 1px solid var(--clr-dbe9f5);
      border-radius: 16px;
      background: var(--color-surface-glass-86);
      padding: 18px;
    }

    .profile-card h2 {
      margin: 0;
      color: var(--clr-234564);
    }

    .profile-card p {
      margin: 8px 0 0;
      color: var(--clr-3a5268);
    }

    .contact a {
      color: var(--clr-184f7f);
      text-decoration: none;
      font-weight: 700;
    }

    .message {
      color: var(--clr-5b6f84);
      font-size: 14px;
    }

    .hero-actions a {
      text-decoration: none;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 700;
    }

    .primary {
      color: var(--color-surface);
      background: linear-gradient(92deg, var(--color-brand-warm-start) 0%, var(--color-brand-warm-end) 100%);
    }

    .secondary {
      color: var(--clr-5f3a1e);
      border: 1px solid var(--clr-d2b79f);
      background: var(--color-surface-soft);
    }

    .moments {
      width: min(1100px, 100%);
      margin: 22px auto 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    article {
      border-radius: 16px;
      border: 1px solid var(--color-border-soft);
      background: var(--color-surface);
      padding: 20px;
      content-visibility: auto;
      contain-intrinsic-size: 220px;
    }

    h2 {
      margin: 0;
      color: var(--clr-224160);
      font-size: 20px;
    }

    article p {
      margin: 9px 0 0;
      color: var(--clr-3a5268);
      line-height: 1.55;
    }

    @media (max-width: 900px) {
      .moments {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .home {
        padding: 14px;
      }

      .top-nav {
        flex-direction: column;
        align-items: flex-start;
      }

      nav {
        justify-content: flex-start;
      }

      .moments {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 390px) {
      nav a {
        padding: 7px 10px;
        font-size: 13px;
      }

      .hero-actions a {
        width: 100%;
        text-align: center;
      }
    }

    @media (min-width: 1280px) {
      .home {
        padding: 28px 32px;
      }

      .moments {
        gap: 18px;
      }
    }
  `
})
export class HomePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiBaseUrl = resolveApiBaseUrl();
  settings: SiteSettings = { ...DEFAULT_SITE_SETTINGS };
  settingsMessage = '';
  isLoggingOut = false;

  async logout(): Promise<void> {
    this.isLoggingOut = true;
    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } finally {
      this.isLoggingOut = false;
      this.safeDetectChanges();
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/settings`);
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        settings?: Partial<SiteSettings>;
        source?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load site settings.');
      }

      this.settings = this.mergeSettings(payload.settings);
      this.settingsMessage =
        payload.source === 'default' ? 'Using default site settings. Admin can customize this page.' : '';
    } catch {
      this.settings = { ...DEFAULT_SITE_SETTINGS };
      this.settingsMessage = 'Unable to load custom settings right now. Showing default content.';
    } finally {
      this.safeDetectChanges();
    }
  }

  private safeDetectChanges(): void {
    const viewRef = this.cdr as ViewRef;
    if (!viewRef.destroyed) {
      this.cdr.detectChanges();
    }
  }

  private mergeSettings(raw?: Partial<SiteSettings>): SiteSettings {
    const source = raw || {};
    return {
      profileName: this.pickSafeText(source.profileName, DEFAULT_SITE_SETTINGS.profileName, 80),
      heroTagline: this.pickSafeText(source.heroTagline, DEFAULT_SITE_SETTINGS.heroTagline, 180),
      aboutText: this.pickSafeText(source.aboutText, DEFAULT_SITE_SETTINGS.aboutText, 1200),
      contactEmail: this.pickSafeText(source.contactEmail, '', 120),
      showContactEmail: Boolean(source.showContactEmail)
    };
  }

  private pickSafeText(value: unknown, fallback: string, maxLength: number): string {
    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
      return fallback;
    }

    return normalized;
  }
}




