import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { resolveApiBaseUrl } from '../core/runtime-config';

export type TimelineEntryType = 'image' | 'video' | 'text';

export type TimelineEntry = {
  type: TimelineEntryType;
  id: string | number;
  title: string;
  description: string;
  body: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  likesCount: number;
  displayDate: string | null;
  createdAt: string | null;
};

type RawTimelineEntry = {
  type?: string;
  id?: string | number;
  title?: string;
  description?: string;
  body?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  likesCount?: number | string;
  displayDate?: string | null;
  createdAt?: string | null;
};

type TimelineResponse = {
  ok?: boolean;
  items?: RawTimelineEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

const LIKED_STORAGE_KEY = 'nanami.story.likes';

type LikedKey = { type: TimelineEntryType; id: string | number };

@Component({
  selector: 'app-story-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-wrap">
      <header class="timeline-head">
        <p class="eyebrow font-caveat">{{ i18n.t('story.eyebrow') }}</p>
        <h2>{{ i18n.t('story.heading') }}</h2>
      </header>

      <section class="state state-loading" *ngIf="isLoading">{{ i18n.t('story.state.loading') }}</section>
      <section class="state state-error" *ngIf="errorMessage">{{ errorMessage }}</section>
      <section class="state state-empty" *ngIf="!isLoading && !errorMessage && entries.length === 0">
        {{ i18n.t('story.state.empty') }}
      </section>

      <ol
        class="timeline"
        *ngIf="!isLoading && !errorMessage && entries.length > 0"
      >
        <li
          class="entry"
          *ngFor="let entry of entries; let i = index; trackBy: trackByKey"
          [class.align-right]="i % 2 === 1"
          [attr.data-type]="entry.type"
        >
          <div class="anchor" aria-hidden="true">
            <span class="dot"></span>
            <span class="anchor-date font-caveat" *ngIf="entry.displayDate || entry.createdAt">
              {{ formatDay(entry.displayDate || entry.createdAt) }}
            </span>
          </div>

          <article class="card" [class.card-text]="entry.type === 'text'">
            <div class="media-frame" *ngIf="entry.type !== 'text' && entry.mediaUrl">
              <button
                *ngIf="entry.type === 'image'"
                type="button"
                class="media-button"
                [attr.aria-label]="i18n.t('story.lightbox.open', { title: entry.title })"
                (click)="openFullscreen(entry)"
              >
                <img
                  [src]="entry.mediaUrl"
                  [alt]="entry.title"
                  loading="lazy"
                  decoding="async"
                  (error)="onImageError($event)"
                />
              </button>

              <video
                *ngIf="entry.type === 'video'"
                [src]="entry.mediaUrl"
                [poster]="entry.thumbnailUrl || undefined"
                controls
                preload="metadata"
                playsinline
              ></video>
            </div>

            <div class="meta">
              <h3>{{ entry.title }}</h3>
              <p class="desc" *ngIf="entry.type !== 'text' && entry.description">{{ entry.description }}</p>
              <p class="body" *ngIf="entry.type === 'text' && entry.body">{{ entry.body }}</p>
              <div class="foot">
                <button
                  type="button"
                  class="like-button"
                  [class.liked]="isLiked(entry)"
                  [disabled]="isLikePending(entry)"
                  [attr.aria-pressed]="isLiked(entry)"
                  [attr.aria-label]="i18n.t(isLiked(entry) ? 'story.like.unlike' : 'story.like.like', { title: entry.title })"
                  (click)="onToggleLike(entry)"
                >
                  <span class="heart" aria-hidden="true">{{ isLiked(entry) ? '♥' : '♡' }}</span>
                  <span class="count">{{ entry.likesCount }}</span>
                </button>
                <time *ngIf="entry.displayDate || entry.createdAt">{{ formatFull(entry.displayDate || entry.createdAt) }}</time>
              </div>
            </div>
          </article>
        </li>
      </ol>

      <nav class="pager" *ngIf="totalPages > 1" [attr.aria-label]="i18n.t('story.pager.aria')">
        <button
          type="button"
          class="pager-edge"
          (click)="goToPage(page - 1)"
          [disabled]="page <= 1 || isLoading"
        >
          ‹
        </button>
        <button
          type="button"
          class="pager-num"
          *ngFor="let n of pageNumbers"
          [class.active]="n === page"
          [disabled]="isLoading"
          (click)="goToPage(n)"
        >
          {{ n }}
        </button>
        <button
          type="button"
          class="pager-edge"
          (click)="goToPage(page + 1)"
          [disabled]="page >= totalPages || isLoading"
        >
          ›
        </button>
      </nav>
    </div>

    <div
      class="lightbox"
      *ngIf="activeImage"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="activeImage.title"
      (click)="closeFullscreen()"
    >
      <button
        type="button"
        class="lightbox-close"
        [attr.aria-label]="i18n.t('story.lightbox.close')"
        (click)="closeFullscreen(); $event.stopPropagation()"
      >
        ×
      </button>
      <figure class="lightbox-figure" (click)="$event.stopPropagation()">
        <img [src]="activeImage.mediaUrl || ''" [alt]="activeImage.title" />
        <figcaption>
          <strong>{{ activeImage.title }}</strong>
          <span *ngIf="activeImage.description">{{ activeImage.description }}</span>
        </figcaption>
      </figure>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .timeline-wrap {
      width: min(1100px, 100%);
      margin: 0 auto;
    }

    .timeline-head {
      text-align: center;
      margin-bottom: 18px;
    }

    .timeline-head .eyebrow {
      margin: 0;
      color: var(--color-ink);
      font-size: 28px;
      line-height: 1;
      letter-spacing: 0.02em;
    }

    .timeline-head h2 {
      margin: 6px 0 0;
      color: var(--color-ink);
      font-size: clamp(20px, 3vw, 28px);
    }

    .state {
      text-align: center;
      padding: 16px;
      border-radius: 14px;
      font-weight: 600;
      border: 1px solid var(--color-line);
      background: var(--color-paper);
    }

    .state-loading { color: var(--color-ink-muted); }
    .state-error { color: var(--color-accent-contrast); border-color: var(--color-accent-contrast); }
    .state-empty { color: var(--color-ink-muted); }

    .timeline {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      position: relative;
    }

    .timeline::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 3px;
      transform: translateX(-50%);
      background: var(--color-ink);
      border-radius: 2px;
      opacity: 0.9;
    }

    .entry {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 56px 1fr;
      align-items: start;
      margin: 18px 0;
    }

    .anchor {
      grid-column: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 24px;
    }

    .dot {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: var(--color-accent);
      border: 2px solid var(--color-ink);
      box-shadow: 0 0 0 4px var(--color-app-bg);
    }

    .anchor-date {
      margin-top: 8px;
      font-size: 20px;
      color: var(--color-ink);
      text-align: center;
      max-width: 72px;
      line-height: 1;
    }

    .entry .card {
      grid-column: 1;
      margin-right: 12px;
      border-radius: 16px;
      border: 2px solid var(--color-ink);
      background: var(--color-paper);
      box-shadow: 4px 4px 0 var(--color-ink);
      overflow: hidden;
    }

    .entry.align-right .card {
      grid-column: 3;
      margin-right: 0;
      margin-left: 12px;
    }

    .card-text {
      background: var(--color-accent-wash);
    }

    .media-frame {
      background: var(--color-paper-sunk);
      aspect-ratio: 16 / 10;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-bottom: 2px solid var(--color-ink);
    }

    .media-frame img,
    .media-frame video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .media-button {
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
      border: 0;
      background: transparent;
      cursor: zoom-in;
      display: block;
    }

    .media-button:focus-visible {
      outline: 3px solid var(--color-accent);
      outline-offset: -3px;
    }

    .meta {
      padding: 14px 16px;
    }

    .meta h3 {
      margin: 0;
      font-size: 19px;
      color: var(--color-ink);
    }

    .card-text .meta h3 {
      color: var(--color-ink);
      font-size: 22px;
    }

    .desc,
    .body {
      margin: 8px 0 0;
      color: var(--color-ink-soft);
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .card-text .body {
      color: var(--color-ink-soft);
      font-size: 15.5px;
    }

    .foot {
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .foot time {
      color: var(--color-ink-muted);
      font-family: 'Caveat', cursive;
      font-size: 17px;
    }

    .like-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1.5px solid var(--color-ink);
      background: var(--color-paper);
      color: var(--color-ink);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease;
    }

    .like-button:hover:not(:disabled) { background: var(--color-accent-wash); }
    .like-button:active:not(:disabled) { transform: scale(0.96); }
    .like-button.liked {
      background: var(--color-accent-contrast);
      border-color: var(--color-accent-contrast);
      color: var(--color-paper);
    }
    .like-button:disabled { cursor: default; opacity: 0.75; }
    .like-button .heart { font-size: 16px; line-height: 1; }

    .pager {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin: 28px 0 8px;
      flex-wrap: wrap;
    }

    .pager-num,
    .pager-edge {
      min-width: 36px;
      height: 36px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1.5px solid var(--color-ink);
      background: var(--color-paper);
      color: var(--color-ink);
      font-weight: 700;
      cursor: pointer;
    }

    .pager-num.active {
      background: var(--color-accent);
      color: var(--color-ink);
      border-color: var(--color-ink);
    }

    .pager-num:disabled,
    .pager-edge:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(27, 27, 29, 0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(16px, 4vw, 48px);
      cursor: zoom-out;
      animation: lightbox-fade 160ms ease-out;
    }

    @keyframes lightbox-fade { from { opacity: 0; } to { opacity: 1; } }

    .lightbox-figure {
      margin: 0;
      max-width: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      cursor: default;
    }

    .lightbox-figure img {
      max-width: 100%;
      max-height: calc(100vh - 140px);
      object-fit: contain;
      border-radius: 10px;
      border: 2px solid var(--color-paper);
    }

    .lightbox-figure figcaption {
      color: var(--color-paper);
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
      max-width: 680px;
    }

    .lightbox-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      border: 2px solid var(--color-paper);
      background: transparent;
      color: var(--color-paper);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }

    .lightbox-close:hover {
      background: var(--color-accent);
      color: var(--color-ink);
      border-color: var(--color-accent);
    }

    @media (max-width: 760px) {
      .timeline::before {
        left: 22px;
      }

      .entry {
        grid-template-columns: 44px 1fr;
      }

      .anchor {
        grid-column: 1;
        padding-top: 18px;
      }

      .anchor-date {
        display: none;
      }

      .entry .card,
      .entry.align-right .card {
        grid-column: 2;
        margin: 0;
      }
    }
  `
})
export class StoryTimelineComponent implements OnInit {
  entries: TimelineEntry[] = [];
  isLoading = true;
  errorMessage = '';
  activeImage: TimelineEntry | null = null;
  page = 1;
  pageSize = 20;
  totalPages = 1;
  total = 0;

  private readonly likedKeys = new Set<string>();
  private readonly likePending = new Set<string>();
  private apiBaseUrl = '';
  readonly i18n = inject(I18nService);

  constructor(private readonly cdr?: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    this.apiBaseUrl = (resolveApiBaseUrl() || '').trim();
    this.loadLikedKeys();
    await this.loadPage(1);
  }

  get pageNumbers(): number[] {
    const total = Math.max(1, this.totalPages);
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const set = new Set<number>([1, total, this.page]);
    if (this.page > 1) set.add(this.page - 1);
    if (this.page < total) set.add(this.page + 1);
    return Array.from(set).sort((a, b) => a - b);
  }

  trackByKey = (_index: number, entry: TimelineEntry): string => `${entry.type}:${entry.id}`;

  isLiked(entry: TimelineEntry): boolean {
    return this.likedKeys.has(this.entryKey(entry));
  }

  isLikePending(entry: TimelineEntry): boolean {
    return this.likePending.has(this.entryKey(entry));
  }

  async onToggleLike(entry: TimelineEntry): Promise<void> {
    const key = this.entryKey(entry);
    if (this.likePending.has(key) || !this.apiBaseUrl) {
      return;
    }

    const isUnlike = this.likedKeys.has(key);
    const method = isUnlike ? 'DELETE' : 'POST';
    const fallback = isUnlike ? Math.max(0, entry.likesCount - 1) : entry.likesCount + 1;

    this.likePending.add(key);
    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entry.type === 'text' ? 'text' : 'media')}/${encodeURIComponent(String(entry.id))}/like`,
        { method }
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { likesCount?: number }
        | null;
      entry.likesCount =
        payload && typeof payload.likesCount === 'number' ? payload.likesCount : fallback;

      if (isUnlike) {
        this.likedKeys.delete(key);
      } else {
        this.likedKeys.add(key);
      }
      this.persistLikedKeys();
    } finally {
      this.likePending.delete(key);
      this.cdr?.markForCheck();
    }
  }

  openFullscreen(entry: TimelineEntry): void {
    if (entry.type !== 'image' || !entry.mediaUrl) {
      return;
    }
    this.activeImage = entry;
  }

  closeFullscreen(): void {
    this.activeImage = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activeImage) {
      this.closeFullscreen();
    }
  }

  async goToPage(next: number): Promise<void> {
    const target = Math.max(1, Math.min(this.totalPages, Math.floor(next)));
    if (target === this.page || this.isLoading) {
      return;
    }
    await this.loadPage(target);
    if (typeof window !== 'undefined') {
      const host = document.getElementById('story');
      host?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.alt = `${target.alt} (failed to load)`;
    target.style.objectFit = 'contain';
    target.style.padding = '20px';
    target.style.background = 'var(--color-paper-sunk)';
  }

  formatFull(raw: string | null | undefined): string {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const ts = Date.parse(`${raw}T00:00:00Z`);
      if (Number.isNaN(ts)) return raw;
      return new Date(ts).toLocaleDateString();
    }
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return raw;
    return new Date(ts).toLocaleString();
  }

  formatDay(raw: string | null | undefined): string {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      const asDate = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(asDate.getTime())) return raw;
      const month = asDate.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' });
      return `${month} ${asDate.getUTCDate()}`;
    }
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return raw;
    const d = new Date(ts);
    const month = d.toLocaleString(undefined, { month: 'short' });
    return `${month} ${d.getDate()}`;
  }

  private async loadPage(pageNumber: number): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    if (!this.apiBaseUrl) {
      this.errorMessage = 'Missing API base URL.';
      this.isLoading = false;
      this.cdr?.markForCheck();
      return;
    }

    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/timeline?page=${encodeURIComponent(String(pageNumber))}`
      );
      if (!response.ok) {
        throw new Error(`Timeline request failed (${response.status}).`);
      }
      const payload = (await response.json()) as TimelineResponse;
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      this.entries = rawItems
        .map((row) => this.mapEntry(row))
        .filter((entry): entry is TimelineEntry => entry !== null);
      this.page = Math.max(1, Number(payload.page) || pageNumber);
      this.pageSize = Math.max(1, Number(payload.pageSize) || 20);
      this.total = Math.max(0, Number(payload.total) || 0);
      this.totalPages = Math.max(1, Number(payload.totalPages) || 1);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : this.i18n.t('story.state.error.fallback');
      this.entries = [];
    } finally {
      this.isLoading = false;
      this.cdr?.markForCheck();
    }
  }

  private mapEntry(row: RawTimelineEntry): TimelineEntry | null {
    const type = this.normalizeType(row.type);
    if (!type) return null;
    const displayDate = row.displayDate ? String(row.displayDate) : null;
    if (type !== 'text') {
      const normalizedUrl = this.normalizeHttpUrl(row.mediaUrl);
      if (!normalizedUrl) return null;
      return {
        type,
        id: row.id ?? normalizedUrl,
        title: String(row.title || 'Untitled'),
        description: String(row.description || ''),
        body: null,
        mediaUrl: normalizedUrl,
        thumbnailUrl: this.normalizeHttpUrl(row.thumbnailUrl ?? null) ?? null,
        likesCount: this.toLikeCount(row.likesCount),
        displayDate,
        createdAt: row.createdAt ? String(row.createdAt) : null
      };
    }
    return {
      type: 'text',
      id: row.id ?? `${Date.now()}`,
      title: String(row.title || 'Untitled'),
      description: '',
      body: String(row.body || ''),
      mediaUrl: null,
      thumbnailUrl: null,
      likesCount: this.toLikeCount(row.likesCount),
      displayDate,
      createdAt: row.createdAt ? String(row.createdAt) : null
    };
  }

  private normalizeType(raw: unknown): TimelineEntryType | null {
    const value = String(raw || '').toLowerCase();
    if (value === 'image' || value === 'video' || value === 'text') {
      return value;
    }
    return null;
  }

  private toLikeCount(raw: unknown): number {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }

  private normalizeHttpUrl(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const parsed = new URL(raw.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private entryKey(entry: TimelineEntry): string {
    return `${entry.type}:${entry.id}`;
  }

  private loadLikedKeys(): void {
    try {
      const raw = localStorage.getItem(LIKED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (this.isLikedKey(value)) {
            this.likedKeys.add(`${value.type}:${value.id}`);
          }
        }
      }
    } catch {
      // ignore storage read errors
    }
  }

  private persistLikedKeys(): void {
    try {
      const payload: LikedKey[] = Array.from(this.likedKeys).map((key) => {
        const [type, ...rest] = key.split(':');
        return { type: type as TimelineEntryType, id: rest.join(':') };
      });
      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable
    }
  }

  private isLikedKey(value: unknown): value is LikedKey {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    const type = candidate['type'];
    const id = candidate['id'];
    return (
      (type === 'image' || type === 'video' || type === 'text') &&
      (typeof id === 'string' || typeof id === 'number')
    );
  }
}
