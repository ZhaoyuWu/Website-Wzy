import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

interface SiteSettings {
  profileName: string;
  heroTagline: string;
  aboutText: string;
  contactEmail: string;
  showContactEmail: boolean;
  updatedAt?: string | null;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  created_at?: string;
}

const ASSIGNABLE_ROLES = ['Admin', 'Publisher', 'Viewer'] as const;

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  profileName: 'Nanami',
  heroTagline: 'Nanami, the sunshine of every walk.',
  aboutText:
    "This page shares Nanami's personality, daily routine, and favorite places in a warm timeline style.",
  contactEmail: '',
  showContactEmail: false,
  updatedAt: null,
};

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [FormsModule, RouterLink, LanguagePickerComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  // All async-mutated state lives in signals so zoneless change detection
  // picks up every update without manual detectChanges() calls.
  readonly authCheckStatus = signal('Checking backend session...');
  readonly serverMessage = signal('');
  readonly isLoggingOut = signal(false);

  readonly assignableRoles = ASSIGNABLE_ROLES;
  readonly users = signal<UserRow[]>([]);
  readonly usersError = signal('');
  readonly isLoadingUsers = signal(false);
  readonly savingRoleId = signal<string | null>(null);
  readonly savedRoleId = signal<string | null>(null);
  readonly roleUpdateError = signal('');
  readonly canClaimAdmin = signal(false);
  readonly isClaimingAdmin = signal(false);
  readonly claimAdminError = signal('');
  readonly claimAdminSuccess = signal('');

  // The form object is replaced wholesale after load/save; ngModel mutates
  // its fields in place between replacements.
  readonly settingsForm = signal<SiteSettings>({ ...DEFAULT_SITE_SETTINGS });
  readonly settingsError = signal('');
  readonly settingsSuccess = signal('');
  readonly isLoadingSettings = signal(false);
  readonly isSavingSettings = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const response = await this.auth.apiFetch('/api/admin/overview', {});

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error('Unauthorized session');
      }

      this.authCheckStatus.set('Authenticated');
      this.serverMessage.set(payload.message || 'Admin API is reachable.');
      if (this.auth.isAdmin) {
        await this.loadUsers();
      }
      await this.loadBootstrapStatus();
      if (this.auth.isAdmin) {
        await this.loadSettings();
      }
    } catch {
      this.authCheckStatus.set('Session expired or invalid');
      await this.auth.logout();
      await this.router.navigate(['/login']);
    }
  }

  trackByUserId(_index: number, user: UserRow): string {
    return user.id;
  }

  async loadUsers(): Promise<void> {
    if (!this.auth.isAdmin) {
      this.users.set([]);
      return;
    }

    this.isLoadingUsers.set(true);
    this.usersError.set('');
    try {
      const response = await this.auth.apiFetch('/api/admin/users', {});
      const payload = (await response.json()) as {
        ok?: boolean;
        users?: UserRow[];
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to load users.');
      }
      this.users.set(Array.isArray(payload.users) ? payload.users : []);
    } catch (error) {
      this.usersError.set(error instanceof Error ? error.message : 'Failed to load users.');
    } finally {
      this.isLoadingUsers.set(false);
    }
  }

  async updateUserRole(user: UserRow, newRole: string): Promise<void> {
    this.roleUpdateError.set('');
    this.savedRoleId.set(null);
    this.savingRoleId.set(user.id);

    try {
      const response = await this.auth.apiFetch(
        `/api/admin/users/${encodeURIComponent(user.id)}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: newRole }),
        },
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string; user?: UserRow };
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.message || 'Failed to update role.');
      }
      this.users.update((users) =>
        users.map((current) =>
          current.id === user.id ? { ...current, role: payload.user?.role || newRole } : current,
        ),
      );
      this.savedRoleId.set(user.id);
      setTimeout(() => {
        this.savedRoleId.set(null);
      }, 2000);
    } catch (error) {
      this.roleUpdateError.set(error instanceof Error ? error.message : 'Failed to update role.');
    } finally {
      this.savingRoleId.set(null);
    }
  }

  async loadBootstrapStatus(): Promise<void> {
    this.claimAdminError.set('');
    try {
      const response = await this.auth.apiFetch('/api/admin/bootstrap/status', {});
      const payload = (await response.json()) as {
        ok?: boolean;
        canClaimAdmin?: boolean;
        hasAdmin?: boolean;
      };
      if (!response.ok || !payload.ok) {
        this.canClaimAdmin.set(false);
        return;
      }
      this.canClaimAdmin.set(Boolean(payload.canClaimAdmin) && !this.auth.isAdmin);
    } catch {
      this.canClaimAdmin.set(false);
    }
  }

  async claimAdminRole(): Promise<void> {
    this.claimAdminError.set('');
    this.claimAdminSuccess.set('');
    this.isClaimingAdmin.set(true);
    try {
      const response = await this.auth.apiFetch('/api/admin/bootstrap/claim', {
        method: 'POST',
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Failed to claim admin role.');
      }
      this.claimAdminSuccess.set(payload.message || 'Admin role claimed. Please login again.');
      this.canClaimAdmin.set(false);
    } catch (error) {
      this.claimAdminError.set(
        error instanceof Error ? error.message : 'Failed to claim admin role.',
      );
    } finally {
      this.isClaimingAdmin.set(false);
    }
  }

  async loadSettings(): Promise<void> {
    this.isLoadingSettings.set(true);
    this.settingsError.set('');
    this.settingsSuccess.set('');

    try {
      const response = await this.auth.apiFetch('/api/admin/settings', {});
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        settings?: Partial<SiteSettings>;
      };

      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message || 'Failed to load settings.');
      }

      this.settingsForm.set(this.mergeSettings(payload.settings));
    } catch (error) {
      this.settingsError.set(error instanceof Error ? error.message : 'Failed to load settings.');
    } finally {
      this.isLoadingSettings.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    this.settingsError.set('');
    this.settingsSuccess.set('');

    const form = this.settingsForm();
    const profileName = form.profileName.trim();
    const heroTagline = form.heroTagline.trim();
    const aboutText = form.aboutText.trim();
    const contactEmail = form.contactEmail.trim().toLowerCase();

    if (!profileName || profileName.length > 80) {
      this.settingsError.set('Profile name must be 1-80 characters.');
      return;
    }

    if (!heroTagline || heroTagline.length > 180) {
      this.settingsError.set('Hero tagline must be 1-180 characters.');
      return;
    }

    if (!aboutText || aboutText.length > 1200) {
      this.settingsError.set('About text must be 1-1200 characters.');
      return;
    }

    if (contactEmail && !this.isValidEmail(contactEmail)) {
      this.settingsError.set('Contact email must be empty or a valid email address.');
      return;
    }

    this.isSavingSettings.set(true);
    try {
      const response = await this.auth.apiFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileName,
          heroTagline,
          aboutText,
          contactEmail,
          showContactEmail: Boolean(form.showContactEmail),
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        settings?: Partial<SiteSettings>;
      };

      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message || 'Failed to save settings.');
      }

      this.settingsForm.set(this.mergeSettings(payload.settings));
      this.settingsSuccess.set(payload.message || 'Settings saved.');
    } catch (error) {
      this.settingsError.set(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      this.isSavingSettings.set(false);
    }
  }

  async logout(): Promise<void> {
    this.isLoggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login']);
    this.isLoggingOut.set(false);
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
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
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
