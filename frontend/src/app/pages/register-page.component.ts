import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ViewRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-layout">
      <section class="auth-card">
        <p class="eyebrow">Nanami Community</p>
        <h1>Create Account</h1>
        <p class="subtitle">Register to sign in and access protected features.</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <label for="username">Username</label>
          <input id="username" type="text" formControlName="username" autocomplete="username" />
          <p class="field-error" *ngIf="showError('username')">
            Username must be 3-32 chars (letters, numbers, dot, underscore, dash).
          </p>

          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          <p class="field-error" *ngIf="showError('email')">Please enter a valid email address.</p>

          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="new-password" />
          <p class="field-error" *ngIf="showError('password')">
            Password must be at least 8 characters.
          </p>

          <label for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
          />
          <p class="field-error" *ngIf="passwordMismatch">
            Password confirmation does not match.
          </p>

          <p class="status-error" *ngIf="submitError">{{ submitError }}</p>

          <button type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p class="hint">
          Already have an account? <a [routerLink]="['/login']">Sign in</a>
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
        radial-gradient(circle at 12% 18%, var(--fx-register-warm-glow), transparent 45%),
        radial-gradient(circle at 86% 82%, var(--fx-register-cool-glow), transparent 40%),
        linear-gradient(160deg, var(--clr-fff7ef) 0%, var(--clr-f4fbff) 100%);
    }

    .auth-card {
      width: min(460px, 100%);
      background: var(--color-surface);
      border-radius: 18px;
      border: 1px solid var(--clr-e7d9cc);
      padding: 28px;
      box-shadow: 0 20px 45px var(--fx-shadow-auth);
    }

    .eyebrow {
      margin: 0;
      color: var(--clr-7e5a1a);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-weight: 700;
    }

    h1 {
      margin: 8px 0 0;
      color: var(--clr-2f2716);
      font-size: 30px;
    }

    .subtitle {
      margin: 10px 0 18px;
      color: var(--clr-675b47);
    }

    form {
      display: grid;
      gap: 8px;
    }

    label {
      margin-top: 8px;
      font-weight: 600;
      color: var(--clr-443824);
    }

    input {
      height: 42px;
      border: 1px solid var(--clr-d9ccbf);
      border-radius: 10px;
      padding: 0 12px;
      font-size: 15px;
      background: var(--clr-fffefc);
    }

    input:focus {
      outline: 2px solid var(--clr-d5c085);
      border-color: var(--clr-b89d5f);
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
      background: linear-gradient(90deg, var(--clr-87682a) 0%, var(--clr-ac8740) 100%);
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
      color: var(--clr-6e6352);
      font-size: 13px;
    }

    .hint a {
      color: var(--clr-74530e);
      font-weight: 600;
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
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]{3,32}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  submitError = '';
  isSubmitting = false;

  get passwordMismatch(): boolean {
    const { password, confirmPassword } = this.form.getRawValue();
    const confirmControl = this.form.controls.confirmPassword;
    return (
      confirmControl.touched &&
      !!confirmPassword &&
      !!password &&
      password !== confirmPassword
    );
  }

  showError(controlName: 'username' | 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  async onSubmit(): Promise<void> {
    this.submitError = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, email, password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.form.controls.confirmPassword.markAsTouched();
      return;
    }

    this.isSubmitting = true;
    try {
      await this.auth.register(username.trim(), email.trim(), password);
      await this.router.navigate(['/admin']);
    } catch (error) {
      this.submitError =
        error instanceof Error ? error.message : 'Unable to register at the moment.';
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





