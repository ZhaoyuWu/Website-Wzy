import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

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
            <a class="back-home" [routerLink]="['/']"><- Home</a>
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
        <h2>Media Uploads</h2>
        <p class="hint">
          Upload and manage Nanami media on the dedicated page:
          <a class="inline-link" [routerLink]="['/manage-media']">Manage Media -></a>
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
      color: var(--clr-1f6a49);
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





