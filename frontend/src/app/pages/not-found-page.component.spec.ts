import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundPageComponent } from './not-found-page.component';
import { I18nService } from '../core/i18n.service';

describe('NotFoundPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('shows the 404 code and a way back home', async () => {
    const fixture = TestBed.createComponent(NotFoundPageComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('404');
    const backLink = host.querySelector('a.back-home');
    expect(backLink).toBeTruthy();
    expect(backLink?.getAttribute('href')).toBe('/');
  });

  it('has translations for every key in all three languages', () => {
    const i18n = TestBed.inject(I18nService);
    const keys = ['notfound.heading', 'notfound.text', 'title.notFound', 'nav.home'];

    for (const lang of ['en', 'de', 'zh'] as const) {
      i18n.setLang(lang);
      for (const key of keys) {
        const value = i18n.t(key);
        expect(value, `${lang}:${key}`).not.toBe(key);
        expect(value.trim().length, `${lang}:${key}`).toBeGreaterThan(0);
      }
    }
  });
});
