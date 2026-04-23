import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewRef, inject } from '@angular/core';
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
      <div class="bg-doodle-layer" aria-hidden="true">
        <svg class="chalk-cloud cloud-a" viewBox="0 0 420 210" preserveAspectRatio="xMidYMid meet">
          <path class="cloud-fill" d="M58 150 C 48 112, 72 86, 110 84 C 121 58, 153 44, 188 50 C 214 28, 254 30, 281 52 C 321 42, 356 66, 360 102 C 390 108, 404 132, 394 156 C 382 184, 344 190, 312 181 L 106 181 C 78 188, 62 174, 58 150 Z" />
          <path class="cloud-outline" d="M58 150 C 48 112, 72 86, 110 84 C 121 58, 153 44, 188 50 C 214 28, 254 30, 281 52 C 321 42, 356 66, 360 102 C 390 108, 404 132, 394 156 C 382 184, 344 190, 312 181 L 106 181 C 78 188, 62 174, 58 150 Z" />
          <path class="cloud-sketch" d="M95 145 C 92 123, 108 106, 136 106 M165 99 C 188 83, 216 85, 238 100 M272 102 C 296 92, 320 102, 333 122" />
        </svg>
        <svg class="chalk-cloud cloud-b" viewBox="0 0 420 210" preserveAspectRatio="xMidYMid meet">
          <path class="cloud-fill" d="M44 144 C 42 116, 62 96, 90 95 C 102 66, 129 53, 160 58 C 181 32, 218 31, 244 52 C 276 46, 307 62, 320 90 C 352 90, 377 110, 379 137 C 382 170, 355 186, 325 182 L 110 182 C 70 188, 50 173, 44 144 Z" />
          <path class="cloud-outline" d="M44 144 C 42 116, 62 96, 90 95 C 102 66, 129 53, 160 58 C 181 32, 218 31, 244 52 C 276 46, 307 62, 320 90 C 352 90, 377 110, 379 137 C 382 170, 355 186, 325 182 L 110 182 C 70 188, 50 173, 44 144 Z" />
          <path class="cloud-sketch" d="M88 138 C 94 117, 112 104, 140 106 M171 99 C 193 86, 224 87, 248 101 M276 104 C 300 97, 320 108, 334 126" />
        </svg>
        <svg class="chalk-lines" viewBox="0 0 1200 900" preserveAspectRatio="none">
          <path d="M40 230 C 170 170, 320 310, 500 230 S 860 170, 1160 250" />
          <path d="M60 620 C 260 540, 430 700, 640 610 S 980 520, 1140 660" />
          <path d="M120 770 C 290 710, 430 850, 620 770 S 940 700, 1120 790" />
        </svg>
      </div>

      <header class="top-nav" [class.top-nav-sticky]="isNavSticky">
        <a class="brand" [class.is-active]="activeTopLink === 'brand'" [routerLink]="['/']">
          <img src="favicon-192.png" alt="" class="brand-mark" width="36" height="36" />
          <span>{{ settings.profileName }} {{ i18n.t('brand.journal') }}</span>
        </a>
        <nav>
          <a
            [routerLink]="['/']"
            fragment="story"
            [class.is-active]="activeTopLink === 'story'"
            [attr.aria-current]="activeTopLink === 'story' ? 'location' : null"
          >{{ i18n.t('nav.story') }}</a>
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

      <section
        #heroRoot
        class="hero hero-graffiti hero-entrance"
        [class.hero-enter-ready]="heroEntranceReady"
        [class.hero-reduced-motion]="prefersReducedMotion"
      >
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

      <a
        *ngIf="auth.isPublisherOrAdmin"
        class="floating-create"
        [routerLink]="['/manage-media']"
        [attr.aria-label]="i18n.t('media.upload.submit')"
      >
        <span class="plus" aria-hidden="true">+</span>
        <span>{{ i18n.t('media.upload.submit') }}</span>
      </a>
    </main>
  `,
  styles: `
    .home {
      min-height: 100vh;
      padding: 20px;
      background: var(--color-app-bg);
      overflow-x: clip;
      position: relative;
      isolation: isolate;
    }

    .bg-doodle-layer {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      overflow: hidden;
    }

    .chalk-cloud {
      position: absolute;
      width: min(74vw, 640px);
      height: auto;
      opacity: 0.94;
      filter: drop-shadow(0 3px 0 var(--fx-chalk-cloud-shadow));
    }

    .chalk-cloud .cloud-fill {
      fill: var(--fx-chalk-cloud-fill);
      stroke: var(--fx-chalk-cloud-stroke);
      stroke-width: 6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .chalk-cloud .cloud-outline {
      fill: none;
      stroke: var(--fx-chalk-cloud-outline);
      stroke-width: 7;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 10 8;
    }

    .chalk-cloud .cloud-sketch {
      fill: none;
      stroke: var(--fx-chalk-cloud-sketch);
      stroke-width: 4.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 7 10;
    }

    .cloud-a {
      top: 6%;
      left: -6%;
      animation: cloud-a-drift 30s ease-in-out infinite alternate;
    }

    .cloud-b {
      right: -8%;
      top: 34%;
      width: min(68vw, 600px);
      animation: cloud-b-drift 34s ease-in-out infinite alternate;
    }

    .chalk-lines {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.24;
    }

    .chalk-lines path {
      fill: none;
      stroke: var(--fx-chalk-lines-stroke);
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-dasharray: 14 18;
      stroke-dashoffset: 340;
      animation: chalk-sketch 19s linear infinite;
    }

    .chalk-lines path:nth-child(2) {
      animation-delay: -7s;
    }

    .chalk-lines path:nth-child(3) {
      animation-delay: -12s;
    }

    .top-nav,
    .hero,
    .profile-card,
    .story-section,
    .floating-create {
      position: relative;
      z-index: 2;
    }

    .top-nav {
      width: min(1100px, 100%);
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 10px 0 18px;
      position: sticky;
      top: 8px;
      z-index: 30;
      border-radius: 18px;
      transition:
        background-color var(--motion-duration-standard) var(--motion-ease-standard),
        border-color var(--motion-duration-standard) var(--motion-ease-standard),
        box-shadow var(--motion-duration-standard) var(--motion-ease-standard),
        backdrop-filter var(--motion-duration-standard) var(--motion-ease-standard);
      border: 1px solid transparent;
    }

    .top-nav.top-nav-sticky {
      padding: 10px 14px;
      background: var(--color-surface-glass-86);
      border-color: var(--color-line);
      box-shadow: 0 10px 24px var(--fx-shadow-cool-08);
      backdrop-filter: blur(10px);
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

    .brand.is-active,
    nav a.is-active {
      color: var(--color-ink);
      border-color: var(--color-ink);
      background: var(--color-accent-soft);
      box-shadow: 0 0 0 2px var(--fx-warm-glow-45);
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
      transition:
        background var(--motion-duration-fast) var(--motion-ease-standard),
        color var(--motion-duration-fast) var(--motion-ease-standard),
        border-color var(--motion-duration-fast) var(--motion-ease-standard),
        transform var(--motion-duration-fast) var(--motion-ease-standard);
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
      isolation: isolate;
      --hero-parallax-x: 0px;
      --hero-parallax-y: 0px;
      --hero-parallax-soft-x: 0px;
      --hero-parallax-soft-y: 0px;
      background: var(--fx-hero-gradient-base);
    }

    .hero-graffiti::before,
    .hero-graffiti::after {
      content: '';
      position: absolute;
      inset: -25%;
      pointer-events: none;
    }

    .hero-graffiti::before {
      z-index: 0;
      background:
        var(--fx-hero-glow-a),
        var(--fx-hero-glow-b),
        var(--fx-hero-glow-c);
      animation: hero-ambient-cycle 32s ease-in-out infinite alternate;
    }

    .hero-graffiti::after {
      z-index: 1;
      inset: 0;
      background: var(--fx-hero-overlay);
      transform: translate3d(var(--hero-parallax-soft-x), var(--hero-parallax-soft-y), 0);
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

    .hero-entrance .eyebrow,
    .hero-entrance .hero-title,
    .hero-entrance .hero-about {
      opacity: 0;
      transform: translateY(14px);
      transition: opacity 520ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .hero-entrance .doodle {
      opacity: 0;
      transition: opacity 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .hero-entrance.hero-enter-ready .eyebrow,
    .hero-entrance.hero-enter-ready .hero-title,
    .hero-entrance.hero-enter-ready .hero-about {
      opacity: 1;
      transform: translateY(0);
    }

    .hero-entrance.hero-enter-ready .doodle {
      opacity: var(--doodle-opacity, 0.9);
    }

    .hero-entrance .eyebrow { transition-delay: 40ms; }
    .hero-entrance .hero-title { transition-delay: 150ms; }
    .hero-entrance .hero-about { transition-delay: 280ms; }
    .hero-entrance .doodle { transition-delay: 450ms; }

    .hero-about .chr.sub {
      display: inline-block;
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
      opacity: var(--doodle-opacity, 0.9);
      z-index: 1;
      color: var(--color-ink);
      transform: translate3d(
        calc(var(--hero-parallax-x, 0px) * var(--doodle-parallax-x, 0)),
        calc(var(--hero-parallax-y, 0px) * var(--doodle-parallax-y, 0)),
        0
      ) rotate(var(--doodle-rotate, 0deg));
    }

    .doodle-sun {
      top: 18px;
      right: 24px;
      width: 70px;
      height: 70px;
      animation: sun-spin 22s linear infinite;
      --doodle-opacity: 0.9;
      --doodle-parallax-x: 0;
      --doodle-parallax-y: 0;
      --doodle-rotate: 0deg;
    }

    .doodle-paw {
      top: 30%;
      right: 12%;
      width: 56px;
      height: 56px;
      --doodle-opacity: 0.75;
      --doodle-parallax-x: 0.56;
      --doodle-parallax-y: 0.9;
      --doodle-rotate: -16deg;
      color: var(--color-accent-contrast);
    }

    .doodle-grass {
      bottom: 10px;
      right: 18px;
      width: 140px;
      height: 38px;
      --doodle-opacity: 0.9;
      --doodle-parallax-x: 0.34;
      --doodle-parallax-y: 0.54;
    }

    .doodle-heart {
      bottom: 24px;
      left: 26px;
      width: 44px;
      height: 44px;
      --doodle-opacity: 0.85;
      --doodle-parallax-x: -0.46;
      --doodle-parallax-y: 0.7;
      --doodle-rotate: -8deg;
      color: var(--color-accent-contrast);
    }

    .doodle-scribble {
      top: 28px;
      left: 44%;
      width: 110px;
      height: 30px;
      --doodle-opacity: 0.55;
      --doodle-parallax-x: -0.62;
      --doodle-parallax-y: 0.42;
      --doodle-rotate: 4deg;
    }

    .underline-squiggle {
      color: var(--color-ink);
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
      animation: status-feedback-in var(--motion-duration-standard) var(--motion-ease-emphasized);
    }

    .story-section {
      width: min(1100px, 100%);
      margin: 28px auto 0;
    }

    .floating-create {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 40;
      min-height: 48px;
      padding: 0 16px 0 14px;
      border-radius: 999px;
      border: 2px solid var(--color-ink);
      background: var(--color-accent);
      color: var(--color-ink);
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 4px 4px 0 var(--color-ink);
      transition:
        transform var(--motion-duration-fast) var(--motion-ease-standard),
        box-shadow var(--motion-duration-fast) var(--motion-ease-standard),
        background var(--motion-duration-fast) var(--motion-ease-standard);
    }

    .floating-create .plus {
      font-size: 19px;
      line-height: 1;
      font-weight: 700;
    }

    .floating-create:hover {
      transform: translateY(-2px);
      box-shadow: 6px 6px 0 var(--color-ink);
      background: var(--color-accent-soft);
    }

    .floating-create:active {
      transform: translateY(0);
      box-shadow: 3px 3px 0 var(--color-ink);
    }

  `
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroRoot') private heroRoot?: ElementRef<HTMLElement>;
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiBaseUrl = resolveApiBaseUrl();
  settings: SiteSettings = { ...DEFAULT_SITE_SETTINGS };
  settingsMessage = '';
  isLoggingOut = false;
  isNavSticky = false;
  activeTopLink: 'brand' | 'story' = 'brand';
  heroEntranceReady = false;
  readonly prefersReducedMotion = this.checkPrefersReducedMotion();
  private parallaxFrameId: number | null = null;

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

  ngAfterViewInit(): void {
    this.bindNavScrollState();
    this.scheduleHeroParallaxUpdate();

    if (this.prefersReducedMotion) {
      this.heroEntranceReady = true;
      this.safeDetectChanges();
      return;
    }

    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => window.setTimeout(cb, 0);

    schedule(() => {
      this.heroEntranceReady = true;
      this.safeDetectChanges();
    });
  }

  ngOnDestroy(): void {
    this.unbindNavScrollState();
    if (this.parallaxFrameId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.parallaxFrameId);
      } else if (typeof window !== 'undefined') {
        window.clearTimeout(this.parallaxFrameId);
      }
      this.parallaxFrameId = null;
    }
  }

  private safeDetectChanges(): void {
    const viewRef = this.cdr as ViewRef;
    if (!viewRef.destroyed) {
      this.cdr.detectChanges();
    }
  }

  private readonly onViewportChange = (): void => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSticky = window.scrollY >= 64;
    const nextActive = this.resolveActiveTopLink();
    if (nextSticky === this.isNavSticky && nextActive === this.activeTopLink) {
      return;
    }

    this.isNavSticky = nextSticky;
    this.activeTopLink = nextActive;
    this.safeDetectChanges();
  };

  private readonly onViewportTick = (): void => {
    this.onViewportChange();
    this.scheduleHeroParallaxUpdate();
  };

  private bindNavScrollState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('scroll', this.onViewportTick, { passive: true });
    window.addEventListener('resize', this.onViewportTick);
    this.onViewportTick();
  }

  private unbindNavScrollState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('scroll', this.onViewportTick);
    window.removeEventListener('resize', this.onViewportTick);
  }

  private resolveActiveTopLink(): 'brand' | 'story' {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return 'brand';
    }

    const storySection = document.getElementById('story');
    if (!storySection) {
      return 'brand';
    }

    const rect = storySection.getBoundingClientRect();
    const activationLine = Math.max(120, window.innerHeight * 0.34);
    const isStoryInFocus = rect.top <= activationLine && rect.bottom > 120;
    return isStoryInFocus ? 'story' : 'brand';
  }

  private checkPrefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private scheduleHeroParallaxUpdate(): void {
    if (this.parallaxFrameId !== null) {
      return;
    }

    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => window.setTimeout(cb, 16);

    this.parallaxFrameId = schedule(() => {
      this.parallaxFrameId = null;
      this.updateHeroParallax();
    });
  }

  private updateHeroParallax(): void {
    const hero = this.heroRoot?.nativeElement;
    if (!hero) {
      return;
    }

    if (this.prefersReducedMotion || typeof window === 'undefined') {
      this.applyHeroParallax(hero, 0, 0);
      return;
    }

    const viewportHeight = Math.max(1, window.innerHeight || 1);
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < -120 || rect.top > viewportHeight + 120) {
      this.applyHeroParallax(hero, 0, 0);
      return;
    }

    const centerOffset = rect.top + rect.height * 0.5 - viewportHeight * 0.48;
    const normalized = Math.max(-1, Math.min(1, centerOffset / viewportHeight));
    const maxShift = window.innerWidth <= 640 ? 8 : 14;
    const parallaxY = -normalized * maxShift;
    const parallaxX = Math.sin(window.scrollY * 0.006) * maxShift * 0.4;
    this.applyHeroParallax(hero, parallaxX, parallaxY);
  }

  private applyHeroParallax(hero: HTMLElement, x: number, y: number): void {
    hero.style.setProperty('--hero-parallax-x', `${x.toFixed(2)}px`);
    hero.style.setProperty('--hero-parallax-y', `${y.toFixed(2)}px`);
    hero.style.setProperty('--hero-parallax-soft-x', `${(x * 0.45).toFixed(2)}px`);
    hero.style.setProperty('--hero-parallax-soft-y', `${(y * 0.38).toFixed(2)}px`);
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




