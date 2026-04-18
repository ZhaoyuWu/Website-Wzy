import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
        radial-gradient(circle at 12% 18%, rgba(247, 225, 174, 0.45), transparent 45%),
        radial-gradient(circle at 86% 82%, rgba(188, 227, 245, 0.48), transparent 40%),
        linear-gradient(160deg, #fff7ef 0%, #f4fbff 100%);
    }

    .auth-card {
      width: min(460px, 100%);
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #e7d9cc;
      padding: 28px;
      box-shadow: 0 20px 45px rgba(47, 28, 7, 0.12);
    }

    .eyebrow {
      margin: 0;
      color: #7e5a1a;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-weight: 700;
    }

    h1 {
      margin: 8px 0 0;
      color: #2f2716;
      font-size: 30px;
    }

    .subtitle {
      margin: 10px 0 18px;
      color: #675b47;
    }

    form {
      display: grid;
      gap: 8px;
    }

    label {
      margin-top: 8px;
      font-weight: 600;
      color: #443824;
    }

    input {
      height: 42px;
      border: 1px solid #d9ccbf;
      border-radius: 10px;
      padding: 0 12px;
      font-size: 15px;
      background: #fffefc;
    }

    input:focus {
      outline: 2px solid #d5c085;
      border-color: #b89d5f;
      outline-offset: 1px;
    }

    button {
      margin-top: 12px;
      height: 44px;
      border: 0;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      background: linear-gradient(90deg, #87682a 0%, #ac8740 100%);
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
      color: #b02222;
    }

    .hint {
      margin: 18px 0 0;
      color: #6e6352;
      font-size: 13px;
    }

    .hint a {
      color: #74530e;
      font-weight: 600;
    }
  `
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
    }
  }
}

