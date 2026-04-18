import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="admin-layout">
      <section class="admin-card">
        <div class="header">
          <div>
            <p class="eyebrow">Protected Route</p>
            <h1>Nanami Admin Panel</h1>
            <p class="desc">Logged in as {{ auth.username ?? 'admin' }}</p>
          </div>
          <button type="button" (click)="logout()" [disabled]="isLoggingOut">
            {{ isLoggingOut ? 'Signing out...' : 'Logout' }}
          </button>
        </div>

        <div class="status-row">
          <span>Auth Check</span>
          <strong>{{ authCheckStatus }}</strong>
        </div>
        <p class="message" *ngIf="serverMessage">{{ serverMessage }}</p>
      </section>
    </main>
  `,
  styles: `
    .admin-layout {
      min-height: 100vh;
      padding: 24px;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 22% 20%, rgba(255, 204, 147, 0.35), transparent 36%),
        radial-gradient(circle at 90% 10%, rgba(148, 226, 199, 0.34), transparent 32%),
        #f4fbf8;
    }

    .admin-card {
      width: min(760px, 100%);
      border-radius: 18px;
      border: 1px solid #c7e5d8;
      background: #ffffff;
      padding: 26px;
      box-shadow: 0 14px 36px rgba(8, 68, 42, 0.12);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    .eyebrow {
      margin: 0;
      color: #257b58;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    h1 {
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
      padding-top: 16px;
      margin-top: 4px;
    }

    button {
      border: 0;
      border-radius: 10px;
      min-width: 120px;
      height: 40px;
      color: #fff;
      background: linear-gradient(90deg, #20865b 0%, #2b9b6d 100%);
      font-weight: 700;
      cursor: pointer;
    }

    button[disabled] {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .message {
      margin: 12px 0 0;
      color: #3b5e4d;
    }
  `
})
export class AdminPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  authCheckStatus = 'Checking backend session...';
  serverMessage = '';
  isLoggingOut = false;

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch('http://localhost:4000/api/admin/overview', {
        headers: this.auth.authHeaders()
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error('Unauthorized session');
      }

      this.authCheckStatus = 'Authenticated';
      this.serverMessage = payload.message || 'Admin API is reachable.';
    } catch {
      this.authCheckStatus = 'Session expired or invalid';
      await this.auth.logout();
      await this.router.navigate(['/login']);
    }
  }

  async logout(): Promise<void> {
    this.isLoggingOut = true;
    await this.auth.logout();
    await this.router.navigate(['/login']);
    this.isLoggingOut = false;
  }
}
