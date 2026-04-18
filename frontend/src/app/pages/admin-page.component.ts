import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

type MediaItem = {
  id: number | string;
  title: string;
  description: string;
  media_type: 'image' | 'video' | string;
  public_url: string;
  created_at?: string;
};

type SiteSettings = {
  profileName: string;
  heroTagline: string;
  aboutText: string;
  contactEmail: string;
  showContactEmail: boolean;
  updatedAt?: string | null;
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  profileName: 'Nanami',
  heroTagline: 'Nanami, the sunshine of every walk.',
  aboutText: "This page shares Nanami's personality, daily routine, and favorite places in a warm timeline style.",
  contactEmail: '',
  showContactEmail: false,
  updatedAt: null
};

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="admin-layout">
      <section class="admin-card">
        <div class="header">
          <div>
            <p class="eyebrow">Protected Route</p>
            <h1>Nanami Admin Panel</h1>
            <p class="desc">Logged in as {{ auth.username ?? 'admin' }}</p>
          </div>
          <button type="button" class="logout" (click)="logout()" [disabled]="isLoggingOut">
            {{ isLoggingOut ? 'Signing out...' : 'Logout' }}
          </button>
        </div>

        <div class="status-row">
          <span>Auth Check</span>
          <strong>{{ authCheckStatus }}</strong>
        </div>
        <p class="message" *ngIf="serverMessage">{{ serverMessage }}</p>
      </section>

      <section class="admin-card">
        <h2>Information & Settings (T-005)</h2>
        <p class="hint">Manage public profile text and contact preference shown on the homepage.</p>

        <form class="form-grid" (ngSubmit)="saveSettings()">
          <label>
            <span>Profile Name</span>
            <input
              type="text"
              [(ngModel)]="settingsForm.profileName"
              name="profileName"
              maxlength="80"
              required
              [disabled]="isSavingSettings || isLoadingSettings"
            />
          </label>

          <label>
            <span>Hero Tagline</span>
            <input
              type="text"
              [(ngModel)]="settingsForm.heroTagline"
              name="heroTagline"
              maxlength="180"
              required
              [disabled]="isSavingSettings || isLoadingSettings"
            />
          </label>

          <label>
            <span>About Text</span>
            <textarea
              [(ngModel)]="settingsForm.aboutText"
              name="aboutText"
              maxlength="1200"
              rows="4"
              required
              [disabled]="isSavingSettings || isLoadingSettings"
            ></textarea>
          </label>

          <label>
            <span>Contact Email (optional)</span>
            <input
              type="email"
              [(ngModel)]="settingsForm.contactEmail"
              name="contactEmail"
              maxlength="120"
              [disabled]="isSavingSettings || isLoadingSettings"
            />
          </label>

          <label class="checkbox-label">
            <input
              type="checkbox"
              [(ngModel)]="settingsForm.showContactEmail"
              name="showContactEmail"
              [disabled]="isSavingSettings || isLoadingSettings"
            />
            <span>Show contact email on homepage</span>
          </label>

          <p class="message" *ngIf="settingsForm.updatedAt">
            Last updated: {{ formatDateTime(settingsForm.updatedAt) }}
          </p>
          <p class="error" *ngIf="settingsError">{{ settingsError }}</p>
          <p class="success" *ngIf="settingsSuccess">{{ settingsSuccess }}</p>

          <div class="row-actions">
            <button type="submit" [disabled]="isSavingSettings || isLoadingSettings">
              {{ isSavingSettings ? 'Saving...' : 'Save Settings' }}
            </button>
            <button
              type="button"
              class="secondary"
              (click)="loadSettings()"
              [disabled]="isSavingSettings || isLoadingSettings"
            >
              {{ isLoadingSettings ? 'Loading...' : 'Reload Settings' }}
            </button>
          </div>
        </form>
      </section>

      <section class="admin-card">
        <h2>Upload Media (T-004)</h2>
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
            <span>Description</span>
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
            <input type="file" (change)="onFileSelected($event)" [disabled]="isUploading" required />
          </label>

          <p class="file-meta" *ngIf="selectedFile">
            {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})
          </p>

          <p class="error" *ngIf="uploadError">{{ uploadError }}</p>
          <p class="success" *ngIf="uploadSuccess">{{ uploadSuccess }}</p>

          <button type="submit" [disabled]="isUploading">
            {{ isUploading ? 'Uploading...' : 'Upload and Save Metadata' }}
          </button>
        </form>
      </section>

      <section class="admin-card">
        <div class="list-header">
          <h2>Existing Media</h2>
          <button type="button" class="secondary" (click)="loadMediaItems()" [disabled]="isRefreshing">
            {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <p class="message" *ngIf="mediaLoadError">{{ mediaLoadError }}</p>
        <p class="hint" *ngIf="!isRefreshing && mediaItems.length === 0">No media items yet.</p>

        <article class="media-row" *ngFor="let item of mediaItems; trackBy: trackById">
          <div class="thumb" *ngIf="item.media_type === 'image'">
            <img [src]="item.public_url" [alt]="item.title" loading="lazy" decoding="async" />
          </div>
          <div class="thumb" *ngIf="item.media_type === 'video'">
            <video [src]="item.public_url" controls preload="metadata" playsinline></video>
          </div>

          <div class="meta-edit">
            <p class="type">{{ item.media_type.toUpperCase() }}</p>
            <input
              type="text"
              [(ngModel)]="item.title"
              [ngModelOptions]="{ standalone: true }"
              maxlength="120"
            />
            <textarea
              [(ngModel)]="item.description"
              [ngModelOptions]="{ standalone: true }"
              maxlength="500"
              rows="2"
            ></textarea>

            <div class="row-actions">
              <button type="button" class="secondary" (click)="saveItem(item)" [disabled]="isSavingId === item.id">
                {{ isSavingId === item.id ? 'Saving...' : 'Save Metadata' }}
              </button>
              <a [href]="item.public_url" target="_blank" rel="noreferrer">Open</a>
            </div>
          </div>
        </article>
      </section>
    </main>
  `,
  styles: `
    .admin-layout {
      min-height: 100vh;
      padding: 20px;
      display: grid;
      gap: 16px;
      align-content: start;
      background:
        radial-gradient(circle at 22% 20%, rgba(255, 204, 147, 0.35), transparent 36%),
        radial-gradient(circle at 90% 10%, rgba(148, 226, 199, 0.34), transparent 32%),
        #f4fbf8;
    }

    .admin-card {
      width: min(980px, 100%);
      margin: 0 auto;
      border-radius: 18px;
      border: 1px solid #c7e5d8;
      background: #ffffff;
      padding: 22px;
      box-shadow: 0 14px 36px rgba(8, 68, 42, 0.12);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }

    .eyebrow {
      margin: 0;
      color: #257b58;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1,
    h2 {
      margin: 6px 0;
      color: #163526;
    }

    .desc {
      margin: 0;
      color: #3b5e4d;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e5f3ec;
      padding-top: 12px;
      margin-top: 4px;
    }

    button {
      border: 0;
      border-radius: 10px;
      min-width: 140px;
      min-height: 40px;
      color: #fff;
      background: linear-gradient(90deg, #20865b 0%, #2b9b6d 100%);
      font-weight: 700;
      cursor: pointer;
      padding: 8px 14px;
    }

    button.secondary {
      background: #eef6f2;
      color: #206346;
      border: 1px solid #cce5d8;
    }

    button[disabled] {
      cursor: not-allowed;
      opacity: 0.7;
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
      color: #1f4e37;
      font-weight: 600;
      font-size: 14px;
    }

    input,
    textarea {
      border: 1px solid #cce5d8;
      border-radius: 10px;
      padding: 10px;
      font: inherit;
    }

    .file-meta,
    .hint,
    .message {
      margin: 0;
      color: #416654;
    }

    .error {
      margin: 0;
      color: #9b2e2e;
      font-weight: 600;
    }

    .success {
      margin: 0;
      color: #1f754f;
      font-weight: 600;
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .media-row {
      border: 1px solid #ddede5;
      border-radius: 12px;
      padding: 12px;
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 12px;
      margin-top: 10px;
      background: #fbfefc;
    }

    .thumb {
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #d8e9e0;
      background: #f1f6f3;
    }

    .thumb img,
    .thumb video {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .meta-edit {
      display: grid;
      gap: 8px;
    }

    .type {
      margin: 0;
      color: #4a6b5d;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    .row-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
    }

    .checkbox-label input {
      width: 18px;
      height: 18px;
      margin: 0;
    }

    .row-actions a {
      color: #1f6a49;
      text-decoration: none;
      font-weight: 600;
    }

    @media (max-width: 760px) {
      .admin-layout {
        padding: 12px;
      }

      .header,
      .list-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .media-row {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class AdminPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  authCheckStatus = 'Checking backend session...';
  serverMessage = '';
  isLoggingOut = false;

  mediaItems: MediaItem[] = [];
  mediaLoadError = '';
  isRefreshing = false;

  uploadTitle = '';
  uploadDescription = '';
  selectedFile: File | null = null;
  uploadError = '';
  uploadSuccess = '';
  isUploading = false;
  isSavingId: number | string | null = null;

  settingsForm: SiteSettings = { ...DEFAULT_SITE_SETTINGS };
  settingsError = '';
  settingsSuccess = '';
  isLoadingSettings = false;
  isSavingSettings = false;

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/overview'), {
        headers: this.auth.authHeaders()
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error('Unauthorized session');
      }

      this.authCheckStatus = 'Authenticated';
      this.serverMessage = payload.message || 'Admin API is reachable.';
      await this.loadSettings();
      await this.loadMediaItems();
    } catch {
      this.authCheckStatus = 'Session expired or invalid';
      await this.auth.logout();
      await this.router.navigate(['/login']);
    }
  }

  trackById(index: number, item: MediaItem): number | string {
    return item.id ?? index;
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
      this.uploadSuccess = 'Upload completed and metadata saved.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'Upload failed.';
    } finally {
      this.isUploading = false;
    }
  }

  async saveItem(item: MediaItem): Promise<void> {
    const title = item.title.trim();
    const description = item.description.trim();

    if (!title || title.length > 120) {
      this.mediaLoadError = 'Title is required and must be at most 120 characters.';
      return;
    }

    if (description.length > 500) {
      this.mediaLoadError = 'Description must be at most 500 characters.';
      return;
    }

    this.mediaLoadError = '';
    this.isSavingId = item.id;

    try {
      const response = await fetch(this.auth.apiUrl(`/api/admin/media/${encodeURIComponent(String(item.id))}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.auth.authHeaders()
        },
        body: JSON.stringify({ title, description })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        item?: MediaItem;
      };

      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.message || 'Failed to save metadata.');
      }

      this.mediaItems = this.mediaItems.map((current) =>
        current.id === item.id ? payload.item ?? current : current
      );
    } catch (error) {
      this.mediaLoadError = error instanceof Error ? error.message : 'Failed to save metadata.';
    } finally {
      this.isSavingId = null;
    }
  }

  async loadMediaItems(): Promise<void> {
    this.isRefreshing = true;
    this.mediaLoadError = '';

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
      this.mediaLoadError =
        error instanceof Error ? error.message : 'Failed to load media list.';
    } finally {
      this.isRefreshing = false;
    }
  }

  async loadSettings(): Promise<void> {
    this.isLoadingSettings = true;
    this.settingsError = '';
    this.settingsSuccess = '';

    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/settings'), {
        headers: this.auth.authHeaders()
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        settings?: Partial<SiteSettings>;
      };

      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message || 'Failed to load settings.');
      }

      this.settingsForm = this.mergeSettings(payload.settings);
    } catch (error) {
      this.settingsError = error instanceof Error ? error.message : 'Failed to load settings.';
    } finally {
      this.isLoadingSettings = false;
    }
  }

  async saveSettings(): Promise<void> {
    this.settingsError = '';
    this.settingsSuccess = '';

    const profileName = this.settingsForm.profileName.trim();
    const heroTagline = this.settingsForm.heroTagline.trim();
    const aboutText = this.settingsForm.aboutText.trim();
    const contactEmail = this.settingsForm.contactEmail.trim().toLowerCase();

    if (!profileName || profileName.length > 80) {
      this.settingsError = 'Profile name must be 1-80 characters.';
      return;
    }

    if (!heroTagline || heroTagline.length > 180) {
      this.settingsError = 'Hero tagline must be 1-180 characters.';
      return;
    }

    if (!aboutText || aboutText.length > 1200) {
      this.settingsError = 'About text must be 1-1200 characters.';
      return;
    }

    if (contactEmail && !this.isValidEmail(contactEmail)) {
      this.settingsError = 'Contact email must be empty or a valid email address.';
      return;
    }

    this.isSavingSettings = true;
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/settings'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.auth.authHeaders()
        },
        body: JSON.stringify({
          profileName,
          heroTagline,
          aboutText,
          contactEmail,
          showContactEmail: Boolean(this.settingsForm.showContactEmail)
        })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        settings?: Partial<SiteSettings>;
      };

      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message || 'Failed to save settings.');
      }

      this.settingsForm = this.mergeSettings(payload.settings);
      this.settingsSuccess = payload.message || 'Settings saved.';
    } catch (error) {
      this.settingsError = error instanceof Error ? error.message : 'Failed to save settings.';
    } finally {
      this.isSavingSettings = false;
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

  formatDateTime(rawDate: string): string {
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

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private mergeSettings(raw: Partial<SiteSettings>): SiteSettings {
    return {
      profileName: this.pickSafeText(raw.profileName, DEFAULT_SITE_SETTINGS.profileName, 80),
      heroTagline: this.pickSafeText(raw.heroTagline, DEFAULT_SITE_SETTINGS.heroTagline, 180),
      aboutText: this.pickSafeText(raw.aboutText, DEFAULT_SITE_SETTINGS.aboutText, 1200),
      contactEmail: this.pickSafeText(raw.contactEmail, '', 120),
      showContactEmail: Boolean(raw.showContactEmail),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null
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
