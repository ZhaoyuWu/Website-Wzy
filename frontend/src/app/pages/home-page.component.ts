import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { resolveApiBaseUrl } from '../core/runtime-config';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { StoryTimelineComponent } from '../components/story-timeline.component';

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
  imports: [CommonModule, RouterLink, StoryTimelineComponent, LanguagePickerComponent],
  template: `
    <main class="home">
      <header class="top-nav">
        <a class="brand" [routerLink]="['/']">
          <img src="favicon-192.png" alt="" class="brand-mark" width="36" height="36" />
          <span>{{ settings.profileName }} {{ i18n.t('brand.journal') }}</span>
        </a>
        <nav>
          <a [routerLink]="['/']" fragment="story">{{ i18n.t('nav.story') }}</a>
          <ng-container *ngIf="!auth.isAuthenticated">
            <a [routerLink]="['/register']">{{ i18n.t('nav.register') }}</a>
            <a [routerLink]="['/login']">{{ i18n.t('nav.login') }}</a>
          </ng-container>
          <ng-container *ngIf="auth.isAuthenticated">
            <a *ngIf="auth.isPublisherOrAdmin" [routerLink]="['/manage-media']">{{ i18n.t('nav.media') }}</a>
            <a *ngIf="auth.isPublisherOrAdmin" [routerLink]="['/admin']">{{ i18n.t('nav.settings') }}</a>
          </ng-container>
          <app-language-picker></app-language-picker>
          <button
            type="button"
            class="nav-logout"
            *ngIf="auth.isAuthenticated"
            (click)="logout()"
            [disabled]="isLoggingOut"
          >
            {{ isLoggingOut ? i18n.t('nav.logout.pending') : i18n.t('nav.logout') }}
          </button>
        </nav>
      </header>

      <section class="hero hero-graffiti">
        <svg class="doodle doodle-sun" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <path
            d="M32 6 V14 M32 50 V58 M6 32 H14 M50 32 H58 M12 12 L18 18 M46 46 L52 52 M52 12 L46 18 M12 52 L18 46"
            stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>

        <svg class="doodle doodle-paw" viewBox="0 0 60 60" aria-hidden="true">
          <ellipse cx="15" cy="20" rx="5" ry="7" fill="currentColor"/>
          <ellipse cx="28" cy="12" rx="5" ry="7" fill="currentColor"/>
          <ellipse cx="42" cy="16" rx="5" ry="7" fill="currentColor"/>
          <ellipse cx="50" cy="30" rx="4.5" ry="6" fill="currentColor"/>
          <path d="M18 35 Q 30 28 44 36 Q 48 46 32 50 Q 16 46 18 35 Z" fill="currentColor"/>
        </svg>

        <svg class="doodle doodle-grass" viewBox="0 0 120 40" aria-hidden="true">
          <path
            d="M6 38 L10 14 L14 38 M22 38 L26 20 L30 38 M38 38 L42 10 L46 38 M54 38 L58 18 L62 38 M70 38 L74 14 L78 38 M86 38 L90 22 L94 38 M102 38 L106 12 L110 38"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        <svg class="doodle doodle-heart" viewBox="0 0 48 48" aria-hidden="true">
          <path
            d="M24 40 C 8 28, 6 14, 16 10 C 22 8, 24 14, 24 16 C 24 14, 26 8, 32 10 C 42 14, 40 28, 24 40 Z"
            fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>

        <svg class="doodle doodle-scribble" viewBox="0 0 90 30" aria-hidden="true">
          <path
            d="M4 24 C 14 4, 22 28, 34 8 S 56 26, 68 10 S 86 22, 88 14"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>

        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>

        <h1 class="hero-title" [attr.aria-label]="settings.heroTagline">
          <span
            *ngFor="let ch of splitChars(settings.heroTagline); let i = index"
            class="chr"
            [class.space]="ch === ' '"
            aria-hidden="true"
          >{{ ch }}</span>
        </h1>

        <p class="hero-about" [attr.aria-label]="settings.aboutText">
          <span
            *ngFor="let ch of splitChars(settings.aboutText); let i = index"
            class="chr sub"
            [class.space]="ch === ' '"
            aria-hidden="true"
          >{{ ch }}</span>
          <svg class="underline-squiggle" viewBox="0 0 240 10" aria-hidden="true" preserveAspectRatio="none">
            <path
              d="M2 6 Q 15 2 28 6 T 54 6 T 80 6 T 106 6 T 132 6 T 158 6 T 184 6 T 210 6 T 236 6"
              fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </p>
      </section>

      <section class="profile-card">
        <h2>{{ i18n.t('home.profile.heading', { name: settings.profileName }) }}</h2>
        <p>{{ settings.aboutText }}</p>
        <p class="contact" *ngIf="settings.showContactEmail && settings.contactEmail">
          {{ i18n.t('home.profile.contact') }}
          <a [href]="'mailto:' + settings.contactEmail">{{ settings.contactEmail }}</a>
        </p>
        <p class="message" *ngIf="settingsMessage">{{ settingsMessage }}</p>
      </section>

      <section id="story" class="story-section">
        <app-story-timeline></app-story-timeline>
      </section>
    </main>
  `,
  styles: `
    .home {
      min-height: 100vh;
      padding: 20px;
      background: var(--color-app-bg);
      overflow-x: clip;
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
      color: var(--color-ink);
      font-weight: 800;
      text-decoration: none;
      letter-spacing: 0.02em;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      object-fit: cover;
    }

    nav {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }

    nav a,
    .nav-logout {
      display: inline-flex;
      align-items: center;
      height: 34px;
      color: var(--color-ink-soft);
      text-decoration: none;
      border: 1px solid var(--color-line);
      border-radius: 999px;
      padding: 0 14px;
      background: var(--color-paper);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    nav a:hover,
    .nav-logout:hover:not(:disabled) {
      background: var(--color-accent);
      border-color: var(--color-ink);
      color: var(--color-ink);
      transform: translateY(-1px);
    }

    nav a:active,
    .nav-logout:active:not(:disabled) {
      transform: translateY(0);
    }

    .nav-logout:disabled { opacity: 0.5; cursor: not-allowed; }

    .hero {
      width: min(1100px, 100%);
      margin: 0 auto;
      border: 2px solid var(--color-ink);
      border-radius: 22px;
      padding: clamp(28px, 5vw, 48px);
      background: var(--color-accent);
      box-shadow: 6px 6px 0 var(--color-ink);
    }

    .hero-graffiti {
      position: relative;
      overflow: hidden;
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      font-weight: 800;
      color: var(--color-ink);
      position: relative;
      z-index: 2;
    }

    .hero-title {
      margin: 14px 0 22px;
      font-family: 'Kalam', 'Caveat', 'Segoe Script', cursive;
      font-weight: 700;
      font-size: clamp(34px, 5.4vw, 58px);
      line-height: 1.05;
      max-width: 18ch;
      position: relative;
      z-index: 2;
      word-break: break-word;
      color: var(--color-ink);
    }

    .hero-title .chr {
      display: inline-block;
      transition: transform 240ms ease;
      color: var(--color-ink);
    }

    .hero-title .chr.space {
      width: 0.32em;
    }

    .hero-title .chr:hover {
      transform: translateY(-3px) rotate(-4deg) !important;
    }

    .hero-title .chr:nth-child(6n+1) { transform: rotate(-3deg) translateY(-1px); }
    .hero-title .chr:nth-child(6n+2) { transform: rotate(2deg) translateY(1px); }
    .hero-title .chr:nth-child(6n+3) { transform: rotate(-1deg); }
    .hero-title .chr:nth-child(6n+4) { transform: rotate(3deg) translateY(-2px); color: var(--color-accent-contrast); }
    .hero-title .chr:nth-child(6n+5) { transform: rotate(-2deg) translateY(2px); }
    .hero-title .chr:nth-child(6n+6) { transform: rotate(1deg); }

    .hero-about {
      position: relative;
      margin: 0;
      max-width: 48ch;
      font-family: 'Caveat', 'Segoe Script', cursive;
      font-size: 22px;
      line-height: 1.35;
      color: var(--color-ink-soft);
      padding-bottom: 14px;
      z-index: 2;
    }

    .hero-about .chr.sub {
      display: inline-block;
      color: var(--color-ink-soft);
    }

    .hero-about .chr.sub:nth-child(7n+3) { color: var(--color-ink); }
    .hero-about .chr.sub:nth-child(11n+5) { color: var(--color-accent-contrast); }

    .hero-about .chr.sub.space {
      width: 0.28em;
    }

    .underline-squiggle {
      position: absolute;
      left: 0;
      bottom: -2px;
      width: min(320px, 70%);
      height: 10px;
      pointer-events: none;
    }

    .doodle {
      position: absolute;
      pointer-events: none;
      opacity: 0.9;
      z-index: 1;
      color: var(--color-ink);
    }

    .doodle-sun {
      top: 18px;
      right: 24px;
      width: 70px;
      height: 70px;
      animation: sun-spin 22s linear infinite;
      color: var(--color-ink);
    }

    @keyframes sun-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .doodle-paw {
      top: 30%;
      right: 12%;
      width: 56px;
      height: 56px;
      opacity: 0.75;
      transform: rotate(-16deg);
      color: var(--color-accent-contrast);
    }

    .doodle-grass {
      bottom: 10px;
      right: 18px;
      width: 140px;
      height: 38px;
      opacity: 0.9;
      color: var(--color-ink);
    }

    .doodle-heart {
      bottom: 24px;
      left: 26px;
      width: 44px;
      height: 44px;
      opacity: 0.85;
      transform: rotate(-8deg);
      color: var(--color-accent-contrast);
    }

    .doodle-scribble {
      top: 28px;
      left: 44%;
      width: 110px;
      height: 30px;
      opacity: 0.55;
      transform: rotate(4deg);
      color: var(--color-ink);
    }

    .underline-squiggle {
      color: var(--color-ink);
    }

    @media (max-width: 640px) {
      .doodle-paw,
      .doodle-scribble {
        display: none;
      }
      .doodle-sun { width: 48px; height: 48px; top: 10px; right: 12px; }
      .doodle-grass { width: 90px; right: 10px; bottom: 6px; }
      .doodle-heart { width: 30px; height: 30px; bottom: 12px; left: 14px; }
    }

    .profile-card {
      width: min(1100px, 100%);
      margin: 20px auto 0;
      border: 2px solid var(--color-ink);
      border-radius: 18px;
      background: var(--color-paper);
      padding: 22px;
      box-shadow: 4px 4px 0 var(--color-ink);
    }

    .profile-card h2 {
      margin: 0;
      color: var(--color-ink);
    }

    .profile-card p {
      margin: 8px 0 0;
      color: var(--color-ink-soft);
    }

    .contact a {
      color: var(--color-ink);
      text-decoration: underline;
      text-decoration-color: var(--color-accent);
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
      font-weight: 700;
    }

    .message {
      color: var(--color-ink-muted);
      font-size: 14px;
    }

    .story-section {
      width: min(1100px, 100%);
      margin: 28px auto 0;
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
    }

    @media (max-width: 428px) {
      .home { padding: 16px; }

      .top-nav {
        padding: 6px 0 14px;
      }

      nav {
        gap: 8px;
      }

      nav a,
      .nav-logout {
        height: 44px;
        padding: 0 14px;
        font-size: 14px;
      }

      .hero {
        padding: clamp(20px, 5vw, 32px);
        box-shadow: 4px 4px 0 var(--color-ink);
      }

      .hero-title {
        font-size: clamp(28px, 8vw, 38px);
        line-height: 1.15;
        margin: 12px 0 18px;
        max-width: 100%;
        word-break: break-word;
      }

      .hero-title .chr {
        transform: none !important;
        color: var(--color-ink) !important;
      }

      .hero-about {
        font-size: 19px;
        line-height: 1.4;
        max-width: 100%;
        word-break: break-word;
        hyphens: auto;
      }

      .hero-about .chr.sub {
        color: var(--color-ink-soft) !important;
      }

      .underline-squiggle {
        width: min(260px, 80%);
      }

      .profile-card {
        padding: 18px;
      }
    }

    @media (max-width: 390px) {
      .home { padding: 14px; }

      nav a,
      .nav-logout {
        padding: 0 12px;
        font-size: 13px;
      }

      .doodle-grass { width: 72px; right: 8px; }
      .doodle-sun { width: 40px; height: 40px; }
    }

    @media (max-width: 360px) {
      .brand-mark {
        width: 30px;
        height: 30px;
      }

      .doodle-grass,
      .doodle-heart {
        display: none;
      }

      .hero-title { font-size: 26px; }
      .hero-about { font-size: 17px; }
    }

    @media (min-width: 1280px) {
      .home {
        padding: 28px 32px;
      }
    }
  `
})
export class HomePageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiBaseUrl = resolveApiBaseUrl();
  settings: SiteSettings = { ...DEFAULT_SITE_SETTINGS };
  settingsMessage = '';
  isLoggingOut = false;

  splitChars(input: string): string[] {
    return Array.from(String(input || ''));
  }

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
      await this.loadSettings();
    } catch {
      this.settings = { ...DEFAULT_SITE_SETTINGS };
      this.settingsMessage = this.i18n.t('home.settings.loadError');
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

  private async loadSettings(): Promise<void> {
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
      payload.source === 'default' ? this.i18n.t('home.settings.defaultsNote') : '';
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




