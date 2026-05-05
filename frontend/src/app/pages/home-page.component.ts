import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, ViewRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { resolveApiBaseUrl } from '../core/runtime-config';
import { LanguagePickerComponent } from '../components/language-picker.component';

type SiteSettings = {
  profileName: string;
  heroTagline: string;
  aboutText: string;
  contactEmail: string;
  showContactEmail: boolean;
};

type TimelineMediaItem = {
  id: string | number;
  type: 'image' | 'video';
  title: string;
  description: string;
  mediaUrl: string;
  displayDate: string | null;
  createdAt: string | null;
  likesCount: number;
  commentsCount: number;
};

const LIKED_STORAGE_KEY = 'nanami.story.likes';

type MediaComment = {
  id: string | number;
  author_name: string;
  message: string;
  created_at: string;
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
  imports: [CommonModule, FormsModule, RouterLink, LanguagePickerComponent],
  template: `
    <main class="home" [class.theme-night]="theme === 'night'">
      <div class="bg-doodle-layer" aria-hidden="true">
        <svg class="chalk-lines" viewBox="0 0 1200 900" preserveAspectRatio="none">
          <path d="M40 230 C 170 170, 320 310, 500 230 S 860 170, 1160 250" />
          <path d="M60 620 C 260 540, 430 700, 640 610 S 980 520, 1140 660" />
          <path d="M120 770 C 290 710, 430 850, 620 770 S 940 700, 1120 790" />
        </svg>
      </div>

      <div class="cloud-back-layer" aria-hidden="true">
        <svg class="chalk-cloud cloud-b" viewBox="0 0 420 210" preserveAspectRatio="xMidYMid meet">
          <path class="cloud-fill" d="M44 144 C 42 116, 62 96, 90 95 C 102 66, 129 53, 160 58 C 181 32, 218 31, 244 52 C 276 46, 307 62, 320 90 C 352 90, 377 110, 379 137 C 382 170, 355 186, 325 182 L 110 182 C 70 188, 50 173, 44 144 Z" />
          <path class="cloud-outline" d="M44 144 C 42 116, 62 96, 90 95 C 102 66, 129 53, 160 58 C 181 32, 218 31, 244 52 C 276 46, 307 62, 320 90 C 352 90, 377 110, 379 137 C 382 170, 355 186, 325 182 L 110 182 C 70 188, 50 173, 44 144 Z" />
          <path class="cloud-sketch" d="M88 138 C 94 117, 112 104, 140 106 M171 99 C 193 86, 224 87, 248 101 M276 104 C 300 97, 320 108, 334 126" />
        </svg>
      </div>

      <div class="cloud-overlay" aria-hidden="true">
        <svg class="chalk-cloud cloud-a" viewBox="0 0 420 210" preserveAspectRatio="xMidYMid meet">
          <path class="cloud-fill" d="M58 150 C 48 112, 72 86, 110 84 C 121 58, 153 44, 188 50 C 214 28, 254 30, 281 52 C 321 42, 356 66, 360 102 C 390 108, 404 132, 394 156 C 382 184, 344 190, 312 181 L 106 181 C 78 188, 62 174, 58 150 Z" />
          <path class="cloud-outline" d="M58 150 C 48 112, 72 86, 110 84 C 121 58, 153 44, 188 50 C 214 28, 254 30, 281 52 C 321 42, 356 66, 360 102 C 390 108, 404 132, 394 156 C 382 184, 344 190, 312 181 L 106 181 C 78 188, 62 174, 58 150 Z" />
          <path class="cloud-sketch" d="M95 145 C 92 123, 108 106, 136 106 M165 99 C 188 83, 216 85, 238 100 M272 102 C 296 92, 320 102, 333 122" />
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
        <img class="doodle doodle-sun" [src]="theme === 'night' ? '月亮.png' : '太阳.png'" alt="" aria-hidden="true" [class.is-moon]="theme === 'night'" />

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

        <ng-container *ngIf="currentHeroMedia as item">
          <div
            class="kite-frame"
            [attr.data-kite-frame]="kiteFrame"
            role="button"
            tabindex="0"
            [attr.aria-label]="item.title || settings.profileName"
            (click)="openMediaDetail(item)"
            (keydown.enter)="openMediaDetail(item)"
            (keydown.arrowleft)="showOlderMedia()"
            (keydown.arrowright)="showNewerMedia()"
            (pointerdown)="onHeroPointerDown($event)"
            (pointermove)="onHeroPointerMove($event)"
            (pointerup)="onHeroPointerUp($event)"
            (pointercancel)="onHeroPointerCancel()"
          >
            <img class="kite-bg" [class.is-active]="kiteFrame === 1" src="走路1.png" alt="" aria-hidden="true" />
            <img class="kite-bg" [class.is-active]="kiteFrame === 2" src="走路2.png" alt="" aria-hidden="true" />
            <img class="kite-bg" [class.is-active]="kiteFrame === 3" src="走路3.png" alt="" aria-hidden="true" />
            <img class="kite-bg" [class.is-active]="kiteFrame === 4" src="走路4.png" alt="" aria-hidden="true" />
            <img
              *ngIf="item.type === 'image'"
              class="kite-photo"
              [src]="item.mediaUrl"
              [alt]="item.title || settings.profileName"
            />
            <video
              *ngIf="item.type === 'video'"
              class="kite-photo"
              [src]="item.mediaUrl"
              muted
              playsinline
              autoplay
              loop
            ></video>
            <div class="kite-caption">{{ item.title || settings.profileName }}</div>
            <div
              class="date-stack"
              aria-hidden="true"
              [class.is-step-forward]="mediaSwitchDirection === 'forward'"
              [class.is-step-backward]="mediaSwitchDirection === 'backward'"
            >
              <div class="date-item date-next">{{ formatMediaDate(nextMedia) }}</div>
              <div class="date-item date-current">{{ formatMediaDate(currentHeroMedia) }}</div>
              <div class="date-item date-prev">{{ formatMediaDate(prevMedia) }}</div>
            </div>
          </div>
        </ng-container>
      </section>

      <div
        class="media-modal-mask"
        *ngIf="selectedMedia as item"
        role="dialog"
        aria-modal="true"
        (click)="closeMediaDetail()"
      >
        <section class="media-modal" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="media-modal-close"
            (click)="closeMediaDetail()"
            [attr.aria-label]="i18n.t('story.comment.modal.close')"
          >×</button>
          <div class="media-modal-image">
            <img *ngIf="item.type === 'image'" [src]="item.mediaUrl" [alt]="item.title" />
            <video *ngIf="item.type === 'video'" [src]="item.mediaUrl" controls playsinline></video>
          </div>
          <aside class="media-modal-info">
            <h2 class="media-modal-title">{{ item.title || settings.profileName }}</h2>
            <p class="media-modal-date" *ngIf="item.displayDate">{{ item.displayDate }}</p>
            <p class="media-modal-desc" *ngIf="item.description">{{ item.description }}</p>

            <div class="media-actions">
              <button
                type="button"
                class="like-button"
                [class.is-liked]="isLiked(item)"
                [disabled]="isLikePending(item)"
                (click)="toggleLike(item)"
                [attr.aria-pressed]="isLiked(item)"
                [attr.aria-label]="i18n.t(isLiked(item) ? 'story.like.unlike' : 'story.like.like', { title: item.title || settings.profileName })"
              >
                <span class="like-heart" aria-hidden="true">{{ isLiked(item) ? '♥' : '♡' }}</span>
                <span class="like-count">{{ item.likesCount }}</span>
              </button>
              <span class="comment-count" [attr.aria-label]="i18n.t('story.comment.label')">
                <span aria-hidden="true">💬</span>
                <span>{{ mediaComments.length || item.commentsCount }}</span>
              </span>
            </div>

            <section class="media-comments">
              <h3 class="media-comments-heading">{{ i18n.t('story.comment.modal.title') }}</h3>
              <p class="comments-state" *ngIf="isLoadingComments">{{ i18n.t('story.comment.modal.loading') }}</p>
              <p class="comments-state" *ngIf="commentsLoadError && !isLoadingComments">{{ commentsLoadError }}</p>
              <ul
                class="media-comment-list"
                *ngIf="!isLoadingComments && mediaComments.length > 0"
              >
                <li *ngFor="let c of mediaComments">
                  <div class="comment-meta">
                    <strong>{{ c.author_name }}</strong>
                    <span>{{ c.created_at }}</span>
                  </div>
                  <p class="comment-message">{{ c.message }}</p>
                </li>
              </ul>
              <p
                class="comments-state comments-empty"
                *ngIf="!isLoadingComments && !commentsLoadError && mediaComments.length === 0"
              >{{ i18n.t('story.comment.modal.empty') }}</p>

              <form class="media-comment-form" (ngSubmit)="submitMediaComment()">
                <input
                  *ngIf="!auth.isAuthenticated"
                  type="text"
                  class="comment-author"
                  [(ngModel)]="mediaCommentAuthor"
                  name="author"
                  maxlength="60"
                  [placeholder]="i18n.t('story.comment.modal.authorPlaceholder')"
                  [disabled]="isSubmittingComment"
                />
                <textarea
                  class="comment-textarea"
                  [(ngModel)]="mediaCommentDraft"
                  name="message"
                  rows="3"
                  maxlength="800"
                  [placeholder]="i18n.t('story.comment.modal.placeholder')"
                  [disabled]="isSubmittingComment"
                ></textarea>
                <p class="comment-error" *ngIf="mediaCommentError">{{ mediaCommentError }}</p>
                <p class="comment-success" *ngIf="mediaCommentSuccess">{{ mediaCommentSuccess }}</p>
                <div class="comment-form-actions">
                  <button type="submit" [disabled]="isSubmittingComment">
                    {{ isSubmittingComment ? i18n.t('story.comment.modal.submitting') : i18n.t('story.comment.modal.submit') }}
                  </button>
                </div>
              </form>
            </section>
          </aside>
        </section>
      </div>

      <div class="street-ring-section" aria-hidden="true">
        <div class="street-ring-viewport">
          <img
            [src]="theme === 'night' ? '晚上建筑.png' : '白天建筑.png'"
            alt=""
            class="ring-layer ring-buildings"
            [class.ring-wheel-animating]="ringStepDirection !== null"
            [style.transform]="'translate(-50%, 50%) rotate(' + (ringRotationDeg * 0.5) + 'deg)'"
          />
          <img
            [src]="theme === 'night' ? '晚上商店.png' : '白天商店.png'"
            alt=""
            class="ring-layer ring-shops"
            [class.ring-wheel-animating]="ringStepDirection !== null"
            [style.transform]="'translate(-50%, 50%) rotate(' + ringRotationDeg + 'deg)'"
          />
          <img
            src="街道.png"
            alt=""
            class="ring-layer ring-streets"
            [class.ring-wheel-animating]="ringStepDirection !== null"
            [style.transform]="'translate(-50%, 50%) rotate(' + (ringRotationDeg * 1.6) + 'deg)'"
            (transitionend)="onRingStepAnimationEnd()"
          />
        </div>
      </div>

      <div class="hero-stage-actions" aria-label="Carousel controls">
        <button type="button" (click)="showOlderMedia()" [disabled]="!canShowOlderMedia()" aria-label="Older">‹</button>
        <button type="button" (click)="showNewerMedia()" [disabled]="!canShowNewerMedia()" aria-label="Newer">›</button>
      </div>

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
  styleUrl: "./home-page.component.scss"
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
  heroMediaItems: TimelineMediaItem[] = [];
  heroMediaIndex = 0;
  heroEntranceReady = false;
  readonly prefersReducedMotion = this.checkPrefersReducedMotion();
  private parallaxFrameId: number | null = null;
  ringStepDirection: 'forward' | 'backward' | null = null;
  ringRotationDeg = 0;
  private activePointerId: number | null = null;
  private pointerStartX = 0;
  private pointerCurrentX = 0;

  kiteFrame: 1 | 2 | 3 | 4 = 1;
  mediaSwitchDirection: 'forward' | 'backward' | null = null;
  private mediaSwitchResetId: ReturnType<typeof setTimeout> | null = null;

  theme: 'day' | 'night' = 'day';
  private themeWatchId: ReturnType<typeof setInterval> | null = null;

  selectedMedia: TimelineMediaItem | null = null;
  mediaComments: MediaComment[] = [];
  mediaCommentDraft = '';
  mediaCommentAuthor = '';
  isLoadingComments = false;
  isSubmittingComment = false;
  mediaCommentError = '';
  mediaCommentSuccess = '';
  commentsLoadError = '';

  private readonly likedKeys = new Set<string>();
  private readonly likePending = new Set<string>();

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
    this.loadLikedKeysFromStorage();
    this.applyThemeFromClock();
    this.themeWatchId = setInterval(() => this.applyThemeFromClock(), 60_000);
    try {
      await Promise.all([this.loadSettings(), this.loadHeroMedia()]);
    } catch {
      this.settings = { ...DEFAULT_SITE_SETTINGS };
      this.settingsMessage = this.i18n.t('home.settings.loadError');
    } finally {
      this.safeDetectChanges();
    }
  }

  private applyThemeFromClock(): void {
    const hour = new Date().getHours();
    const next: 'day' | 'night' = hour >= 6 && hour < 18 ? 'day' : 'night';
    if (next !== this.theme) {
      this.theme = next;
      this.safeDetectChanges();
    }
  }

  private mediaKey(item: TimelineMediaItem): string {
    return `${item.type}:${item.id}`;
  }

  isLiked(item: TimelineMediaItem): boolean {
    return this.likedKeys.has(this.mediaKey(item));
  }

  isLikePending(item: TimelineMediaItem): boolean {
    return this.likePending.has(this.mediaKey(item));
  }

  async toggleLike(item: TimelineMediaItem): Promise<void> {
    const key = this.mediaKey(item);
    if (this.likePending.has(key) || !this.apiBaseUrl) {
      return;
    }
    const isUnlike = this.likedKeys.has(key);
    const method = isUnlike ? 'DELETE' : 'POST';
    const fallback = isUnlike ? Math.max(0, item.likesCount - 1) : item.likesCount + 1;

    this.likePending.add(key);
    this.safeDetectChanges();
    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const url = `${base}/api/story/media/${encodeURIComponent(String(item.id))}/like`;
      const response = await fetch(url, { method, headers: this.auth.authHeaders?.() ?? {} });
      const payload = (await response.json().catch(() => null)) as { likesCount?: number } | null;
      if (!response.ok) {
        return;
      }
      item.likesCount =
        payload && typeof payload.likesCount === 'number' ? payload.likesCount : fallback;
      if (isUnlike) {
        this.likedKeys.delete(key);
      } else {
        this.likedKeys.add(key);
      }
      this.persistLikedKeys();
    } finally {
      this.likePending.delete(key);
      this.safeDetectChanges();
    }
  }

  private loadLikedKeysFromStorage(): void {
    try {
      const raw = localStorage.getItem(LIKED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const entry of parsed) {
        if (entry && typeof entry === 'object') {
          const type = (entry as { type?: unknown }).type;
          const id = (entry as { id?: unknown }).id;
          if (
            (type === 'image' || type === 'video' || type === 'text') &&
            (typeof id === 'string' || typeof id === 'number')
          ) {
            this.likedKeys.add(`${type}:${id}`);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private persistLikedKeys(): void {
    try {
      const rows = Array.from(this.likedKeys).map((key) => {
        const sep = key.indexOf(':');
        return sep > 0
          ? { type: key.slice(0, sep), id: key.slice(sep + 1) }
          : null;
      });
      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(rows.filter(Boolean)));
    } catch {
      // ignore
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
    if (this.mediaSwitchResetId !== null) {
      clearTimeout(this.mediaSwitchResetId);
      this.mediaSwitchResetId = null;
    }
    if (this.themeWatchId !== null) {
      clearInterval(this.themeWatchId);
      this.themeWatchId = null;
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

  get currentHeroMedia(): TimelineMediaItem | null {
    return this.heroMediaItems[this.heroMediaIndex] ?? null;
  }

  get nextMedia(): TimelineMediaItem | null {
    return this.heroMediaItems[this.heroMediaIndex - 1] ?? null;
  }

  get prevMedia(): TimelineMediaItem | null {
    return this.heroMediaItems[this.heroMediaIndex + 1] ?? null;
  }

  formatMediaDate(item: TimelineMediaItem | null): string {
    if (!item) return '';
    const raw = item.displayDate || item.createdAt || '';
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  canShowOlderMedia(): boolean {
    return this.heroMediaIndex < this.heroMediaItems.length - 1;
  }

  canShowNewerMedia(): boolean {
    return this.heroMediaIndex > 0;
  }

  showOlderMedia(): void {
    if (this.canShowOlderMedia()) {
      this.heroMediaIndex += 1;
      this.triggerRingStep('forward');
      this.stepKiteFrame('forward');
      this.triggerDateStep('forward');
    }
  }

  showNewerMedia(): void {
    if (this.canShowNewerMedia()) {
      this.heroMediaIndex -= 1;
      this.triggerRingStep('backward');
      this.stepKiteFrame('backward');
      this.triggerDateStep('backward');
    }
  }

  private triggerDateStep(direction: 'forward' | 'backward'): void {
    this.mediaSwitchDirection = direction;
    if (this.mediaSwitchResetId !== null) {
      clearTimeout(this.mediaSwitchResetId);
    }
    this.mediaSwitchResetId = setTimeout(() => {
      this.mediaSwitchDirection = null;
      this.mediaSwitchResetId = null;
      this.safeDetectChanges();
    }, 420);
    this.safeDetectChanges();
  }

  private stepKiteFrame(direction: 'forward' | 'backward'): void {
    if (direction === 'forward') {
      this.kiteFrame = (((this.kiteFrame % 4) + 1) as 1 | 2 | 3 | 4);
    } else {
      this.kiteFrame = (((this.kiteFrame + 2) % 4 + 1) as 1 | 2 | 3 | 4);
    }
  }

  onHeroPointerDown(event: PointerEvent): void {
    this.activePointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    this.pointerCurrentX = event.clientX;
  }

  onHeroPointerMove(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.pointerCurrentX = event.clientX;
  }

  onHeroPointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    const deltaX = this.pointerCurrentX - this.pointerStartX;
    const threshold = 42;
    if (deltaX <= -threshold) {
      this.showNewerMedia();
    } else if (deltaX >= threshold) {
      this.showOlderMedia();
    }
    this.onHeroPointerCancel();
  }

  onHeroPointerCancel(): void {
    this.activePointerId = null;
    this.pointerStartX = 0;
    this.pointerCurrentX = 0;
  }

  onRingStepAnimationEnd(): void {
    this.ringStepDirection = null;
    this.safeDetectChanges();
  }

  @HostListener('document:keydown.escape')
  onModalEscape(): void {
    if (this.selectedMedia) {
      this.closeMediaDetail();
    }
  }

  async openMediaDetail(item: TimelineMediaItem): Promise<void> {
    this.selectedMedia = item;
    this.mediaComments = [];
    this.mediaCommentDraft = '';
    this.mediaCommentError = '';
    this.mediaCommentSuccess = '';
    this.commentsLoadError = '';
    this.safeDetectChanges();
    await this.loadMediaComments(item);
  }

  closeMediaDetail(): void {
    this.selectedMedia = null;
    this.mediaComments = [];
    this.mediaCommentDraft = '';
    this.mediaCommentError = '';
    this.mediaCommentSuccess = '';
    this.commentsLoadError = '';
    this.safeDetectChanges();
  }

  private async loadMediaComments(item: TimelineMediaItem, opts?: { silent?: boolean }): Promise<void> {
    if (!opts?.silent) {
      this.isLoadingComments = true;
      this.commentsLoadError = '';
      this.safeDetectChanges();
    }
    try {
      const url = `${this.apiBaseUrl}/api/story/media/${encodeURIComponent(String(item.id))}/comments?_=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; items?: MediaComment[]; message?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        this.commentsLoadError = payload?.message || this.i18n.t('story.comment.error.loadFailed');
        if (!opts?.silent) this.mediaComments = [];
        return;
      }
      this.mediaComments = Array.isArray(payload.items) ? payload.items : [];
    } catch {
      this.commentsLoadError = this.i18n.t('story.comment.error.loadFailed');
      if (!opts?.silent) this.mediaComments = [];
    } finally {
      this.isLoadingComments = false;
      this.safeDetectChanges();
    }
  }

  async submitMediaComment(): Promise<void> {
    if (!this.selectedMedia) {
      return;
    }
    const message = this.mediaCommentDraft.trim();
    if (!message) {
      this.mediaCommentError = this.i18n.t('story.comment.error.empty');
      this.safeDetectChanges();
      return;
    }
    const authorName = this.auth.isAuthenticated
      ? (this.auth.username || '').trim()
      : this.mediaCommentAuthor.trim();
    if (!this.auth.isAuthenticated && !authorName) {
      this.mediaCommentError = this.i18n.t('story.comment.error.authorRequired');
      this.safeDetectChanges();
      return;
    }

    this.isSubmittingComment = true;
    this.mediaCommentError = '';
    this.mediaCommentSuccess = '';
    this.safeDetectChanges();
    try {
      const url = `${this.apiBaseUrl}/api/story/media/${encodeURIComponent(String(this.selectedMedia.id))}/comments`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authHeaders = this.auth.authHeaders?.() ?? {};
      Object.assign(headers, authHeaders);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ authorName, message })
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        this.mediaCommentError = payload?.message || this.i18n.t('story.comment.error.postFailed');
        return;
      }
      // Optimistic insert so user sees the new comment immediately
      const optimistic: MediaComment = {
        id: `local-${Date.now()}`,
        author_name: authorName,
        message,
        created_at: new Date().toISOString()
      };
      this.mediaComments = [optimistic, ...this.mediaComments];
      this.mediaCommentDraft = '';
      this.mediaCommentSuccess = this.i18n.t('story.comment.success.posted');
      this.safeDetectChanges();
      // Re-fetch fresh list silently to sync with server (replace optimistic with real)
      await this.loadMediaComments(this.selectedMedia, { silent: true });
      // Auto-clear success message after a moment
      setTimeout(() => {
        this.mediaCommentSuccess = '';
        this.safeDetectChanges();
      }, 2000);
    } catch {
      this.mediaCommentError = this.i18n.t('story.comment.error.postFailed');
    } finally {
      this.isSubmittingComment = false;
      this.safeDetectChanges();
    }
  }

  private async loadHeroMedia(): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/api/story/timeline?page=1`);
    const payload = (await response.json()) as {
      ok?: boolean;
      items?: Array<{
        id?: number | string;
        type?: string;
        title?: string;
        description?: string;
        mediaUrl?: string;
        displayDate?: string | null;
        createdAt?: string | null;
        likesCount?: number | string;
        commentsCount?: number | string;
      }>;
    };

    if (!response.ok || !payload.ok) {
      this.heroMediaItems = [];
      return;
    }

    const toCount = (v: unknown): number => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };

    const sourceItems = Array.isArray(payload.items) ? payload.items : [];
    this.heroMediaItems = sourceItems
      .filter((item) => (item.type === 'image' || item.type === 'video') && Boolean(item.mediaUrl))
      .map((item): TimelineMediaItem => ({
        id: item.id ?? '',
        type: item.type === 'video' ? 'video' : 'image',
        title: String(item.title || ''),
        description: String(item.description || ''),
        mediaUrl: String(item.mediaUrl || ''),
        displayDate: item.displayDate ?? null,
        createdAt: item.createdAt ?? null,
        likesCount: toCount(item.likesCount),
        commentsCount: toCount(item.commentsCount)
      }))
      .sort((a, b) => {
        const dayA = Date.parse(`${a.displayDate ?? '1970-01-01'}T00:00:00Z`);
        const dayB = Date.parse(`${b.displayDate ?? '1970-01-01'}T00:00:00Z`);
        if (dayB !== dayA) {
          return dayB - dayA;
        }
        const tA = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tB = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tB - tA;
      });
    this.heroMediaIndex = 0;
  }

  private triggerRingStep(direction: 'forward' | 'backward'): void {
    if (this.prefersReducedMotion) {
      this.ringRotationDeg += direction === 'forward' ? 12 : -12;
      this.ringStepDirection = null;
      this.safeDetectChanges();
      return;
    }

    this.ringStepDirection = direction;
    this.ringRotationDeg += direction === 'forward' ? 12 : -12;
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => window.setTimeout(cb, 0);
    schedule(() => {
      this.safeDetectChanges();
    });
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




