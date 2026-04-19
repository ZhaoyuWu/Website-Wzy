import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ViewRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LanguagePickerComponent],
  template: `
    <main class="auth-layout">
      <section class="auth-card">
        <div class="card-head">
          <p class="eyebrow">{{ i18n.t('register.eyebrow') }}</p>
          <app-language-picker></app-language-picker>
        </div>
        <h1>{{ i18n.t('register.heading') }}</h1>
        <p class="subtitle">{{ i18n.t('register.subtitle') }}</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <label for="username">{{ i18n.t('register.field.username') }}</label>
          <input id="username" type="text" formControlName="username" autocomplete="username" />
          <p class="field-error" *ngIf="showError('username')">
            {{ i18n.t('register.error.username') }}
          </p>

          <label for="email">{{ i18n.t('register.field.email') }}</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          <p class="field-error" *ngIf="showError('email')">{{ i18n.t('register.error.email') }}</p>

          <label for="password">{{ i18n.t('register.field.password') }}</label>
          <input id="password" type="password" formControlName="password" autocomplete="new-password" />
          <p class="field-error" *ngIf="showError('password')">
            {{ i18n.t('register.error.password') }}
          </p>

          <label for="confirmPassword">{{ i18n.t('register.field.confirmPassword') }}</label>
          <input
            id="confirmPassword"
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
          />
          <p class="field-error" *ngIf="passwordMismatch">
            {{ i18n.t('register.error.confirm') }}
          </p>

          <p class="status-error" *ngIf="submitError">{{ submitError }}</p>

          <button type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? i18n.t('register.submitting') : i18n.t('register.submit') }}
          </button>
        </form>

        <p class="hint">
          {{ i18n.t('register.footer.text') }}
          <a [routerLink]="['/login']">{{ i18n.t('register.footer.login') }}</a>
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
      background: var(--color-app-bg);
    }

    .auth-card {
      width: min(460px, 100%);
      background: var(--color-paper);
      border-radius: 18px;
      border: 2px solid var(--color-ink);
      padding: 28px;
      box-shadow: 6px 6px 0 var(--color-ink);
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .eyebrow {
      margin: 0;
      color: var(--color-ink);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 800;
    }

    h1 {
      margin: 8px 0 0;
      color: var(--color-ink);
      font-size: 30px;
    }

    .subtitle {
      margin: 10px 0 18px;
      color: var(--color-ink-muted);
    }

    form {
      display: grid;
      gap: 8px;
    }

    label {
      margin-top: 8px;
      font-weight: 600;
      color: var(--color-ink-soft);
    }

    input {
      height: 42px;
      border: 1.5px solid var(--color-ink);
      border-radius: 10px;
      padding: 0 12px;
      font-size: 15px;
      background: var(--color-paper);
    }

    input:focus {
      outline: 2px solid var(--color-accent);
      outline-offset: 1px;
    }

    button {
      margin-top: 12px;
      height: 44px;
      border: 1.5px solid var(--color-ink);
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-ink);
      background: var(--color-accent);
      cursor: pointer;
    }

    button[disabled] {
      cursor: not-allowed;
      opacity: 0.55;
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
  readonly i18n = inject(I18nService);
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
        error instanceof Error ? error.message : this.i18n.t('register.error.generic');
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





