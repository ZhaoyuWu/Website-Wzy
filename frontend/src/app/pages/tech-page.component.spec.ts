import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TechPageComponent } from './tech-page.component';
import { I18nService } from '../core/i18n.service';

describe('TechPageComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TechPageComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('lists every stack section with named items and versions', async () => {
    const fixture = TestBed.createComponent(TechPageComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent || '';

    for (const expected of ['Angular', 'TypeScript', 'Node.js + Express', 'Supabase', 'Vercel', 'Render', 'GitHub Actions', 'Claude Code']) {
      expect(text).toContain(expected);
    }
    expect(text).toContain('21.2');
    expect(text).toContain('5.9');
  });

  it('credits the creator and links to the source repository', async () => {
    const fixture = TestBed.createComponent(TechPageComponent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Zhaoyu Wu');
    const sourceLink = host.querySelector('a.source-link') as HTMLAnchorElement | null;
    expect(sourceLink).toBeTruthy();
    expect(sourceLink?.href).toContain('github.com/ZhaoyuWu');
    expect(sourceLink?.rel).toContain('noopener');
  });

  it('has translations for every tech key in all three languages', () => {
    const i18n = TestBed.inject(I18nService);
    const component = TestBed.createComponent(TechPageComponent).componentInstance;
    const keys = [
      'nav.tech',
      'tech.eyebrow',
      'tech.heading',
      'tech.intro',
      'tech.section.creator',
      'tech.creator.by',
      'tech.creator.dog',
      'tech.creator.dogName',
      'tech.creator.source',
      ...component.sections.map((s) => s.titleKey),
      ...component.sections.flatMap((s) => s.items.map((i) => i.descKey))
    ];

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
