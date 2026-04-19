import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { I18nService, Lang } from '../core/i18n.service';

type Option = { code: Lang; short: string; labelKey: string };

const OPTIONS: Option[] = [
  { code: 'en', short: 'EN', labelKey: 'lang.en' },
  { code: 'de', short: 'DE', labelKey: 'lang.de' },
  { code: 'zh', short: 'ZH', labelKey: 'lang.zh' }
];

@Component({
  selector: 'app-language-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="picker-root">
      <button
        type="button"
        class="picker-btn"
        [class.open]="isOpen"
        [attr.aria-label]="i18n.t('lang.picker.aria')"
        [attr.aria-expanded]="isOpen"
        aria-haspopup="listbox"
        (click)="toggle($event)"
      >
        <span class="code">{{ currentShort }}</span>
        <svg class="caret" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <ul
        class="menu"
        *ngIf="isOpen"
        role="listbox"
        [attr.aria-label]="i18n.t('lang.picker.aria')"
      >
        <li
          *ngFor="let option of options"
          role="option"
          class="menu-item"
          [class.active]="option.code === i18n.lang()"
          [attr.aria-selected]="option.code === i18n.lang()"
          (click)="pick(option.code)"
        >
          <span class="item-short">{{ option.short }}</span>
          <span class="item-label">{{ i18n.t(option.labelKey) }}</span>
          <span class="item-check" aria-hidden="true" *ngIf="option.code === i18n.lang()">✓</span>
        </li>
      </ul>
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
      position: relative;
    }

    .picker-root {
      position: relative;
    }

    .picker-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      border: 1px solid var(--color-line);
      border-radius: 999px;
      background: var(--color-paper);
      color: var(--color-ink-soft);
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      line-height: 1;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease;
    }

    .picker-btn:hover {
      background: var(--color-accent);
      border-color: var(--color-ink);
      color: var(--color-ink);
      transform: translateY(-1px);
    }

    .picker-btn.open {
      background: var(--color-accent);
      border-color: var(--color-ink);
      color: var(--color-ink);
    }

    .picker-btn:active {
      transform: translateY(0);
    }

    .caret {
      width: 10px;
      height: 6px;
      transition: transform 150ms ease;
    }

    .picker-btn.open .caret {
      transform: rotate(180deg);
    }

    .menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 170px;
      margin: 0;
      padding: 6px;
      list-style: none;
      border: 1.5px solid var(--color-ink);
      border-radius: 14px;
      background: var(--color-paper);
      box-shadow: 4px 4px 0 var(--color-ink);
      z-index: 200;
    }

    .menu-item {
      display: grid;
      grid-template-columns: 28px 1fr 18px;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      color: var(--color-ink);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      user-select: none;
    }

    .menu-item:hover {
      background: var(--color-accent-wash);
    }

    .menu-item.active {
      background: var(--color-accent);
    }

    .item-short {
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.06em;
      color: var(--color-ink);
    }

    .item-label {
      color: var(--color-ink-soft);
      font-weight: 500;
    }

    .menu-item.active .item-label {
      color: var(--color-ink);
      font-weight: 700;
    }

    .item-check {
      justify-self: end;
      font-size: 14px;
      font-weight: 800;
    }
  `
})
export class LanguagePickerComponent {
  readonly i18n = inject(I18nService);
  readonly options = OPTIONS;
  isOpen = false;

  private readonly host = inject(ElementRef<HTMLElement>);

  get currentShort(): string {
    return OPTIONS.find((o) => o.code === this.i18n.lang())?.short ?? 'EN';
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  pick(code: Lang): void {
    this.i18n.setLang(code);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.isOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.isOpen = false;
  }
}
