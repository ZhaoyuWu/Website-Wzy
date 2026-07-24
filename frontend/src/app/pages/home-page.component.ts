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
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
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




