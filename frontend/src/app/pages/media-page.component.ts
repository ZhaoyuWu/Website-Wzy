import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
  template: `
    <main class="media-layout">
      <section class="media-card">
        <div class="header">
          <div>
            <p class="eyebrow">{{ i18n.t('media.eyebrow') }}</p>
            <h1>{{ i18n.t('media.heading') }}</h1>
            <p class="desc">
              {{ i18n.t('media.signedIn', { name: auth.username ?? 'unknown' }) }}
              <span class="role-badge role-{{ auth.userRole.toLowerCase() }}">{{ auth.userRole }}</span>
            </p>
          </div>
          <div class="header-actions">
            <a class="back-home" [routerLink]="['/']">{{ i18n.t('nav.home') }}</a>
            <app-language-picker></app-language-picker>
            <button type="button" class="logout" (click)="logout()" [disabled]="isLoggingOut">
              {{ isLoggingOut ? i18n.t('common.logout.pending') : i18n.t('common.logout') }}
            </button>
          </div>
        </div>
      </section>

      <section class="media-card storage-card" *ngIf="storage">
        <div class="storage-head">
          <span>{{ i18n.t('media.storage.heading') }}</span>
          <span class="storage-value" [class.warn]="storage.status === 'warn'" [class.critical]="storage.status === 'critical'">
            {{ formatBytes(storage.usedBytes) }} / {{ formatBytes(storage.hardLimitBytes) }}
            ({{ storage.percentOfHard }}%)
          </span>
        </div>
        <div class="storage-bar" [attr.aria-label]="i18n.t('media.storage.heading')">
          <div
            class="storage-bar-fill"
            [class.warn]="storage.status === 'warn'"
            [class.critical]="storage.status === 'critical'"
            [style.width.%]="storageBarPercent"
          ></div>
        </div>
        <p class="storage-note" *ngIf="storage.status === 'warn'">
          {{ i18n.t('media.storage.warn') }}
        </p>
        <p class="storage-note critical" *ngIf="storage.status === 'critical'">
          {{ i18n.t('media.storage.critical') }}
        </p>
      </section>

      <section class="media-card">
        <h2>{{ i18n.t('media.section.upload') }}</h2>
        <p class="hint">{{ i18n.t('media.upload.hint2') }}</p>

        <form class="form-grid" (ngSubmit)="uploadMedia()">
          <label>
            <span>{{ i18n.t('media.field.title') }}</span>
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
            <span>{{ i18n.t('media.field.displayDate') }}</span>
            <input
              type="date"
              [(ngModel)]="uploadDisplayDate"
              name="uploadDisplayDate"
              required
              [disabled]="isUploading"
            />
          </label>

          <label>
            <span>{{ i18n.t('media.field.description') }}</span>
            <textarea
              [(ngModel)]="uploadDescription"
              name="uploadDescription"
              maxlength="500"
              rows="3"
              [disabled]="isUploading"
            ></textarea>
          </label>

          <label>
            <span>{{ i18n.t('media.field.file') }}</span>
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
            {{ isUploading ? i18n.t('media.upload.submitting') : i18n.t('media.upload.submit') }}
          </button>
        </form>
      </section>


      <section class="media-card">
        <h2>{{ i18n.t('story.section.new') }}</h2>
        <p class="hint">{{ i18n.t('story.new.hint') }}</p>

        <form class="form-grid" (ngSubmit)="createStoryPost()">
          <label>
            <span>{{ i18n.t('media.field.title') }}</span>
            <input
              type="text"
              [(ngModel)]="storyTitle"
              name="storyTitle"
              maxlength="120"
              required
              [disabled]="isSavingStory"
            />
          </label>

          <label>
            <span>{{ i18n.t('media.field.displayDate') }}</span>
            <input
              type="date"
              [(ngModel)]="storyDisplayDate"
              name="storyDisplayDate"
              required
              [disabled]="isSavingStory"
            />
          </label>

          <label>
            <span>{{ i18n.t('story.field.body') }}</span>
            <textarea
              [(ngModel)]="storyBody"
              name="storyBody"
              maxlength="4000"
              rows="5"
              required
              [disabled]="isSavingStory"
            ></textarea>
          </label>

          <p class="error" *ngIf="storyError">{{ storyError }}</p>
          <p class="success" *ngIf="storySuccess">{{ storySuccess }}</p>

          <button type="submit" [disabled]="isSavingStory">
            {{ isSavingStory ? i18n.t('story.publishing') : i18n.t('story.publish') }}
          </button>
        </form>
      </section>

      <section class="media-card">
        <div class="list-header">
          <h2>{{ i18n.t('media.section.existingUnified') }}</h2>
          <button type="button" class="secondary" (click)="refreshAll()" [disabled]="isRefreshing || isRefreshingStories">
            {{ (isRefreshing || isRefreshingStories) ? i18n.t('media.refreshing') : i18n.t('media.refresh') }}
          </button>
        </div>

        <p class="hint">{{ i18n.t('media.existing.unifiedHint') }}</p>
        <p class="error" *ngIf="listError">{{ listError }}</p>
        <p class="error" *ngIf="storyListError">{{ storyListError }}</p>
        <p class="error" *ngIf="deleteError">{{ deleteError }}</p>
        <p class="error" *ngIf="editError">{{ editError }}</p>
        <p class="error" *ngIf="storyEditError">{{ storyEditError }}</p>
        <p
          class="hint"
          *ngIf="!isRefreshing && !isRefreshingStories && unifiedEntries.length === 0 && !listError && !storyListError"
        >
          {{ i18n.t('media.empty.unified') }}
        </p>

        <ul class="media-list" *ngIf="unifiedEntries.length > 0">
          <li class="media-row" *ngFor="let entry of unifiedEntries; trackBy: trackByUnified">
            <ng-container *ngIf="entry.kind === 'media'">
              <ng-container *ngIf="editingId !== entry.item.id">
                <span class="kind-badge kind-{{ entry.item.media_type }}">{{ entry.item.media_type | uppercase }}</span>
                <strong class="title">{{ entry.item.title }}</strong>
                <span class="timestamp">{{ i18n.t('media.displayDate') }} {{ formatDisplayDate(entry.item.display_date) }}</span>
                <span class="timestamp muted" *ngIf="hasBeenEdited(entry.item)">
                  &middot; {{ i18n.t('media.updated', { time: formatDateTime(entry.item.updated_at) }) }}
                </span>
                <div class="row-actions">
                  <button type="button" class="secondary compact" (click)="startEdit(entry.item)">
                    {{ i18n.t('media.edit') }}
                  </button>
                  <button
                    type="button"
                    class="danger compact"
                    (click)="deleteItem(entry.item)"
                    [disabled]="deletingId === entry.item.id"
                  >
                    {{ deletingId === entry.item.id ? i18n.t('media.deleting') : i18n.t('media.delete') }}
                  </button>
                </div>
              </ng-container>

              <ng-container *ngIf="editingId === entry.item.id && editDraft">
                <div class="edit-form">
                  <label>
                    <span>{{ i18n.t('media.field.title') }}</span>
                    <input
                      type="text"
                      [(ngModel)]="editDraft.title"
                      name="editTitle-{{ entry.item.id }}"
                      maxlength="120"
                      required
                      [disabled]="isSavingEdit"
                    />
                  </label>
                  <label>
                    <span>{{ i18n.t('media.field.displayDate') }}</span>
                    <input
                      type="date"
                      [(ngModel)]="editDraft.displayDate"
                      name="editDate-{{ entry.item.id }}"
                      required
                      [disabled]="isSavingEdit"
                    />
                  </label>
                  <label>
                    <span>{{ i18n.t('media.field.description') }}</span>
                    <textarea
                      [(ngModel)]="editDraft.description"
                      name="editDescription-{{ entry.item.id }}"
                      maxlength="500"
                      rows="3"
                      [disabled]="isSavingEdit"
                    ></textarea>
                  </label>
                  <div class="row-actions">
                    <button type="button" (click)="saveEdit(entry.item)" [disabled]="isSavingEdit">
                      {{ isSavingEdit ? i18n.t('media.saving') : i18n.t('media.save') }}
                    </button>
                    <button type="button" class="secondary" (click)="cancelEdit()" [disabled]="isSavingEdit">
                      {{ i18n.t('media.cancel') }}
                    </button>
                  </div>
                </div>
              </ng-container>
            </ng-container>

            <ng-container *ngIf="entry.kind === 'story'">
              <ng-container *ngIf="editingStoryId !== entry.post.id">
                <span class="kind-badge kind-text">TEXT</span>
                <strong class="title">{{ entry.post.title }}</strong>
                <span class="timestamp">{{ i18n.t('media.displayDate') }} {{ formatDisplayDate(entry.post.display_date) }}</span>
                <span class="timestamp muted" *ngIf="hasStoryBeenEdited(entry.post)">
                  &middot; {{ i18n.t('media.updated', { time: formatDateTime(entry.post.updated_at) }) }}
                </span>
                <div class="row-actions">
                  <button type="button" class="secondary compact" (click)="startEditStory(entry.post)">
                    {{ i18n.t('media.edit') }}
                  </button>
                  <button
                    type="button"
                    class="danger compact"
                    (click)="deleteStoryPost(entry.post)"
                    [disabled]="deletingStoryId === entry.post.id"
                  >
                    {{ deletingStoryId === entry.post.id ? i18n.t('media.deleting') : i18n.t('media.delete') }}
                  </button>
                </div>
              </ng-container>

              <ng-container *ngIf="editingStoryId === entry.post.id && storyEditDraft">
                <div class="edit-form">
                  <label>
                    <span>{{ i18n.t('media.field.title') }}</span>
                    <input
                      type="text"
                      [(ngModel)]="storyEditDraft.title"
                      name="storyEditTitle-{{ entry.post.id }}"
                      maxlength="120"
                      required
                      [disabled]="isSavingStoryEdit"
                    />
                  </label>
                  <label>
                    <span>{{ i18n.t('media.field.displayDate') }}</span>
                    <input
                      type="date"
                      [(ngModel)]="storyEditDraft.displayDate"
                      name="storyEditDate-{{ entry.post.id }}"
                      required
                      [disabled]="isSavingStoryEdit"
                    />
                  </label>
                  <label>
                    <span>{{ i18n.t('story.field.body') }}</span>
                    <textarea
                      [(ngModel)]="storyEditDraft.body"
                      name="storyEditBody-{{ entry.post.id }}"
                      maxlength="4000"
                      rows="5"
                      required
                      [disabled]="isSavingStoryEdit"
                    ></textarea>
                  </label>
                  <div class="row-actions">
                    <button type="button" (click)="saveStoryEdit(entry.post)" [disabled]="isSavingStoryEdit">
                      {{ isSavingStoryEdit ? i18n.t('media.saving') : i18n.t('media.save') }}
                    </button>
                    <button
                      type="button"
                      class="secondary"
                      (click)="cancelStoryEdit()"
                      [disabled]="isSavingStoryEdit"
                    >
                      {{ i18n.t('media.cancel') }}
                    </button>
                  </div>
                </div>
              </ng-container>
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
      background: var(--color-app-bg);
      overflow-x: clip;
    }

    .media-card {
      width: min(980px, 100%);
      margin: 0 auto;
      border-radius: 18px;
      border: 2px solid var(--color-ink);
      background: var(--color-paper);
      padding: 22px;
      box-shadow: 4px 4px 0 var(--color-ink);
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
      color: var(--color-ink);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1,
    h2 {
      margin: 6px 0;
      color: var(--color-ink);
    }

    .desc {
      margin: 0;
      color: var(--color-ink-soft);
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
      background: var(--color-accent);
      color: var(--color-ink);
    }

    .role-publisher {
      background: var(--color-cool-wash);
      color: var(--color-ink);
    }

    .role-viewer {
      background: var(--color-paper-sunk);
      color: var(--color-ink-muted);
    }

    button {
      border: 1.5px solid var(--color-ink);
      border-radius: 10px;
      min-width: 140px;
      min-height: 40px;
      color: var(--color-ink);
      background: var(--color-accent);
      font-weight: 700;
      cursor: pointer;
      padding: 8px 14px;
      transition: background 120ms ease, color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
      font-family: inherit;
    }

    button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 3px 3px 0 var(--color-ink);
    }

    button:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: none;
    }

    button.secondary {
      background: var(--color-cool-wash);
      color: var(--color-ink);
      border: 1.5px solid var(--color-ink);
    }

    button.secondary:hover:not(:disabled) {
      background: var(--color-cool);
      color: var(--color-paper);
    }

    button.danger {
      background: var(--color-accent-contrast);
      color: var(--color-paper);
      min-width: 100px;
    }

    button.danger:hover:not(:disabled) {
      background: var(--color-ink);
      color: var(--color-accent-contrast);
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
      color: var(--color-ink);
      font-weight: 600;
      font-size: 14px;
      padding: 8px 14px;
      border: 1px solid var(--color-ink);
      border-radius: 10px;
      background: var(--color-paper);
      transition: background 120ms ease, transform 120ms ease;
    }

    .back-home:hover {
      background: var(--color-accent);
      transform: translateY(-1px);
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
      color: var(--color-ink-soft);
      font-weight: 600;
      font-size: 14px;
    }

    input,
    textarea {
      border: 1px solid var(--color-ink);
      border-radius: 10px;
      padding: 10px;
      font: inherit;
    }

    .file-meta,
    .hint {
      margin: 0;
      color: var(--color-ink-muted);
    }

    .error {
      margin: 0;
      color: var(--color-accent-contrast);
      font-weight: 600;
    }

    .success {
      margin: 0;
      color: var(--color-ink);
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
      border: 1px solid var(--color-line);
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      background: var(--color-paper);
    }

    .title {
      color: var(--color-ink);
      font-size: 14px;
      min-width: 0;
      flex: 0 1 auto;
      overflow-wrap: anywhere;
    }

    .timestamp {
      color: var(--color-ink-muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .timestamp.muted,
    .muted {
      color: var(--color-ink-muted);
    }

    .story-preview {
      width: 100%;
      margin: 6px 0 0;
      color: var(--color-ink-soft);
      font-size: 13.5px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
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

    .kind-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .kind-image { background: var(--color-cool-wash); color: var(--color-ink); }
    .kind-video { background: var(--color-paper-sunk); color: var(--color-ink); }
    .kind-text { background: var(--color-accent-wash); color: var(--color-ink); }

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

    @media (max-width: 428px) {
      button {
        min-height: 44px;
      }

      button.compact {
        min-height: 40px;
      }

      input,
      textarea {
        padding: 12px;
      }

      .back-home {
        padding: 10px 16px;
      }

      .media-card {
        padding: 18px;
      }

      .edit-form {
        gap: 12px;
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

    @media (max-width: 360px) {
      .media-layout { padding: 10px; }
      .media-card { padding: 14px; }
    }

    @media (min-width: 1280px) {
      .media-layout {
        padding: 28px 32px;
      }

      .media-card {
        width: min(1120px, 100%);
      }
    }

    .storage-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .storage-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--color-ink-soft);
      font-weight: 600;
    }

    .storage-value {
      font-variant-numeric: tabular-nums;
      color: var(--color-ink);
    }

    .storage-value.warn { color: var(--color-accent-contrast); }
    .storage-value.critical { color: var(--color-accent-contrast); font-weight: 800; }

    .storage-bar {
      width: 100%;
      height: 10px;
      background: var(--color-paper-sunk);
      border: 1.5px solid var(--color-ink);
      border-radius: 999px;
      overflow: hidden;
    }

    .storage-bar-fill {
      height: 100%;
      background: var(--color-accent);
      transition: width 240ms ease;
    }

    .storage-bar-fill.warn { background: var(--color-accent-contrast); }
    .storage-bar-fill.critical { background: var(--color-accent-contrast); }

    .storage-note {
      margin: 0;
      font-size: 13px;
      color: var(--color-ink-soft);
    }

    .storage-note.critical { color: var(--color-accent-contrast); font-weight: 700; }
  `
})
export class MediaPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
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
  uploadDisplayDate = MediaPageComponent.todayIso();
  selectedFile: File | null = null;
  uploadError = '';
  uploadSuccess = '';
  isUploading = false;

  storyPosts: StoryPost[] = [];
  storyListError = '';
  isRefreshingStories = false;

  storyTitle = '';
  storyBody = '';
  storyDisplayDate = MediaPageComponent.todayIso();
  storyError = '';
  storySuccess = '';
  isSavingStory = false;

  editingStoryId: number | string | null = null;
  storyEditDraft: StoryEditDraft | null = null;
  storyEditError = '';
  isSavingStoryEdit = false;
  deletingStoryId: number | string | null = null;

  isLoggingOut = false;

  storage: StorageUsage | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/overview'), {
        headers: this.auth.authHeaders()
      });
      if (!response.ok) {
        throw new Error('Unauthorized session');
      }
      await Promise.all([this.loadMediaItems(), this.loadStoryPosts(), this.loadStorageUsage()]);
    } catch {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async loadStorageUsage(): Promise<void> {
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/storage/usage'), {
        headers: this.auth.authHeaders()
      });
      if (!response.ok) {
        this.storage = null;
        return;
      }
      const payload = (await response.json()) as Partial<StorageUsage>;
      if (
        typeof payload.usedBytes !== 'number' ||
        typeof payload.hardLimitBytes !== 'number'
      ) {
        this.storage = null;
        return;
      }
      this.storage = {
        usedBytes: payload.usedBytes,
        softLimitBytes: Number(payload.softLimitBytes) || 0,
        hardLimitBytes: payload.hardLimitBytes,
        percentOfHard: Number(payload.percentOfHard) || 0,
        trackedItems: Number(payload.trackedItems) || 0,
        status: payload.status === 'critical' || payload.status === 'warn' ? payload.status : 'ok'
      };
    } catch {
      this.storage = null;
    }
  }

  get storageBarPercent(): number {
    if (!this.storage || this.storage.hardLimitBytes <= 0) return 0;
    return Math.max(0, Math.min(100, (this.storage.usedBytes / this.storage.hardLimitBytes) * 100));
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

  get unifiedEntries(): UnifiedEntry[] {
    const mediaEntries: UnifiedEntry[] = this.mediaItems.map((item) => ({
      kind: 'media',
      id: item.id,
      displayDate: item.display_date ?? item.created_at ?? '',
      item
    }));
    const storyEntries: UnifiedEntry[] = this.storyPosts.map((post) => ({
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
  }

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
    const displayDate = this.uploadDisplayDate.trim();
    const file = this.selectedFile;

    if (!title || title.length > 120) {
      this.uploadError = 'Title is required and must be at most 120 characters.';
      return;
    }

    if (description.length > 500) {
      this.uploadError = 'Description must be at most 500 characters.';
      return;
    }

    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.uploadError = 'Display date is required (YYYY-MM-DD).';
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
          displayDate,
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
      this.uploadDisplayDate = MediaPageComponent.todayIso();
      this.selectedFile = null;
      this.uploadSuccess = 'Upload completed.';
      await this.loadStorageUsage();
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
      description: item.description ?? '',
      displayDate: item.display_date ?? MediaPageComponent.todayIso()
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
    const displayDate = this.editDraft.displayDate.trim();

    if (!title || title.length > 120) {
      this.editError = 'Title is required and must be at most 120 characters.';
      return;
    }

    if (description.length > 500) {
      this.editError = 'Description must be at most 500 characters.';
      return;
    }

    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.editError = 'Display date must be a valid YYYY-MM-DD.';
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
      await this.loadStorageUsage();
    } catch (error) {
      this.deleteError = error instanceof Error ? error.message : 'Failed to delete media.';
    } finally {
      this.deletingId = null;
      this.cdr.detectChanges();
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
    this.isRefreshingStories = true;
    this.storyListError = '';
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/story-posts'), {
        headers: this.auth.authHeaders()
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        items?: StoryPost[];
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load story posts.');
      }
      this.storyPosts = Array.isArray(payload.items) ? payload.items : [];
    } catch (error) {
      this.storyListError =
        error instanceof Error ? error.message : 'Failed to load story posts.';
    } finally {
      this.isRefreshingStories = false;
      this.cdr.detectChanges();
    }
  }

  async createStoryPost(): Promise<void> {
    this.storyError = '';
    this.storySuccess = '';
    const title = this.storyTitle.trim();
    const body = this.storyBody.trim();
    const displayDate = this.storyDisplayDate.trim();

    if (!title || title.length > 120) {
      this.storyError = 'Title is required and must be at most 120 characters.';
      return;
    }
    if (!body || body.length > 4000) {
      this.storyError = 'Body is required and must be at most 4000 characters.';
      return;
    }
    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.storyError = 'Display date is required (YYYY-MM-DD).';
      return;
    }

    this.isSavingStory = true;
    try {
      const response = await fetch(this.auth.apiUrl('/api/admin/story-posts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.auth.authHeaders()
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
      this.storyPosts = [payload.item, ...this.storyPosts];
      this.storyTitle = '';
      this.storyBody = '';
      this.storyDisplayDate = MediaPageComponent.todayIso();
      this.storySuccess = 'Story post published.';
    } catch (error) {
      this.storyError =
        error instanceof Error ? error.message : 'Failed to publish story post.';
    } finally {
      this.isSavingStory = false;
      this.cdr.detectChanges();
    }
  }

  startEditStory(post: StoryPost): void {
    this.storyEditError = '';
    this.editingStoryId = post.id;
    this.storyEditDraft = {
      title: post.title,
      body: post.body,
      displayDate: post.display_date ?? MediaPageComponent.todayIso()
    };
  }

  cancelStoryEdit(): void {
    this.editingStoryId = null;
    this.storyEditDraft = null;
    this.storyEditError = '';
  }

  async saveStoryEdit(post: StoryPost): Promise<void> {
    if (!this.storyEditDraft) return;
    const title = this.storyEditDraft.title.trim();
    const body = this.storyEditDraft.body.trim();
    const displayDate = this.storyEditDraft.displayDate.trim();

    if (!title || title.length > 120) {
      this.storyEditError = 'Title is required and must be at most 120 characters.';
      return;
    }
    if (!body || body.length > 4000) {
      this.storyEditError = 'Body is required and must be at most 4000 characters.';
      return;
    }
    if (!MediaPageComponent.isIsoDate(displayDate)) {
      this.storyEditError = 'Display date must be a valid YYYY-MM-DD.';
      return;
    }

    this.isSavingStoryEdit = true;
    this.storyEditError = '';
    try {
      const response = await fetch(
        this.auth.apiUrl(`/api/admin/story-posts/${encodeURIComponent(String(post.id))}`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...this.auth.authHeaders()
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
      this.storyPosts = this.storyPosts.map((current) =>
        current.id === post.id ? { ...current, ...saved } : current
      );
      this.editingStoryId = null;
      this.storyEditDraft = null;
    } catch (error) {
      this.storyEditError =
        error instanceof Error ? error.message : 'Failed to save story post.';
    } finally {
      this.isSavingStoryEdit = false;
      this.cdr.detectChanges();
    }
  }

  async deleteStoryPost(post: StoryPost): Promise<void> {
    const confirmed =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`Delete "${post.title}"? This cannot be undone.`)
        : true;
    if (!confirmed) return;

    this.deletingStoryId = post.id;
    try {
      const response = await fetch(
        this.auth.apiUrl(`/api/admin/story-posts/${encodeURIComponent(String(post.id))}`),
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
        throw new Error(payload.message || 'Failed to delete story post.');
      }
      this.storyPosts = this.storyPosts.filter((current) => current.id !== post.id);
    } catch (error) {
      this.storyListError =
        error instanceof Error ? error.message : 'Failed to delete story post.';
    } finally {
      this.deletingStoryId = null;
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
