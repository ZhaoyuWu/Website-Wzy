import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';

const SITE_NAME = 'Nanami Journal';

// Resolves route `title` values as i18n keys and re-applies the document
// title whenever the visitor switches languages.
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly i18n = inject(I18nService);
  private readonly title = inject(Title);
  private lastKey: string | null = null;

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastKey = this.buildTitle(snapshot) ?? null;
    this.apply();
  }

  private apply(): void {
    if (this.lastKey) {
      this.title.setTitle(`${this.i18n.t(this.lastKey)} · ${SITE_NAME}`);
    } else {
      this.title.setTitle(SITE_NAME);
    }
  }
}
