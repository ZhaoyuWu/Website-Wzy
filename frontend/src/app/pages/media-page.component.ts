import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

type MediaItem = {
  id: number | string;
  title: string;
  description?: string;
  media_type?: 'image' | 'video' | string;
  public_url?: string;
  created_at?: string;
  updated_at?: string;
};

type EditDraft = {
  title: string;
  description: string;
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

@Component({
  selector: 'app-media-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="media-layout">
      <section class="media-card">
        <div class="header">
          <div>
            <p class="eyebrow">Media Management</p>
            <h1>Manage Media</h1>
            <p class="desc">
              Signed in as {{ auth.username ?? 'unknown' }}
              <span class="role-badge role-{{ auth.userRole.toLowerCase() }}">{{ auth.userRole }}</span>
            </p>
          </div>
          <div class="header-actions">
            <a class="back-home" [routerLink]="['/']"><- Home</a>
            <button type="button" class="logout" (click)="logout()" [disabled]="isLoggingOut">
              {{ isLoggingOut ? 'Signing out...' : 'Logout' }}
            </button>
          </div>
        </div>
      </section>

      <section class="media-card">
        <h2>Upload New Media</h2>
        <p class="hint">Allowed: JPG/PNG/WEBP/GIF up to 10MB, MP4/WEBM/MOV up to 50MB.</p>

        <form class="form-grid" (ngSubmit)="uploadMedia()">
          <label>
            <span>Title</span>
            <input
              type="text"
              [(ngModel)]="uploadTitle"
              name="uploadTitle"
              maxlength="120"
              required
              [disabled]="isUploading"
            />
          </label>

          <label>
            <span>Description (optional)</span>
            <textarea
              [(ngModel)]="uploadDescription"
              name="uploadDescription"
              maxlength="500"
              rows="3"
              [disabled]="isUploading"
            ></textarea>
          </label>

          <label>
            <span>File</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              (change)="onFileSelected($event)"
              [disabled]="isUploading"
            />
          </label>

          <p class="file-meta" *ngIf="selectedFile">
            {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})
          </p>

          <p class="error" *ngIf="uploadError">{{ uploadError }}</p>
          <p class="success" *ngIf="uploadSuccess">{{ uploadSuccess }}</p>

          <button type="submit" [disabled]="isUploading">
            {{ isUploading ? 'Uploading...' : 'Upload' }}
          </button>
        </form>
      </section>

      <section class="media-card">
        <div class="list-header">
          <h2>Existing Media</h2>
          <button type="button" class="secondary" (click)="loadMediaItems()" [disabled]="isRefreshing">
            {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <p class="hint">Edit title or description; delete removes the file and its metadata.</p>
        <p class="error" *ngIf="listError">{{ listError }}</p>
        <p class="error" *ngIf="deleteError">{{ deleteError }}</p>
        <p class="error" *ngIf="editError">{{ editError }}</p>
        <p class="hint" *ngIf="!isRefreshing && mediaItems.length === 0 && !listError">
          No media items yet.
        </p>

        <ul class="media-list" *ngIf="mediaItems.length > 0">
          <li class="media-row" *ngFor="let item of mediaItems; trackBy: trackById">
            <ng-container *ngIf="editingId !== item.id">
              <strong class="title">{{ item.title }}</strong>
              <span class="timestamp">Uploaded {{ formatDateTime(item.created_at) }}</span>
              <span class="timestamp muted" *ngIf="hasBeenEdited(item)">
                &middot; Updated {{ formatDateTime(item.updated_at) }}
              </span>
              <div class="row-actions">
                <button type="button" class="secondary compact" (click)="startEdit(item)">
                  Edit
                </button>
                <button
                  type="button"
                  class="danger compact"
                  (click)="deleteItem(item)"
                  [disabled]="deletingId === item.id"
                >
                  {{ deletingId === item.id ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </ng-container>

            <ng-container *ngIf="editingId === item.id && editDraft">
              <div class="edit-form">
                <label>
                  <span>Title</span>
                  <input
                    type="text"
                    [(ngModel)]="editDraft.title"
                    name="editTitle-{{ item.id }}"
                    maxlength="120"
                    required
                    [disabled]="isSavingEdit"
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    [(ngModel)]="editDraft.description"
                    name="editDescription-{{ item.id }}"
                    maxlength="500"
                    rows="3"
                    [disabled]="isSavingEdit"
                  ></textarea>
                </label>
                <div class="row-actions">
                  <button type="button" (click)="saveEdit(item)" [disabled]="isSavingEdit">
                    {{ isSavingEdit ? 'Saving...' : 'Save' }}
                  </button>
                  <button type="button" class="secondary" (click)="cancelEdit()" [disabled]="isSavingEdit">
                    Cancel
                  </button>
                </div>
              </div>
            </ng-container>
          </li>
        </ul>
      </section>
    </main>
  `,
  styles: `
    .media-layout {
      min-height: 100vh;
      padding: 20px;
      display: grid;
      gap: 16px;
      align-content: start;
      background:
        radial-gradient(circle at 22% 20%, var(--fx-admin-warm-glow), transparent 36%),
        radial-gradient(circle at 90% 10%, var(--fx-admin-green-glow), transparent 32%),
        var(--clr-f4fbf8);
    }

    .media-card {
      width: min(980px, 100%);
      margin: 0 auto;
      border-radius: 18px;
      border: 1px solid var(--clr-c7e5d8);
      background: var(--color-surface);
      padding: 22px;
      box-shadow: 0 14px 36px var(--fx-shadow-admin);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }

    .eyebrow {
      margin: 0;
      color: var(--clr-257b58);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1,
    h2 {
      margin: 6px 0;
      color: var(--clr-163526);
    }

    .desc {
      margin: 0;
      color: var(--clr-3b5e4d);
    }

    .role-badge {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .role-admin {
      background: var(--clr-d4edda);
      color: var(--clr-1a5c33);
    }

    .role-publisher {
      background: var(--clr-cce5ff);
      color: var(--clr-1a3a6c);
    }

    .role-viewer {
      background: var(--clr-ececec);
      color: var(--clr-555);
    }

    button {
      border: 0;
      border-radius: 10px;
      min-width: 140px;
      min-height: 40px;
      color: var(--clr-fff);
      background: linear-gradient(90deg, var(--color-brand-green-start) 0%, var(--color-brand-green-end) 100%);
      font-weight: 700;
      cursor: pointer;
      padding: 8px 14px;
    }

    button.secondary {
      background: var(--clr-eef6f2);
      color: var(--clr-206346);
      border: 1px solid var(--color-border-success);
    }

    button.danger {
      background: var(--color-state-error);
      color: var(--color-surface);
      min-width: 100px;
    }

    button[disabled] {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .back-home {
      text-decoration: none;
      color: var(--clr-206346);
      font-weight: 600;
      font-size: 14px;
      padding: 8px 14px;
      border: 1px solid var(--color-border-success);
      border-radius: 10px;
      background: var(--clr-eef6f2);
    }

    .logout {
      min-width: 120px;
    }

    .form-grid {
      display: grid;
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--clr-1f4e37);
      font-weight: 600;
      font-size: 14px;
    }

    input,
    textarea {
      border: 1px solid var(--color-border-success);
      border-radius: 10px;
      padding: 10px;
      font: inherit;
    }

    .file-meta,
    .hint {
      margin: 0;
      color: var(--clr-416654);
    }

    .error {
      margin: 0;
      color: var(--clr-9b2e2e);
      font-weight: 600;
    }

    .success {
      margin: 0;
      color: var(--color-state-success);
      font-weight: 600;
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .media-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }

    .media-row {
      border: 1px solid var(--clr-ddede5);
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      background: var(--clr-fbfefc);
    }

    .title {
      color: var(--clr-163526);
      font-size: 14px;
      min-width: 0;
      flex: 0 1 auto;
      overflow-wrap: anywhere;
    }

    .timestamp {
      color: var(--clr-4a6b5d);
      font-size: 12px;
      white-space: nowrap;
    }

    .timestamp.muted {
      color: var(--clr-5b6f84);
    }

    .row-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-left: auto;
    }

    button.compact {
      min-width: 72px;
      min-height: 32px;
      padding: 4px 12px;
      font-size: 13px;
    }

    .edit-form {
      display: grid;
      gap: 10px;
      width: 100%;
    }

    .edit-form label {
      display: grid;
      gap: 6px;
    }

    @media (max-width: 760px) {
      .media-layout {
        padding: 12px;
      }

      .header,
      .list-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .media-row .row-actions {
        margin-left: 0;
        width: 100%;
      }

      .media-row button.compact {
        flex: 1 1 auto;
      }
    }

    @media (max-width: 390px) {
      .media-card {
        padding: 16px;
      }

      button {
        min-width: 100%;
      }
    }

    @media (min-width: 1280px) {
      .media-layout {
        padding: 28px 32px;
      }

      .media-card {
        width: min(1120px, 100%);
      }
    }
  `
})
export class MediaPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  mediaItems: MediaItem[] = [];
  listError = '';
  deleteError = '';
  editError = '';
  isRefreshing = false;
  deletingId: number | string | null = null;

  editingId: number | string | null = null;
  editDraft: EditDraft | null = null;
  isSavingEdit = false;

  uploadTitle = '';
  uploadDescription = '';
  selectedFile: File | null = null;
  uploadError = '';
  uploadSuccess = '';
  isUploading = false;

  isLoggingOut = false;

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/overview'), {
        headers: this.auth.authHeaders()
      });
      if (!response.ok) {
        throw new Error('Unauthorized session');
      }
      await this.loadMediaItems();
    } catch {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } finally {
      this.cdr.detectChanges();
    }
  }

  trackById(index: number, item: MediaItem): number | string {
    return item.id ?? index;
  }

  async loadMediaItems(): Promise<void> {
    this.isRefreshing = true;
    this.listError = '';

    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/media'), {
        headers: this.auth.authHeaders()
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        items?: MediaItem[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load media list.');
      }

      this.mediaItems = Array.isArray(payload.items) ? payload.items : [];
    } catch (error) {
      this.listError = error instanceof Error ? error.message : 'Failed to load media list.';
    } finally {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.selectedFile = file;
    this.uploadError = '';
    this.uploadSuccess = '';

    if (!file) {
      return;
    }

    const mediaType = this.inferMediaType(file.type);
    if (!mediaType) {
      this.uploadError =
        'Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm, video/quicktime.';
      this.selectedFile = null;
      return;
    }

    const maxSize = mediaType === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      this.uploadError = `${mediaType} file exceeds ${mediaType === 'image' ? '10MB' : '50MB'} limit.`;
      this.selectedFile = null;
    }
  }

  async uploadMedia(): Promise<void> {
    this.uploadError = '';
    this.uploadSuccess = '';

    const title = this.uploadTitle.trim();
    const description = this.uploadDescription.trim();
    const file = this.selectedFile;

    if (!title || title.length > 120) {
      this.uploadError = 'Title is required and must be at most 120 characters.';
      return;
    }

    if (description.length > 500) {
      this.uploadError = 'Description must be at most 500 characters.';
      return;
    }

    if (!file) {
      this.uploadError = 'Please choose a file before uploading.';
      return;
    }

    const mediaType = this.inferMediaType(file.type);
    if (!mediaType) {
      this.uploadError = 'Unsupported file type.';
      return;
    }

    const maxSize = mediaType === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      this.uploadError = `${mediaType} file exceeds ${mediaType === 'image' ? '10MB' : '50MB'} limit.`;
      return;
    }

    this.isUploading = true;
    try {
      const fileBase64 = await this.fileToBase64(file);
      const response = await fetch(this.auth.apiUrl('/api/admin/media'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.auth.authHeaders()
        },
        body: JSON.stringify({
          title,
          description,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileBase64
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

      this.mediaItems = [payload.item, ...this.mediaItems];
      this.uploadTitle = '';
      this.uploadDescription = '';
      this.selectedFile = null;
      this.uploadSuccess = 'Upload completed.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'Upload failed.';
    } finally {
      this.isUploading = false;
      this.cdr.detectChanges();
    }
  }

  hasBeenEdited(item: MediaItem): boolean {
    if (!item.updated_at || !item.created_at) {
      return false;
    }
    return item.updated_at !== item.created_at;
  }

  startEdit(item: MediaItem): void {
    this.editError = '';
    this.editingId = item.id;
    this.editDraft = {
      title: item.title,
      description: item.description ?? ''
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = null;
    this.editError = '';
  }

  async saveEdit(item: MediaItem): Promise<void> {
    if (!this.editDraft) {
      return;
    }

    const title = this.editDraft.title.trim();
    const description = this.editDraft.description.trim();

    if (!title || title.length > 120) {
      this.editError = 'Title is required and must be at most 120 characters.';
      return;
    }

    if (description.length > 500) {
      this.editError = 'Description must be at most 500 characters.';
      return;
    }

    this.editError = '';
    this.isSavingEdit = true;
    try {
      const response = await fetch(
        this.auth.apiUrl(`/api/admin/media/${encodeURIComponent(String(item.id))}`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...this.auth.authHeaders()
          },
          body: JSON.stringify({ title, description })
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
      this.mediaItems = this.mediaItems.map((current) =>
        current.id === item.id ? { ...current, ...saved } : current
      );
      this.editingId = null;
      this.editDraft = null;
    } catch (error) {
      this.editError = error instanceof Error ? error.message : 'Failed to save metadata.';
    } finally {
      this.isSavingEdit = false;
      this.cdr.detectChanges();
    }
  }

  async deleteItem(item: MediaItem): Promise<void> {
    this.deleteError = '';
    const confirmed =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`Delete "${item.title}"? This cannot be undone.`)
        : true;
    if (!confirmed) {
      return;
    }

    this.deletingId = item.id;
    try {
      const response = await fetch(
        this.auth.apiUrl(`/api/admin/media/${encodeURIComponent(String(item.id))}`),
        {
          method: 'DELETE',
          headers: this.auth.authHeaders()
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to delete media.');
      }

      this.mediaItems = this.mediaItems.filter((current) => current.id !== item.id);
    } catch (error) {
      this.deleteError = error instanceof Error ? error.message : 'Failed to delete media.';
    } finally {
      this.deletingId = null;
      this.cdr.detectChanges();
    }
  }

  async logout(): Promise<void> {
    this.isLoggingOut = true;
    await this.auth.logout();
    await this.router.navigate(['/login']);
    this.isLoggingOut = false;
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

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read selected file.'));
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Unable to encode selected file.'));
          return;
        }

        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
      };
      reader.readAsDataURL(file);
    });
  }
}
