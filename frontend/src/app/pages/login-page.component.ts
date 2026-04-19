import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ViewRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-layout">
      <section class="auth-card">
        <p class="eyebrow">Nanami Admin</p>
        <h1>Login</h1>
        <p class="subtitle">Sign in with your Supabase account to access protected pages.</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          <p class="field-error" *ngIf="showError('email')">
            Please enter a valid email address.
          </p>

          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
          <p class="field-error" *ngIf="showError('password')">
            Password must be at least 8 characters.
          </p>

          <p class="status-error" *ngIf="submitError">{{ submitError }}</p>

          <button type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <p class="hint">
          Visit the public homepage to continue browsing Nanami stories.
          <a [routerLink]="['/']">Go to homepage</a>
          <span class="divider">|</span>
          <a [routerLink]="['/register']">Create account</a>
        </p>
      </section>
    </main>
  `,
  styles: `
    .auth-layout {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 10% 20%, var(--fx-login-warm-glow), transparent 48%),
        radial-gradient(circle at 85% 80%, var(--fx-login-cool-glow), transparent 40%),
        linear-gradient(160deg, var(--clr-fff5ea) 0%, var(--clr-f7fbff) 100%);
    }

    .auth-card {
      width: min(420px, 100%);
      background: var(--color-surface);
      border-radius: 18px;
      border: 1px solid var(--clr-ecd8c5);
      padding: 28px;
      box-shadow: 0 20px 45px var(--fx-shadow-auth);
    }

    .eyebrow {
      margin: 0;
      color: var(--clr-885935);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-weight: 700;
    }

    h1 {
      margin: 8px 0 0;
      color: var(--clr-372217);
      font-size: 30px;
    }

    .subtitle {
      margin: 10px 0 18px;
      color: var(--color-text-muted);
    }

    form {
      display: grid;
      gap: 8px;
    }

    label {
      margin-top: 8px;
      font-weight: 600;
      color: var(--clr-4b3020);
    }

    input {
      height: 42px;
      border: 1px solid var(--clr-dbc5b3);
      border-radius: 10px;
      padding: 0 12px;
      font-size: 15px;
      background: var(--clr-fffdfb);
    }

    input:focus {
      outline: 2px solid var(--clr-f3b88b);
      border-color: var(--clr-d88f58);
      outline-offset: 1px;
    }

    button {
      margin-top: 12px;
      height: 44px;
      border: 0;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-surface);
      background: linear-gradient(90deg, var(--clr-cc6f2d) 0%, var(--clr-d98d53) 100%);
      cursor: pointer;
    }

    button[disabled] {
      cursor: not-allowed;
      opacity: 0.75;
    }

    .field-error,
    .status-error {
      margin: 0;
      font-size: 13px;
      color: var(--color-state-error);
    }

    .hint {
      margin: 18px 0 0;
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .hint a {
      color: var(--color-link);
      font-weight: 600;
    }

    .divider {
      margin: 0 8px;
      color: var(--clr-b59883);
    }

    @media (max-width: 390px) {
      .auth-layout { padding: 16px; }
      .auth-card { padding: 20px; border-radius: 14px; }
      h1 { font-size: 26px; }
      button { height: 46px; }
    }

    @media (min-width: 1280px) {
      .auth-card { padding: 32px; }
    }
  `
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submitError = '';
  isSubmitting = false;

  constructor() {
    if (this.auth.isAuthenticated) {
      void this.router.navigate(['/admin']);
    }
  }

  showError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  async onSubmit(): Promise<void> {
    this.submitError = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email.trim(), password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/';
      await this.router.navigateByUrl(redirect);
    } catch (error) {
      this.submitError =
        error instanceof Error ? error.message : 'Unable to login at the moment.';
    } finally {
      this.isSubmitting = false;
      this.safeDetectChanges();
    }
  }

  private safeDetectChanges(): void {
    const viewRef = this.cdr as ViewRef;
    if (!viewRef.destroyed) {
      this.cdr.detectChanges();
    }
  }
}




