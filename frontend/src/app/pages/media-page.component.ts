import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

type MediaItem = {
  id: number | string;
  title: string;
  description?: string;
  media_type?: 'image' | 'video' | string;
  public_url?: string;
  display_date?: string;
  created_at?: string;
  updated_at?: string;
};

type EditDraft = {
  title: string;
  description: string;
  displayDate: string;
};

type StoryPost = {
  id: number | string;
  title: string;
  body: string;
  author_id?: string | null;
  likes_count?: number;
  display_date?: string;
  created_at?: string;
  updated_at?: string;
};

type StoryEditDraft = {
  title: string;
  body: string;
  displayDate: string;
};

type UnifiedEntry =
  | { kind: 'media'; id: number | string; displayDate: string; item: MediaItem }
  | { kind: 'story'; id: number | string; displayDate: string; post: StoryPost };

type StorageUsage = {
  usedBytes: number;
  softLimitBytes: number;
  hardLimitBytes: number;
  percentOfHard: number;
  trackedItems: number;
  status: 'ok' | 'warn' | 'critical';
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

@Component({
  selector: 'app-media-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LanguagePickerComponent],
  templateUrl: './media-page.component.html',
  styleUrl: './media-page.component.scss'
})
export class MediaPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  // All async-mutated state lives in signals so zoneless change detection
  // picks up every update without manual detectChanges() calls.
  readonly mediaItems = signal<MediaItem[]>([]);
  readonly listError = signal('');
  readonly deleteError = signal('');
  readonly editError = signal('');
  readonly isRefreshing = signal(false);
  readonly deletingId = signal<number | string | null>(null);

  readonly editingId = signal<number | string | null>(null);
  // Draft objects stay plain: they are only visible while the matching
  // editing*Id signal is set, and ngModel mutates their fields in place.
  editDraft: EditDraft | null = null;
  readonly isSavingEdit = signal(false);

  readonly uploadTitle = signal('');
  readonly uploadDescription = signal('');
  readonly uploadDisplayDate = signal(MediaPageComponent.todayIso());
  readonly selectedFile = signal<File | null>(null);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  readonly isUploading = signal(false);

  readonly storyPosts = signal<StoryPost[]>([]);
  readonly storyListError = signal('');
  readonly isRefreshingStories = signal(false);

  readonly storyTitle = signal('');
  readonly storyBody = signal('');
  readonly storyDisplayDate = signal(MediaPageComponent.todayIso());
  readonly storyError = signal('');
  readonly storySuccess = signal('');
  readonly isSavingStory = signal(false);

  readonly editingStoryId = signal<number | string | null>(null);
  storyEditDraft: StoryEditDraft | null = null;
  readonly storyEditError = signal('');
  readonly isSavingStoryEdit = signal(false);
  readonly deletingStoryId = signal<number | string | null>(null);

  readonly isLoggingOut = signal(false);

  readonly storage = signal<StorageUsage | null>(null);

  readonly storageBarPercent = computed(() => {
    const storage = this.storage();
    if (!storage || storage.hardLimitBytes <= 0) return 0;
    return Math.max(0, Math.min(100, (storage.usedBytes / storage.hardLimitBytes) * 100));
  });

  readonly unifiedEntries = computed<UnifiedEntry[]>(() => {
    const mediaEntries: UnifiedEntry[] = this.mediaItems().map((item) => ({
      kind: 'media',
      id: item.id,
      displayDate: item.display_date ?? item.created_at ?? '',
      item
    }));
    const storyEntries: UnifiedEntry[] = this.storyPosts().map((post) => ({
      kind: 'story',
      id: post.id,
      displayDate: post.display_date ?? post.created_at ?? '',
      post
    }));
    return [...mediaEntries, ...storyEntries].sort((a, b) => {
      if (a.displayDate === b.displayDate) {
        const aCreated =
          a.kind === 'media' ? a.item.created_at ?? '' : a.post.created_at ?? '';
        const bCreated =
          b.kind === 'media' ? b.item.created_at ?? '' : b.post.created_at ?? '';
        return bCreated.localeCompare(aCreated);
      }
      return b.displayDate.localeCompare(a.displayDate);
    });
  });

  async ngOnInit(): Promise<void> {
    try {
      const response = await this.auth.apiFetch('/api/admin/overview', {});
      if (!response.ok) {
        throw new Error('Unauthorized session');
      }
      await Promise.all([this.loadMediaItems(), this.loadStoryPosts(), this.loadStorageUsage()]);
    } catch {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    }
  }

  async loadStorageUsage(): Promise<void> {
    try {
      const response = await this.auth.apiFetch('/api/admin/storage/usage', {});
      if (!response.ok) {
        this.storage.set(null);
        return;
      }
      const payload = (await response.json()) as Partial<StorageUsage>;
      if (
        typeof payload.usedBytes !== 'number' ||
        typeof payload.hardLimitBytes !== 'number'
      ) {
        this.storage.set(null);
        return;
      }
      this.storage.set({
        usedBytes: payload.usedBytes,
        softLimitBytes: Number(payload.softLimitBytes) || 0,
        hardLimitBytes: payload.hardLimitBytes,
        percentOfHard: Number(payload.percentOfHard) || 0,
        trackedItems: Number(payload.trackedItems) || 0,
        status: payload.status === 'critical' || payload.status === 'warn' ? payload.status : 'ok'
      });
    } catch {
      this.storage.set(null);
    }
  }

  formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 10) return `${Math.round(mb)} MB`;
    return `${mb.toFixed(1)} MB`;
  }

  trackById(index: number, item: MediaItem): number | string {
    return item.id ?? index;
  }

  trackByUnified = (_index: number, entry: UnifiedEntry): string => `${entry.kind}:${entry.id}`;

  async refreshAll(): Promise<void> {
    await Promise.all([this.loadMediaItems(), this.loadStoryPosts()]);
  }

  private static todayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async loadMediaItems(): Promise<void> {
    this.isRefreshing.set(true);
    this.listError.set('');

    try {
      const response = await this.auth.apiFetch('/api/admin/media', {});

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        items?: MediaItem[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load media list.');
      }

      this.mediaItems.set(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      this.listError.set(error instanceof Error ? error.message : 'Failed to load media list.');
    } finally {
      this.isRefreshing.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    if (!file) {
      return;
    }

    const mediaType = this.inferMediaType(file.type);
    if (!mediaType) {
      this.uploadError.set(
        'Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm, video/quicktime.'
      );
      this.selectedFile.set(null);
      return;
    }

    const maxSize = mediaType === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      this.uploadError.set(
        `${mediaType} file exceeds ${mediaType === 'image' ? '10MB' : '50MB'} limit.`
      );
      this.selectedFile.set(null);
    }
  }

  async uploadMedia(): Promise<void> {
    this.uploadError.set('');
    this.uploadSuccess.set('');

    const title = this.uploadTitle().trim();
    const description = this.uploadDescription().trim();
    const displayDate = this.uploadDisplayDate().trim();
    const file = this.selectedFile();

    if (!title || title.length > 120) {
      this.uploadError.set('Title is required and must be at most 120 characters.');
      return;
    }

    if (description.length > 500) {
      this.uploadError.set('Description must be at most 500 characters.');
      return;
    }

    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.uploadError.set('Display date is required (YYYY-MM-DD).');
      return;
    }

    if (!file) {
      this.uploadError.set('Please choose a file before uploading.');
      return;
    }

    const mediaType = this.inferMediaType(file.type);
    if (!mediaType) {
      this.uploadError.set('Unsupported file type.');
      return;
    }

    const maxSize = mediaType === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      this.uploadError.set(
        `${mediaType} file exceeds ${mediaType === 'image' ? '10MB' : '50MB'} limit.`
      );
      return;
    }

    this.isUploading.set(true);
    try {
      // Step 1: ask the backend for a short-lived signed upload URL.
      const urlResponse = await this.auth.apiFetch('/api/admin/media/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      });
      const urlPayload = (await urlResponse.json()) as {
        ok?: boolean;
        message?: string;
        uploadUrl?: string;
        objectPath?: string;
      };
      if (!urlResponse.ok || !urlPayload.ok || !urlPayload.uploadUrl || !urlPayload.objectPath) {
        throw new Error(urlPayload.message || 'Upload failed.');
      }

      // Step 2: send the raw file straight to Supabase Storage.
      const putResponse = await fetch(urlPayload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'false'
        },
        body: file
      });
      if (!putResponse.ok) {
        throw new Error('File transfer to storage failed. Please try again.');
      }

      // Step 3: let the backend verify the object and save the metadata.
      const response = await this.auth.apiFetch('/api/admin/media/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          displayDate,
          objectPath: urlPayload.objectPath,
          fileType: file.type,
          fileSize: file.size
        })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        item?: MediaItem;
      };

      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.message || 'Upload failed.');
      }

      const item = payload.item;
      this.mediaItems.update((items) => [item, ...items]);
      this.uploadTitle.set('');
      this.uploadDescription.set('');
      this.uploadDisplayDate.set(MediaPageComponent.todayIso());
      this.selectedFile.set(null);
      this.uploadSuccess.set('Upload completed.');
      await this.loadStorageUsage();
    } catch (error) {
      this.uploadError.set(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      this.isUploading.set(false);
    }
  }

  hasBeenEdited(item: MediaItem): boolean {
    if (!item.updated_at || !item.created_at) {
      return false;
    }
    return item.updated_at !== item.created_at;
  }

  startEdit(item: MediaItem): void {
    this.editError.set('');
    this.editDraft = {
      title: item.title,
      description: item.description ?? '',
      displayDate: item.display_date ?? MediaPageComponent.todayIso()
    };
    this.editingId.set(item.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft = null;
    this.editError.set('');
  }

  async saveEdit(item: MediaItem): Promise<void> {
    if (!this.editDraft) {
      return;
    }

    const title = this.editDraft.title.trim();
    const description = this.editDraft.description.trim();
    const displayDate = this.editDraft.displayDate.trim();

    if (!title || title.length > 120) {
      this.editError.set('Title is required and must be at most 120 characters.');
      return;
    }

    if (description.length > 500) {
      this.editError.set('Description must be at most 500 characters.');
      return;
    }

    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.editError.set('Display date must be a valid YYYY-MM-DD.');
      return;
    }

    this.editError.set('');
    this.isSavingEdit.set(true);
    try {
      const response = await this.auth.apiFetch(
        `/api/admin/media/${encodeURIComponent(String(item.id))}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, description, displayDate })
        }
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        item?: MediaItem;
      };

      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.message || 'Failed to save metadata.');
      }

      const saved = payload.item;
      this.mediaItems.update((items) =>
        items.map((current) => (current.id === item.id ? { ...current, ...saved } : current))
      );
      this.editingId.set(null);
      this.editDraft = null;
    } catch (error) {
      this.editError.set(error instanceof Error ? error.message : 'Failed to save metadata.');
    } finally {
      this.isSavingEdit.set(false);
    }
  }

  async deleteItem(item: MediaItem): Promise<void> {
    this.deleteError.set('');
    const confirmed =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`Delete "${item.title}"? This cannot be undone.`)
        : true;
    if (!confirmed) {
      return;
    }

    this.deletingId.set(item.id);
    try {
      const response = await this.auth.apiFetch(
        `/api/admin/media/${encodeURIComponent(String(item.id))}`,
        {
          method: 'DELETE',
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to delete media.');
      }

      this.mediaItems.update((items) => items.filter((current) => current.id !== item.id));
      await this.loadStorageUsage();
    } catch (error) {
      this.deleteError.set(error instanceof Error ? error.message : 'Failed to delete media.');
    } finally {
      this.deletingId.set(null);
    }
  }

  trackByStoryId(index: number, post: StoryPost): number | string {
    return post.id ?? index;
  }

  hasStoryBeenEdited(post: StoryPost): boolean {
    if (!post.updated_at || !post.created_at) return false;
    return post.updated_at !== post.created_at;
  }

  async loadStoryPosts(): Promise<void> {
    this.isRefreshingStories.set(true);
    this.storyListError.set('');
    try {
      const response = await this.auth.apiFetch('/api/admin/story-posts', {});
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        items?: StoryPost[];
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load story posts.');
      }
      this.storyPosts.set(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      this.storyListError.set(
        error instanceof Error ? error.message : 'Failed to load story posts.'
      );
    } finally {
      this.isRefreshingStories.set(false);
    }
  }

  async createStoryPost(): Promise<void> {
    this.storyError.set('');
    this.storySuccess.set('');
    const title = this.storyTitle().trim();
    const body = this.storyBody().trim();
    const displayDate = this.storyDisplayDate().trim();

    if (!title || title.length > 120) {
      this.storyError.set('Title is required and must be at most 120 characters.');
      return;
    }
    if (!body || body.length > 4000) {
      this.storyError.set('Body is required and must be at most 4000 characters.');
      return;
    }
    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.storyError.set('Display date is required (YYYY-MM-DD).');
      return;
    }

    this.isSavingStory.set(true);
    try {
      const response = await this.auth.apiFetch('/api/admin/story-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body, displayDate })
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        item?: StoryPost;
      };
      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.message || 'Failed to publish story post.');
      }
      const item = payload.item;
      this.storyPosts.update((posts) => [item, ...posts]);
      this.storyTitle.set('');
      this.storyBody.set('');
      this.storyDisplayDate.set(MediaPageComponent.todayIso());
      this.storySuccess.set('Story post published.');
    } catch (error) {
      this.storyError.set(
        error instanceof Error ? error.message : 'Failed to publish story post.'
      );
    } finally {
      this.isSavingStory.set(false);
    }
  }

  startEditStory(post: StoryPost): void {
    this.storyEditError.set('');
    this.storyEditDraft = {
      title: post.title,
      body: post.body,
      displayDate: post.display_date ?? MediaPageComponent.todayIso()
    };
    this.editingStoryId.set(post.id);
  }

  cancelStoryEdit(): void {
    this.editingStoryId.set(null);
    this.storyEditDraft = null;
    this.storyEditError.set('');
  }

  async saveStoryEdit(post: StoryPost): Promise<void> {
    if (!this.storyEditDraft) return;
    const title = this.storyEditDraft.title.trim();
    const body = this.storyEditDraft.body.trim();
    const displayDate = this.storyEditDraft.displayDate.trim();

    if (!title || title.length > 120) {
      this.storyEditError.set('Title is required and must be at most 120 characters.');
      return;
    }
    if (!body || body.length > 4000) {
      this.storyEditError.set('Body is required and must be at most 4000 characters.');
      return;
    }
    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.storyEditError.set('Display date must be a valid YYYY-MM-DD.');
      return;
    }

    this.isSavingStoryEdit.set(true);
    this.storyEditError.set('');
    try {
      const response = await this.auth.apiFetch(
        `/api/admin/story-posts/${encodeURIComponent(String(post.id))}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, body, displayDate })
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        item?: StoryPost;
      };
      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.message || 'Failed to save story post.');
      }
      const saved = payload.item;
      this.storyPosts.update((posts) =>
        posts.map((current) => (current.id === post.id ? { ...current, ...saved } : current))
      );
      this.editingStoryId.set(null);
      this.storyEditDraft = null;
    } catch (error) {
      this.storyEditError.set(
        error instanceof Error ? error.message : 'Failed to save story post.'
      );
    } finally {
      this.isSavingStoryEdit.set(false);
    }
  }

  async deleteStoryPost(post: StoryPost): Promise<void> {
    const confirmed =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`Delete "${post.title}"? This cannot be undone.`)
        : true;
    if (!confirmed) return;

    this.deletingStoryId.set(post.id);
    try {
      const response = await this.auth.apiFetch(
        `/api/admin/story-posts/${encodeURIComponent(String(post.id))}`,
        {
          method: 'DELETE',
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to delete story post.');
      }
      this.storyPosts.update((posts) => posts.filter((current) => current.id !== post.id));
    } catch (error) {
      this.storyListError.set(
        error instanceof Error ? error.message : 'Failed to delete story post.'
      );
    } finally {
      this.deletingStoryId.set(null);
    }
  }

  async logout(): Promise<void> {
    this.isLoggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login']);
    this.isLoggingOut.set(false);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDisplayDate(raw: string | undefined): string {
    if (!raw) return '--';
    const iso = String(raw).slice(0, 10);
    if (!MediaPageComponent.isIsoDate(iso)) return String(raw);
    return iso;
  }

  private static isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const asDate = new Date(Date.UTC(y, m - 1, d));
    return (
      asDate.getUTCFullYear() === y &&
      asDate.getUTCMonth() + 1 === m &&
      asDate.getUTCDate() === d
    );
  }

  formatDateTime(rawDate: string | undefined): string {
    if (!rawDate) {
      return '--';
    }
    const timestamp = Date.parse(rawDate);
    if (Number.isNaN(timestamp)) {
      return rawDate;
    }
    return new Date(timestamp).toLocaleString();
  }

  private inferMediaType(mimeType: string): 'image' | 'video' | null {
    const normalized = String(mimeType || '').toLowerCase();
    if (IMAGE_MIME_TYPES.has(normalized)) {
      return 'image';
    }
    if (VIDEO_MIME_TYPES.has(normalized)) {
      return 'video';
    }
    return null;
  }
}
