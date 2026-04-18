import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

type MediaType = 'image' | 'video';

type ShowcaseItem = {
  id: string | number;
  title: string;
  description: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string | null;
};

type RawMediaRow = {
  id?: string | number;
  title?: string;
  description?: string;
  media_type?: string;
  type?: string;
  public_url?: string;
  media_url?: string;
  url?: string;
  thumbnail_url?: string | null;
  created_at?: string;
};

type ShowcaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  mediaTable: string;
  selectColumns: string;
};

declare global {
  interface Window {
    __NANAMI_SHOWCASE_CONFIG__?: Partial<ShowcaseConfig>;
  }
}

@Component({
  selector: 'app-showcase-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="showcase-page">
      <header class="top-nav">
        <a class="brand" [routerLink]="['/']">Nanami Journal</a>
        <nav>
          <a [routerLink]="['/']">Home</a>
          <a [routerLink]="['/showcase']" aria-current="page">Showcase</a>
          <a [routerLink]="['/login']">Admin Login</a>
        </nav>
      </header>

      <section class="hero">
        <p class="eyebrow">Public Showcase</p>
        <h1>Photos and videos from Nanami's daily life</h1>
        <p>Media is loaded from Supabase metadata and rendered for public viewing.</p>
      </section>

      <section class="state state-loading" *ngIf="isLoading">Loading showcase media...</section>
      <section class="state state-error" *ngIf="errorMessage">{{ errorMessage }}</section>
      <section class="state state-empty" *ngIf="!isLoading && !errorMessage && items.length === 0">
        No media yet. Please check back soon.
      </section>

      <section class="grid" *ngIf="!isLoading && !errorMessage && items.length > 0">
        <article class="card" *ngFor="let item of items; trackBy: trackById">
          <div class="media-frame">
            <img
              *ngIf="item.mediaType === 'image'"
              [src]="item.mediaUrl"
              [alt]="item.title"
              loading="lazy"
              decoding="async"
              (error)="onImageError($event)"
            />

            <video
              *ngIf="item.mediaType === 'video'"
              [src]="item.mediaUrl"
              [poster]="item.thumbnailUrl || undefined"
              controls
              preload="metadata"
              playsinline
            ></video>
          </div>

          <div class="meta">
            <h2>{{ item.title }}</h2>
            <p class="desc">{{ item.description }}</p>
            <p class="time" *ngIf="item.createdAt">Added: {{ formatDate(item.createdAt) }}</p>
          </div>
        </article>
      </section>
    </main>
  `,
  styles: `
    .showcase-page {
      min-height: 100vh;
      padding: 20px;
      background:
        radial-gradient(circle at 12% 22%, rgba(255, 205, 157, 0.4), transparent 36%),
        radial-gradient(circle at 88% 10%, rgba(149, 210, 255, 0.35), transparent 32%),
        linear-gradient(180deg, #fff7ee 0%, #f1f8ff 100%);
    }

    .top-nav {
      width: min(1100px, 100%);
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 10px 0 18px;
    }

    .brand {
      color: #673716;
      font-weight: 800;
      text-decoration: none;
      letter-spacing: 0.02em;
    }

    nav {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    nav a {
      color: #5f412b;
      text-decoration: none;
      border: 1px solid #e4ccb8;
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.78);
      font-size: 14px;
      font-weight: 600;
    }

    nav a[aria-current='page'] {
      border-color: #bf7a49;
      background: #fff0e2;
    }

    .hero {
      width: min(1100px, 100%);
      margin: 0 auto 20px;
      border: 1px solid #ebd7c6;
      border-radius: 22px;
      padding: clamp(20px, 4vw, 34px);
      background: #ffffffed;
      box-shadow: 0 18px 40px rgba(46, 27, 10, 0.1);
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-size: 12px;
      font-weight: 700;
      color: #9a5a2f;
    }

    h1 {
      margin: 10px 0;
      color: #331f13;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.1;
      max-width: 18ch;
    }

    .hero p {
      margin: 0;
      color: #5b4534;
    }

    .state {
      width: min(1100px, 100%);
      margin: 0 auto 14px;
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 600;
    }

    .state-loading {
      color: #4c4d52;
      background: #ffffffcf;
      border: 1px solid #dcdfe7;
    }

    .state-error {
      color: #8d2a2a;
      background: #fff0ef;
      border: 1px solid #efc4c2;
    }

    .state-empty {
      color: #4f5f70;
      background: #f4f9ff;
      border: 1px solid #cfe0f2;
    }

    .grid {
      width: min(1100px, 100%);
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .card {
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid #d9e8f5;
      background: #ffffff;
      box-shadow: 0 12px 28px rgba(24, 55, 82, 0.08);
    }

    .media-frame {
      background: #f4f8fc;
      aspect-ratio: 16 / 10;
      border-bottom: 1px solid #e7eef7;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .media-frame img,
    .media-frame video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .meta {
      padding: 14px;
    }

    .meta h2 {
      margin: 0;
      font-size: 20px;
      color: #1f3d5a;
    }

    .desc {
      margin: 8px 0 0;
      color: #3a5268;
      line-height: 1.5;
    }

    .time {
      margin: 10px 0 0;
      color: #60758a;
      font-size: 13px;
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .showcase-page {
        padding: 14px;
      }

      .top-nav {
        flex-direction: column;
        align-items: flex-start;
      }

      nav {
        justify-content: flex-start;
      }
    }
  `
})
export class ShowcasePageComponent implements OnInit {
  items: ShowcaseItem[] = [];
  isLoading = true;
  errorMessage = '';

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const config = this.readConfig();
      const rows = await this.fetchRows(config);
      this.items = rows
        .map((row) => this.mapRowToItem(row))
        .filter((item): item is ShowcaseItem => item !== null);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Unable to load showcase media right now.';
    } finally {
      this.isLoading = false;
    }
  }

  trackById(index: number, item: ShowcaseItem): string | number {
    return item.id ?? index;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) {
      return;
    }

    target.alt = `${target.alt} (failed to load)`;
    target.style.objectFit = 'contain';
    target.style.padding = '20px';
    target.style.background = '#eef3f8';
  }

  formatDate(rawDate: string): string {
    const timestamp = Date.parse(rawDate);
    if (Number.isNaN(timestamp)) {
      return rawDate;
    }
    return new Date(timestamp).toLocaleString();
  }

  private readConfig(): ShowcaseConfig {
    const runtimeConfig = window.__NANAMI_SHOWCASE_CONFIG__ ?? {};
    const envConfig = {
      supabaseUrl: this.getWindowEnv('SUPABASE_URL'),
      supabaseAnonKey: this.getWindowEnv('SUPABASE_ANON_KEY'),
      mediaTable: this.getWindowEnv('SUPABASE_MEDIA_TABLE'),
      selectColumns: this.getWindowEnv('SUPABASE_MEDIA_SELECT')
    };

    const config: ShowcaseConfig = {
      supabaseUrl: this.pickConfigValue(runtimeConfig.supabaseUrl, envConfig.supabaseUrl),
      supabaseAnonKey: this.pickConfigValue(runtimeConfig.supabaseAnonKey, envConfig.supabaseAnonKey),
      mediaTable: this.pickConfigValue(runtimeConfig.mediaTable, envConfig.mediaTable) || 'media_items',
      selectColumns:
        this.pickConfigValue(runtimeConfig.selectColumns, envConfig.selectColumns) ||
        'id,title,description,media_type,public_url,thumbnail_url,created_at'
    };

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY at runtime.');
    }

    return config;
  }

  private pickConfigValue(primary?: string, fallback?: string): string {
    return (primary || fallback || '').trim();
  }

  private getWindowEnv(name: string): string {
    const runtimeWindow = window as unknown as { [key: string]: unknown };
    const globalValue =
      typeof runtimeWindow[name] === 'string'
        ? String(runtimeWindow[name])
        : '';

    if (globalValue) {
      return globalValue;
    }

    try {
      return localStorage.getItem(name) ?? '';
    } catch {
      return '';
    }
  }

  private async fetchRows(config: ShowcaseConfig): Promise<RawMediaRow[]> {
    const cleanedBase = config.supabaseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanedBase}/rest/v1/${encodeURIComponent(config.mediaTable)}?select=${encodeURIComponent(config.selectColumns)}&order=created_at.desc`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status}).`);
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error('Unexpected Supabase response format.');
    }

    return payload as RawMediaRow[];
  }

  private mapRowToItem(row: RawMediaRow): ShowcaseItem | null {
    const mediaUrl = String(row.public_url || row.media_url || row.url || '').trim();
    if (!mediaUrl) {
      return null;
    }

    const rawType = String(row.media_type || row.type || '').toLowerCase();
    const mediaType: MediaType = rawType === 'video' ? 'video' : 'image';

    return {
      id: row.id ?? mediaUrl,
      title: String(row.title || 'Untitled media'),
      description: String(row.description || ''),
      mediaType,
      mediaUrl,
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      createdAt: row.created_at ? String(row.created_at) : null
    };
  }
}
