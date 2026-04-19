import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

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
  imports: [CommonModule, FormsModule, RouterLink, LanguagePickerComponent],
  template: `
    <main class="admin-layout">
      <section class="admin-card">
        <div class="header">
          <div>
            <p class="eyebrow">{{ i18n.t('admin.eyebrow') }}</p>
            <h1>{{ i18n.t('admin.heading') }}</h1>
            <p class="desc">
              {{ i18n.t('admin.loggedIn', { name: auth.username ?? 'unknown' }) }}
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

        <div class="status-row">
          <span>{{ i18n.t('admin.authCheck') }}</span>
          <strong>{{ authCheckStatus }}</strong>
        </div>
        <p class="message" *ngIf="serverMessage">{{ serverMessage }}</p>
      </section>

      <section class="admin-card" *ngIf="auth.isAdmin">
        <div class="list-header">
          <h2>{{ i18n.t('admin.section.users') }}</h2>
          <button type="button" class="secondary" (click)="loadUsers()" [disabled]="isLoadingUsers">
            {{ isLoadingUsers ? i18n.t('admin.users.loading') : i18n.t('admin.users.refresh') }}
          </button>
        </div>
        <p class="hint">{{ i18n.t('admin.users.hint') }}</p>
        <p class="error" *ngIf="usersError">{{ usersError }}</p>
        <p class="hint" *ngIf="!isLoadingUsers && users.length === 0 && !usersError">{{ i18n.t('admin.users.empty') }}</p>

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
            <span class="message" *ngIf="savingRoleId === user.id">{{ i18n.t('admin.users.savingRole') }}</span>
            <span class="success" *ngIf="savedRoleId === user.id">{{ i18n.t('admin.users.savedRole') }}</span>
          </div>
        </article>
        <p class="error" *ngIf="roleUpdateError">{{ roleUpdateError }}</p>
      </section>

      <section class="admin-card" *ngIf="!auth.isAdmin && canClaimAdmin">
        <h2>{{ i18n.t('admin.section.bootstrap') }}</h2>
        <p class="hint">{{ i18n.t('admin.bootstrap.hint') }}</p>
        <p class="error" *ngIf="claimAdminError">{{ claimAdminError }}</p>
        <p class="success" *ngIf="claimAdminSuccess">{{ claimAdminSuccess }}</p>
        <button type="button" (click)="claimAdminRole()" [disabled]="isClaimingAdmin">
          {{ isClaimingAdmin ? i18n.t('admin.bootstrap.claiming') : i18n.t('admin.bootstrap.claim') }}
        </button>
      </section>

      <section class="admin-card" *ngIf="auth.isAdmin">
        <h2>{{ i18n.t('admin.section.settings') }}</h2>
        <p class="hint">{{ i18n.t('admin.settings.hint') }}</p>

        <form class="form-grid" (ngSubmit)="saveSettings()">
          <label>
            <span>{{ i18n.t('admin.field.profileName') }}</span>
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
            <span>{{ i18n.t('admin.field.heroTagline') }}</span>
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
            <span>{{ i18n.t('admin.field.aboutText') }}</span>
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
            <span>{{ i18n.t('admin.field.contactEmail') }}</span>
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
            <span>{{ i18n.t('admin.field.showContact') }}</span>
          </label>

          <p class="message" *ngIf="settingsForm.updatedAt">
            {{ i18n.t('admin.settings.lastUpdated', { time: formatDateTime(settingsForm.updatedAt) }) }}
          </p>
          <p class="error" *ngIf="settingsError">{{ settingsError }}</p>
          <p class="success" *ngIf="settingsSuccess">{{ settingsSuccess }}</p>

          <div class="row-actions">
            <button type="submit" [disabled]="isSavingSettings || isLoadingSettings">
              {{ isSavingSettings ? i18n.t('admin.savingSettings') : i18n.t('admin.saveSettings') }}
            </button>
            <button
              type="button"
              class="secondary"
              (click)="loadSettings()"
              [disabled]="isSavingSettings || isLoadingSettings"
            >
              {{ isLoadingSettings ? i18n.t('admin.loadingSettings') : i18n.t('admin.reloadSettings') }}
            </button>
          </div>
        </form>
      </section>

      <section class="admin-card" *ngIf="auth.isPublisherOrAdmin">
        <h2>{{ i18n.t('admin.section.media') }}</h2>
        <p class="hint">
          {{ i18n.t('admin.media.hint') }}
          <a class="inline-link" [routerLink]="['/manage-media']">{{ i18n.t('admin.media.link') }}</a>
        </p>
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
      background: var(--color-app-bg);
      overflow-x: clip;
    }

    .admin-card {
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

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--color-line);
      padding-top: 12px;
      margin-top: 4px;
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

    button[disabled] {
      cursor: not-allowed;
      opacity: 0.5;
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
    textarea,
    select {
      border: 1px solid var(--color-ink);
      border-radius: 10px;
      padding: 10px;
      font: inherit;
    }

    .file-meta,
    .hint,
    .message {
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

    .user-row {
      border-top: 1px solid var(--color-line);
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

    .inline-link {
      color: var(--color-ink);
      font-weight: 600;
      text-decoration: none;
      margin-left: 4px;
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
    }

    @media (max-width: 428px) {
      button {
        min-height: 44px;
      }

      input,
      textarea,
      select {
        padding: 12px;
      }

      .back-home {
        padding: 10px 16px;
      }

      .admin-card {
        padding: 18px;
      }

      .user-row {
        flex-direction: column;
        align-items: stretch;
      }

      .role-wrap {
        width: 100%;
      }

      .role-wrap select {
        flex: 1;
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

    @media (max-width: 360px) {
      .admin-layout { padding: 10px; }
      .admin-card { padding: 14px; }
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
  readonly i18n = inject(I18nService);
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
    } catch {
      this.authCheckStatus = 'Session expired or invalid';
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } finally {
      this.cdr.detectChanges();
    }
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

  formatDateTime(rawDate: string): string {
    const timestamp = Date.parse(rawDate);
    if (Number.isNaN(timestamp)) {
      return rawDate;
    }
    return new Date(timestamp).toLocaleString();
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
}





