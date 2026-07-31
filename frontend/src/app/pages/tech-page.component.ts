import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { LanguagePickerComponent } from '../components/language-picker.component';

type TechItem = {
  name: string;
  version: string;
  descKey: string;
};

type TechSection = {
  titleKey: string;
  items: TechItem[];
};

@Component({
  selector: 'app-tech-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LanguagePickerComponent],
  templateUrl: './tech-page.component.html',
  styleUrl: './tech-page.component.scss'
})
export class TechPageComponent {
  readonly i18n = inject(I18nService);

  readonly creatorName = 'Zhaoyu Wu';
  readonly repoUrl = 'https://github.com/ZhaoyuWu/Website-Wzy';

  readonly sections: TechSection[] = [
    {
      titleKey: 'tech.section.frontend',
      items: [
        { name: 'Angular', version: '21.2', descKey: 'tech.item.angular' },
        { name: 'TypeScript', version: '5.9', descKey: 'tech.item.typescript' },
        { name: 'Angular Service Worker', version: '21.2', descKey: 'tech.item.sw' }
      ]
    },
    {
      titleKey: 'tech.section.backend',
      items: [
        { name: 'Node.js + Express', version: '22 / 5.2', descKey: 'tech.item.node' }
      ]
    },
    {
      titleKey: 'tech.section.platform',
      items: [
        { name: 'Supabase', version: 'Cloud', descKey: 'tech.item.supabase' },
        { name: 'Vercel', version: 'Cloud', descKey: 'tech.item.vercel' },
        { name: 'Render', version: 'Cloud', descKey: 'tech.item.render' }
      ]
    },
    {
      titleKey: 'tech.section.tooling',
      items: [
        { name: 'GitHub Actions', version: 'CI', descKey: 'tech.item.actions' },
        { name: 'Vitest + node:test', version: '4 / Node 22', descKey: 'tech.item.tests' },
        { name: 'Claude Code', version: 'AI', descKey: 'tech.item.ai' }
      ]
    }
  ];

  trackBySection = (_index: number, section: TechSection): string => section.titleKey;
  trackByItem = (_index: number, item: TechItem): string => item.name;
}
