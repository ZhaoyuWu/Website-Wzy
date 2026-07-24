import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subscription, filter } from 'rxjs';
import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-update-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="updateAvailable" class="update-prompt" role="status">
      <span class="msg">{{ i18n.t('app.update.available') }}</span>
      <button type="button" class="btn" (click)="reload()">
        {{ i18n.t('app.update.reload') }}
      </button>
    </div>
  `,
  styles: `
    .update-prompt {
      position: fixed;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
      transform: translateX(-50%);
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px 10px 16px;
      background: var(--color-paper);
      border: 1.5px solid var(--color-ink);
      border-radius: 999px;
      box-shadow: 4px 4px 0 var(--color-ink);
      font-family: 'Kalam', 'Caveat', 'Segoe Script', cursive;
      font-size: 14px;
      color: var(--color-ink);
      animation: update-prompt-pop 320ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn {
      border: 1px solid var(--color-ink);
      background: var(--color-accent);
      color: var(--color-ink);
      font: inherit;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 999px;
      cursor: pointer;
    }
    .btn:hover { background: var(--color-accent-soft); }
    @keyframes update-prompt-pop {
      from { opacity: 0; transform: translate(-50%, 8px); }
      to   { opacity: 1; transform: translate(-50%, 0);   }
    }
  `
})
export class UpdatePromptComponent implements OnInit, OnDestroy {
  private readonly swUpdate = inject(SwUpdate);
  readonly i18n = inject(I18nService);

  updateAvailable = false;
  private sub: Subscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) return;

    // Surface a "new version" prompt when ngsw fetches an update.
    this.sub = this.swUpdate.versionUpdates
      .pipe(filter((evt: VersionEvent) => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateAvailable = true;
      });

    // Background poll every 30 min so long-lived PWA tabs find updates.
    this.pollTimer = setInterval(() => {
      this.swUpdate.checkForUpdate().catch(() => {});
    }, 30 * 60 * 1000);
  }

  reload(): void {
    this.swUpdate
      .activateUpdate()
      .catch(() => {})
      .finally(() => location.reload());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
    }
  }
}
