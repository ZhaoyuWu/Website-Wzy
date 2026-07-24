import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
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
  commentsCount: number;
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
  commentsCount?: number | string;
  likedByMe?: boolean;
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

type StoryComment = {
  id: number | string;
  entry_type: 'media' | 'text';
  entry_id: number;
  author_name: string;
  message: string;
  created_at: string;
};

type StoryCommentsResponse = {
  ok?: boolean;
  items?: StoryComment[];
  total?: number;
  message?: string;
};

const LIKED_STORAGE_KEY = 'nanami.story.likes';

@Component({
  selector: 'app-story-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './story-timeline.component.html',
  styleUrl: './story-timeline.component.scss'
})
export class StoryTimelineComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('entryNode') private entryNodes?: QueryList<ElementRef<HTMLLIElement>>;

  // Async-mutated state lives in signals for zoneless change detection.
  // Entry objects themselves are mutated in place (likesCount /
  // commentsCount) and the array reference is refreshed to notify.
  readonly entries = signal<TimelineEntry[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly activeImage = signal<TimelineEntry | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly totalPages = signal(1);
  readonly total = signal(0);

  private readonly likedKeys = signal<ReadonlySet<string>>(new Set());
  private readonly likePending = signal<ReadonlySet<string>>(new Set());
  private apiBaseUrl = '';
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly commentModalEntry = signal<TimelineEntry | null>(null);
  readonly commentDraft = signal('');
  readonly isCommentSubmitting = signal(false);
  readonly isCommentLoading = signal(false);
  readonly commentError = signal('');
  readonly commentSuccess = signal('');
  readonly commentLoadError = signal('');
  readonly activeComments = signal<StoryComment[]>([]);
  private entryNodesSubscription?: { unsubscribe(): void };
  private entryObserver: IntersectionObserver | null = null;
  private readonly revealedEntryKeys = new Set<string>();
  private readonly replayCountByEntry = new Map<string, number>();
  private readonly maxRevealReplays = 1;
  private readonly prefersReducedMotion = this.detectReducedMotion();
  private readonly deletingCommentIds = signal<ReadonlySet<string>>(new Set());

  readonly pageNumbers = computed<number[]>(() => {
    const total = Math.max(1, this.totalPages());
    const page = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const set = new Set<number>([1, total, page]);
    if (page > 1) set.add(page - 1);
    if (page < total) set.add(page + 1);
    return Array.from(set).sort((a, b) => a - b);
  });

  async ngOnInit(): Promise<void> {
    this.apiBaseUrl = (resolveApiBaseUrl() || '').trim();
    this.loadLikedKeysFromStorage();
    await this.loadPage(1);
  }

  ngAfterViewInit(): void {
    this.entryNodesSubscription = this.entryNodes?.changes.subscribe(() => {
      this.refreshRevealTargets();
    });
    this.refreshRevealTargets();
  }

  ngOnDestroy(): void {
    this.entryNodesSubscription?.unsubscribe();
    this.entryObserver?.disconnect();
  }

  private addLikedKeys(keys: string[]): void {
    if (!keys.length) return;
    this.likedKeys.update((current) => {
      const next = new Set(current);
      for (const key of keys) {
        next.add(key);
      }
      return next;
    });
  }

  private removeLikedKey(key: string): void {
    this.likedKeys.update((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  private loadLikedKeysFromStorage(): void {
    try {
      const raw = localStorage.getItem(LIKED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const keys: string[] = [];
      for (const entry of parsed) {
        if (entry && typeof entry === 'object') {
          const type = (entry as { type?: unknown }).type;
          const id = (entry as { id?: unknown }).id;
          if (
            (type === 'image' || type === 'video' || type === 'text') &&
            (typeof id === 'string' || typeof id === 'number')
          ) {
            keys.push(`${type}:${id}`);
          }
        }
      }
      this.addLikedKeys(keys);
    } catch {
      // storage unavailable or corrupted — ignore
    }
  }

  private persistLikedKeys(): void {
    try {
      const rows = Array.from(this.likedKeys()).map((key) => {
        const separator = key.indexOf(':');
        return separator > 0
          ? { type: key.slice(0, separator), id: key.slice(separator + 1) }
          : null;
      });
      localStorage.setItem(
        LIKED_STORAGE_KEY,
        JSON.stringify(rows.filter(Boolean))
      );
    } catch {
      // storage unavailable — ignore
    }
  }

  trackByKey = (_index: number, entry: TimelineEntry): string => `${entry.type}:${entry.id}`;

  isLiked(entry: TimelineEntry): boolean {
    return this.likedKeys().has(this.entryKey(entry));
  }

  isLikePending(entry: TimelineEntry): boolean {
    return this.likePending().has(this.entryKey(entry));
  }

  async onToggleLike(entry: TimelineEntry): Promise<void> {
    const key = this.entryKey(entry);
    if (this.likePending().has(key) || !this.apiBaseUrl) {
      return;
    }

    const isUnlike = this.likedKeys().has(key);
    const method = isUnlike ? 'DELETE' : 'POST';
    const fallback = isUnlike ? Math.max(0, entry.likesCount - 1) : entry.likesCount + 1;

    this.likePending.update((current) => new Set(current).add(key));
    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entry.type === 'text' ? 'text' : 'media')}/${encodeURIComponent(String(entry.id))}/like`,
        {
          method,
          headers: this.auth.authHeaders()
        }
      );
      if (!response.ok) {
        if (response.status === 401) {
          this.errorMessage.set(this.i18n.t('story.comment.error.loginFirstLike'));
        }
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { likesCount?: number }
        | null;
      entry.likesCount =
        payload && typeof payload.likesCount === 'number' ? payload.likesCount : fallback;
      this.entries.update((list) => [...list]);

      if (isUnlike) {
        this.removeLikedKey(key);
      } else {
        this.addLikedKeys([key]);
      }
      this.persistLikedKeys();
    } finally {
      this.likePending.update((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  openFullscreen(entry: TimelineEntry): void {
    if (entry.type !== 'image' || !entry.mediaUrl) {
      return;
    }
    this.activeImage.set(entry);
  }

  closeFullscreen(): void {
    this.activeImage.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activeImage()) {
      this.closeFullscreen();
    }
    if (this.commentModalEntry()) {
      this.closeCommentModal();
    }
  }

  async goToPage(next: number): Promise<void> {
    const target = Math.max(1, Math.min(this.totalPages(), Math.floor(next)));
    if (target === this.page() || this.isLoading()) {
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
    this.isLoading.set(true);
    this.errorMessage.set('');
    if (!this.apiBaseUrl) {
      this.errorMessage.set('Missing API base URL.');
      this.isLoading.set(false);
      return;
    }

    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/timeline?page=${encodeURIComponent(String(pageNumber))}`,
        { headers: this.auth.authHeaders() }
      );
      if (!response.ok) {
        throw new Error(`Timeline request failed (${response.status}).`);
      }
      const payload = (await response.json()) as TimelineResponse;
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      this.entries.set(
        rawItems
          .map((row) => this.mapEntry(row))
          .filter((entry): entry is TimelineEntry => entry !== null)
      );
      const likedFromServer: string[] = [];
      for (const row of rawItems) {
        if (row && row.likedByMe) {
          const type = this.normalizeType(row.type);
          if (!type) continue;
          const id = row.id;
          if (typeof id === 'string' || typeof id === 'number') {
            likedFromServer.push(`${type}:${id}`);
          }
        }
      }
      this.addLikedKeys(likedFromServer);
      this.persistLikedKeys();
      this.page.set(Math.max(1, Number(payload.page) || pageNumber));
      this.pageSize.set(Math.max(1, Number(payload.pageSize) || 10));
      this.total.set(Math.max(0, Number(payload.total) || 0));
      this.totalPages.set(Math.max(1, Number(payload.totalPages) || 1));
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : this.i18n.t('story.state.error.fallback')
      );
      this.entries.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  trackByCommentId(_index: number, item: StoryComment): number | string {
    return item.id;
  }

  isCommentDeleting(item: StoryComment): boolean {
    return this.deletingCommentIds().has(String(item.id));
  }

  openCommentModal(entry: TimelineEntry): void {
    this.commentModalEntry.set(entry);
    this.commentDraft.set('');
    this.commentError.set('');
    this.commentSuccess.set('');
    this.commentLoadError.set('');
    void this.loadCommentsForEntry(entry);
  }

  closeCommentModal(): void {
    this.commentModalEntry.set(null);
    this.commentDraft.set('');
    this.commentError.set('');
    this.commentSuccess.set('');
    this.commentLoadError.set('');
    this.activeComments.set([]);
  }

  async submitComment(): Promise<void> {
    const modalEntry = this.commentModalEntry();
    if (!modalEntry || !this.apiBaseUrl) {
      return;
    }

    const authorName = (this.auth.username || '').trim();
    if (!authorName) {
      this.commentError.set(this.i18n.t('story.comment.error.loginFirst'));
      return;
    }

    const message = this.commentDraft().trim();
    if (!message || message.length > 500) {
      this.commentError.set(this.i18n.t('story.comment.error.length'));
      return;
    }

    this.isCommentSubmitting.set(true);
    this.commentError.set('');
    this.commentSuccess.set('');
    try {
      const entryType = this.toCommentEntryType(modalEntry);
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entryType)}/${encodeURIComponent(String(modalEntry.id))}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorName, message })
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; item?: StoryComment; message?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.item) {
        throw new Error(payload?.message || this.i18n.t('story.comment.error.postFailed'));
      }

      const item = payload.item;
      this.activeComments.update((comments) => [item, ...comments]);
      this.updateCommentsCount(modalEntry, this.activeComments().length);
      this.commentDraft.set('');
      this.commentSuccess.set(this.i18n.t('story.comment.success.posted'));
    } catch (error) {
      this.commentError.set(
        error instanceof Error ? error.message : this.i18n.t('story.comment.error.postFailed')
      );
    } finally {
      this.isCommentSubmitting.set(false);
    }
  }

  private async loadCommentsForEntry(entry: TimelineEntry): Promise<void> {
    if (!this.apiBaseUrl) {
      return;
    }

    this.isCommentLoading.set(true);
    this.commentLoadError.set('');
    try {
      const entryType = this.toCommentEntryType(entry);
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entryType)}/${encodeURIComponent(String(entry.id))}/comments?limit=20`
      );
      const payload = (await response.json().catch(() => null)) as StoryCommentsResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `Comment request failed (${response.status}).`);
      }
      this.activeComments.set(Array.isArray(payload.items) ? payload.items : []);
      this.updateCommentsCount(
        entry,
        Number.isFinite(Number(payload.total)) ? Number(payload.total) : this.activeComments().length
      );
    } catch (error) {
      this.commentLoadError.set(
        error instanceof Error ? error.message : this.i18n.t('story.comment.error.loadFailed')
      );
      this.activeComments.set([]);
    } finally {
      this.isCommentLoading.set(false);
    }
  }

  private toCommentEntryType(entry: TimelineEntry): 'media' | 'text' {
    return entry.type === 'text' ? 'text' : 'media';
  }

  async deleteComment(item: StoryComment): Promise<void> {
    const modalEntry = this.commentModalEntry();
    if (!modalEntry || !this.apiBaseUrl || !this.auth.isAdmin) {
      return;
    }
    const deleteKey = String(item.id);
    if (this.deletingCommentIds().has(deleteKey)) {
      return;
    }

    this.deletingCommentIds.update((current) => new Set(current).add(deleteKey));
    this.commentError.set('');
    this.commentSuccess.set('');
    try {
      const entryType = this.toCommentEntryType(modalEntry);
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entryType)}/${encodeURIComponent(String(modalEntry.id))}/comments/${encodeURIComponent(String(item.id))}`,
        {
          method: 'DELETE',
          headers: this.auth.authHeaders()
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || this.i18n.t('story.comment.error.deleteFailed'));
      }

      this.activeComments.update((comments) =>
        comments.filter((row) => String(row.id) !== deleteKey)
      );
      this.updateCommentsCount(modalEntry, Math.max(0, this.activeComments().length));
      this.commentSuccess.set(this.i18n.t('story.comment.success.deleted'));
    } catch (error) {
      this.commentError.set(
        error instanceof Error ? error.message : this.i18n.t('story.comment.error.deleteFailed')
      );
    } finally {
      this.deletingCommentIds.update((current) => {
        const next = new Set(current);
        next.delete(deleteKey);
        return next;
      });
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
        commentsCount: this.toLikeCount(row.commentsCount),
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
      commentsCount: this.toLikeCount(row.commentsCount),
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

  private updateCommentsCount(entry: TimelineEntry, nextCount: number): void {
    const normalized = Number.isFinite(nextCount) && nextCount >= 0 ? Math.floor(nextCount) : 0;
    entry.commentsCount = normalized;
    for (const item of this.entries()) {
      if (item.type === entry.type && String(item.id) === String(entry.id)) {
        item.commentsCount = normalized;
        break;
      }
    }
    this.entries.update((list) => [...list]);
  }

  private detectReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private refreshRevealTargets(): void {
    const nodes = this.entryNodes?.toArray() ?? [];
    if (!nodes.length) {
      this.entryObserver?.disconnect();
      return;
    }

    if (this.prefersReducedMotion || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      this.entryObserver?.disconnect();
      for (const node of nodes) {
        this.setEntryVisible(node.nativeElement, true);
      }
      return;
    }

    if (!this.entryObserver) {
      this.entryObserver = new IntersectionObserver(
        (entries) => {
          for (const item of entries) {
            const target = item.target as HTMLLIElement;
            const key = this.entryDomKey(target);
            if (item.isIntersecting && item.intersectionRatio >= 0.25) {
              this.revealedEntryKeys.add(key);
              this.setEntryVisible(target, true);
              continue;
            }

            if (this.revealedEntryKeys.has(key) && this.allowReplay(target, key)) {
              this.revealedEntryKeys.delete(key);
              this.setEntryVisible(target, false);
            }
          }
        },
        { threshold: [0.25, 0.45], rootMargin: '0px 0px -8% 0px' }
      );
    } else {
      this.entryObserver.disconnect();
    }

    for (const node of nodes) {
      const element = node.nativeElement;
      const key = this.entryDomKey(element);
      this.setEntryVisible(element, this.revealedEntryKeys.has(key));
      this.entryObserver.observe(element);
    }
  }

  private entryDomKey(element: HTMLLIElement): string {
    return element.dataset['entryKey'] || '';
  }

  private setEntryVisible(element: HTMLLIElement, visible: boolean): void {
    element.classList.toggle('entry-visible', visible);
    element.classList.toggle('entry-pending', !visible);
  }

  private allowReplay(element: HTMLLIElement, key: string): boolean {
    if (!key || typeof window === 'undefined') {
      return false;
    }

    const viewportHeight = window.innerHeight || 800;
    const rect = element.getBoundingClientRect();
    const farOutside = rect.bottom < -viewportHeight * 0.2 || rect.top > viewportHeight * 1.2;
    if (!farOutside) {
      return false;
    }

    const current = this.replayCountByEntry.get(key) || 0;
    if (current >= this.maxRevealReplays) {
      return false;
    }

    this.replayCountByEntry.set(key, current + 1);
    return true;
  }
}
