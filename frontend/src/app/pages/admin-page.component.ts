import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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

type UserRow = {
  id: string;
  email: string;
  role: string;
  created_at?: string;
};

const ASSIGNABLE_ROLES = ['Admin', 'Publisher', 'Viewer'] as const;
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
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="admin-layout">
      <section class="admin-card">
        <div class="header">
          <div>
            <p class="eyebrow">Protected Route</p>
            <h1>Nanami Admin Panel</h1>
            <p class="desc">
              Logged in as {{ auth.username ?? 'unknown' }}
              <span class="role-badge role-{{ auth.userRole.toLowerCase() }}">{{ auth.userRole }}</span>
            </p>
          </div>
          <div class="header-actions">
            <a class="back-home" [routerLink]="['/']">← Home</a>
            <button type="button" class="logout" (click)="logout()" [disabled]="isLoggingOut">
              {{ isLoggingOut ? 'Signing out...' : 'Logout' }}
            </button>
          </div>
        </div>

        <div class="status-row">
          <span>Auth Check</span>
          <strong>{{ authCheckStatus }}</strong>
        </div>
        <p class="message" *ngIf="serverMessage">{{ serverMessage }}</p>
      </section>

      <section class="admin-card" *ngIf="auth.isAdmin">
        <div class="list-header">
          <h2>User Management (Role)</h2>
          <button type="button" class="secondary" (click)="loadUsers()" [disabled]="isLoadingUsers">
            {{ isLoadingUsers ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
        <p class="hint">Admin can assign roles for registered users.</p>
        <p class="error" *ngIf="usersError">{{ usersError }}</p>
        <p class="hint" *ngIf="!isLoadingUsers && users.length === 0 && !usersError">No users found.</p>

        <article class="user-row" *ngFor="let user of users; trackBy: trackByUserId">
          <strong>{{ user.email }}</strong>
          <div class="role-wrap">
            <select
              [ngModel]="user.role"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="updateUserRole(user, $event)"
              [disabled]="savingRoleId === user.id"
            >
              <option *ngFor="let role of assignableRoles" [value]="role">{{ role }}</option>
            </select>
            <span class="message" *ngIf="savingRoleId === user.id">Saving...</span>
            <span class="success" *ngIf="savedRoleId === user.id">Saved</span>
          </div>
        </article>
        <p class="error" *ngIf="roleUpdateError">{{ roleUpdateError }}</p>
      </section>

      <section class="admin-card" *ngIf="!auth.isAdmin && canClaimAdmin">
        <h2>Bootstrap Admin</h2>
        <p class="hint">
          No admin account exists yet. You can claim the first Admin role for project bootstrap.
        </p>
        <p class="error" *ngIf="claimAdminError">{{ claimAdminError }}</p>
        <p class="success" *ngIf="claimAdminSuccess">{{ claimAdminSuccess }}</p>
        <button type="button" (click)="claimAdminRole()" [disabled]="isClaimingAdmin">
          {{ isClaimingAdmin ? 'Claiming...' : 'Claim Admin Role' }}
        </button>
      </section>

      <section class="admin-card" *ngIf="auth.isAdmin">
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

      <section class="admin-card" *ngIf="auth.isPublisherOrAdmin">
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
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" (change)="onFileSelected($event)" [disabled]="isUploading" />
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

      <section class="admin-card" *ngIf="auth.isPublisherOrAdmin">
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
        radial-gradient(circle at 22% 20%, var(--fx-admin-warm-glow), transparent 36%),
        radial-gradient(circle at 90% 10%, var(--fx-admin-green-glow), transparent 32%),
        var(--clr-f4fbf8);
    }

    .admin-card {
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

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--clr-e5f3ec);
      padding-top: 12px;
      margin-top: 4px;
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
    textarea,
    select {
      border: 1px solid var(--color-border-success);
      border-radius: 10px;
      padding: 10px;
      font: inherit;
    }

    .file-meta,
    .hint,
    .message {
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

    .user-row {
      border-top: 1px solid var(--clr-ddede5);
      padding: 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .role-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .media-row {
      border: 1px solid var(--clr-ddede5);
      border-radius: 12px;
      padding: 12px;
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 12px;
      margin-top: 10px;
      background: var(--clr-fbfefc);
      content-visibility: auto;
      contain-intrinsic-size: 260px;
    }

    .thumb {
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--clr-d8e9e0);
      background: var(--clr-f1f6f3);
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
      color: var(--clr-4a6b5d);
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
      color: var(--clr-1f6a49);
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

    @media (max-width: 390px) {
      .admin-card {
        padding: 16px;
      }

      button {
        min-width: 100%;
      }
    }

    @media (min-width: 1280px) {
      .admin-layout {
        padding: 28px 32px;
      }

      .admin-card {
        width: min(1120px, 100%);
      }
    }
  `
})
export class AdminPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  authCheckStatus = 'Checking backend session...';
  serverMessage = '';
  isLoggingOut = false;

  readonly assignableRoles = ASSIGNABLE_ROLES;
  users: UserRow[] = [];
  usersError = '';
  isLoadingUsers = false;
  savingRoleId: string | null = null;
  savedRoleId: string | null = null;
  roleUpdateError = '';
  canClaimAdmin = false;
  isClaimingAdmin = false;
  claimAdminError = '';
  claimAdminSuccess = '';

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
      if (this.auth.isAdmin) {
        await this.loadUsers();
      }
      await this.loadBootstrapStatus();
      if (this.auth.isAdmin) {
        await this.loadSettings();
      }
      if (this.auth.isPublisherOrAdmin) {
        await this.loadMediaItems();
      }
    } catch {
      this.authCheckStatus = 'Session expired or invalid';
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } finally {
      this.cdr.detectChanges();
    }
  }

  trackById(index: number, item: MediaItem): number | string {
    return item.id ?? index;
  }

  trackByUserId(_index: number, user: UserRow): string {
    return user.id;
  }

  async loadUsers(): Promise<void> {
    if (!this.auth.isAdmin) {
      this.users = [];
      return;
    }

    this.isLoadingUsers = true;
    this.usersError = '';
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/users'), {
        headers: this.auth.authHeaders()
      });
      const payload = (await response.json()) as { ok?: boolean; users?: UserRow[]; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load users.');
      }
      this.users = Array.isArray(payload.users) ? payload.users : [];
    } catch (error) {
      this.usersError = error instanceof Error ? error.message : 'Failed to load users.';
    } finally {
      this.isLoadingUsers = false;
      this.cdr.detectChanges();
    }
  }

  async updateUserRole(user: UserRow, newRole: string): Promise<void> {
    this.roleUpdateError = '';
    this.savedRoleId = null;
    this.savingRoleId = user.id;

    try {
      const response = await fetch(this.auth.apiUrl(`/api/admin/users/${encodeURIComponent(user.id)}/role`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.auth.authHeaders()
        },
        body: JSON.stringify({ role: newRole })
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string; user?: UserRow };
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.message || 'Failed to update role.');
      }
      this.users = this.users.map((current) =>
        current.id === user.id ? { ...current, role: payload.user?.role || newRole } : current
      );
      this.savedRoleId = user.id;
      setTimeout(() => {
        this.savedRoleId = null;
      }, 2000);
    } catch (error) {
      this.roleUpdateError = error instanceof Error ? error.message : 'Failed to update role.';
    } finally {
      this.savingRoleId = null;
      this.cdr.detectChanges();
    }
  }

  async loadBootstrapStatus(): Promise<void> {
    this.claimAdminError = '';
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/bootstrap/status'), {
        headers: this.auth.authHeaders()
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        canClaimAdmin?: boolean;
        hasAdmin?: boolean;
      };
      if (!response.ok || !payload.ok) {
        this.canClaimAdmin = false;
        return;
      }
      this.canClaimAdmin = Boolean(payload.canClaimAdmin) && !this.auth.isAdmin;
    } catch {
      this.canClaimAdmin = false;
    }
  }

  async claimAdminRole(): Promise<void> {
    this.claimAdminError = '';
    this.claimAdminSuccess = '';
    this.isClaimingAdmin = true;
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/bootstrap/claim'), {
        method: 'POST',
        headers: this.auth.authHeaders()
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to claim admin role.');
      }
      this.claimAdminSuccess = payload.message || 'Admin role claimed. Please login again.';
      this.canClaimAdmin = false;
    } catch (error) {
      this.claimAdminError = error instanceof Error ? error.message : 'Failed to claim admin role.';
    } finally {
      this.isClaimingAdmin = false;
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
      this.uploadSuccess = 'Upload completed and metadata saved.';
    } catch (error) {
      this.uploadError = error instanceof Error ? error.message : 'Upload failed.';
    } finally {
      this.isUploading = false;
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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





