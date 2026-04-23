import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { resolveApiBaseUrl } from '../core/runtime-config';

export type TimelineEntryType = 'image' | 'video' | 'text';

export type TimelineEntry = {
  type: TimelineEntryType;
  id: string | number;
  title: string;
  description: string;
  body: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  likesCount: number;
  commentsCount: number;
  displayDate: string | null;
  createdAt: string | null;
};

type RawTimelineEntry = {
  type?: string;
  id?: string | number;
  title?: string;
  description?: string;
  body?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  likesCount?: number | string;
  commentsCount?: number | string;
  likedByMe?: boolean;
  displayDate?: string | null;
  createdAt?: string | null;
};

type TimelineResponse = {
  ok?: boolean;
  items?: RawTimelineEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type StoryComment = {
  id: number | string;
  entry_type: 'media' | 'text';
  entry_id: number;
  author_name: string;
  message: string;
  created_at: string;
};

type StoryCommentsResponse = {
  ok?: boolean;
  items?: StoryComment[];
  total?: number;
  message?: string;
};

const LIKED_STORAGE_KEY = 'nanami.story.likes';

@Component({
  selector: 'app-story-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="timeline-wrap">
      <header class="timeline-head">
        <p class="eyebrow font-caveat">{{ i18n.t('story.eyebrow') }}</p>
        <h2>{{ i18n.t('story.heading') }}</h2>
      </header>

      <section class="state state-loading" *ngIf="isLoading">{{ i18n.t('story.state.loading') }}</section>
      <section class="state state-error" *ngIf="errorMessage">{{ errorMessage }}</section>
      <section class="state state-empty" *ngIf="!isLoading && !errorMessage && entries.length === 0">
        {{ i18n.t('story.state.empty') }}
      </section>

      <ol
        class="timeline"
        *ngIf="!isLoading && !errorMessage && entries.length > 0"
      >
        <li
          class="entry entry-reveal"
          *ngFor="let entry of entries; let i = index; trackBy: trackByKey"
          #entryNode
          [class.align-right]="i % 2 === 1"
          [style.--stagger-index]="i % 6"
          [attr.data-entry-key]="trackByKey(i, entry)"
          [attr.data-type]="entry.type"
        >
          <div class="anchor" aria-hidden="true">
            <span class="dot"></span>
            <span class="anchor-date" *ngIf="entry.displayDate || entry.createdAt">
              {{ formatDay(entry.displayDate || entry.createdAt) }}
            </span>
          </div>

          <article class="card" [class.card-text]="entry.type === 'text'">
            <div class="media-frame" *ngIf="entry.type !== 'text' && entry.mediaUrl">
              <button
                *ngIf="entry.type === 'image'"
                type="button"
                class="media-button"
                [attr.aria-label]="i18n.t('story.lightbox.open', { title: entry.title })"
                (click)="openFullscreen(entry)"
              >
                <img
                  [src]="entry.mediaUrl"
                  [alt]="entry.title"
                  loading="lazy"
                  decoding="async"
                  (error)="onImageError($event)"
                />
              </button>

              <video
                *ngIf="entry.type === 'video'"
                [src]="entry.mediaUrl"
                [poster]="entry.thumbnailUrl || undefined"
                controls
                preload="metadata"
                playsinline
              ></video>
            </div>

            <div class="meta">
              <h3>{{ entry.title }}</h3>
              <p class="desc" *ngIf="entry.type !== 'text' && entry.description">{{ entry.description }}</p>
              <p class="body" *ngIf="entry.type === 'text' && entry.body">{{ entry.body }}</p>
              <div class="foot">
                <div class="engagement">
                  <button
                    type="button"
                    class="like-button"
                    [class.liked]="isLiked(entry)"
                    [disabled]="isLikePending(entry)"
                    [attr.aria-pressed]="isLiked(entry)"
                    [attr.aria-label]="i18n.t(isLiked(entry) ? 'story.like.unlike' : 'story.like.like', { title: entry.title })"
                    (click)="onToggleLike(entry)"
                  >
                    <span class="heart" aria-hidden="true">{{ isLiked(entry) ? '♥' : '♡' }}</span>
                    <span class="count">{{ entry.likesCount }}</span>
                  </button>
                  <button
                    type="button"
                    class="comment-button"
                    [attr.aria-label]="i18n.t('story.comment.open', { title: entry.title })"
                    (click)="openCommentModal(entry)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M5 5h14v10H9l-4 4V5z" />
                    </svg>
                    <span>{{ i18n.t('story.comment.label') }}</span>
                    <span class="count">{{ entry.commentsCount }}</span>
                  </button>
                </div>
                <time *ngIf="entry.displayDate || entry.createdAt">{{ formatFull(entry.displayDate || entry.createdAt) }}</time>
              </div>
            </div>
          </article>
        </li>
      </ol>

      <nav class="pager" *ngIf="totalPages > 1" [attr.aria-label]="i18n.t('story.pager.aria')">
        <button
          type="button"
          class="pager-edge"
          (click)="goToPage(page - 1)"
          [disabled]="page <= 1 || isLoading"
        >
          ‹
        </button>
        <button
          type="button"
          class="pager-num"
          *ngFor="let n of pageNumbers"
          [class.active]="n === page"
          [disabled]="isLoading"
          (click)="goToPage(n)"
        >
          {{ n }}
        </button>
        <button
          type="button"
          class="pager-edge"
          (click)="goToPage(page + 1)"
          [disabled]="page >= totalPages || isLoading"
        >
          ›
        </button>
      </nav>
    </div>

    <div
      class="lightbox"
      *ngIf="activeImage"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="activeImage.title"
      (click)="closeFullscreen()"
    >
      <button
        type="button"
        class="lightbox-close"
        [attr.aria-label]="i18n.t('story.lightbox.close')"
        (click)="closeFullscreen(); $event.stopPropagation()"
      >
        ×
      </button>
      <figure class="lightbox-figure" (click)="$event.stopPropagation()">
        <img [src]="activeImage.mediaUrl || ''" [alt]="activeImage.title" />
        <figcaption>
          <strong>{{ activeImage.title }}</strong>
          <span *ngIf="activeImage.description">{{ activeImage.description }}</span>
        </figcaption>
      </figure>
    </div>

    <div
      class="comment-modal-mask"
      *ngIf="commentModalEntry"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="i18n.t('story.comment.modal.title')"
      (click)="closeCommentModal()"
    >
      <section class="comment-modal" (click)="$event.stopPropagation()">
        <header>
          <h3>{{ i18n.t('story.comment.modal.title') }}</h3>
          <button type="button" class="comment-close" (click)="closeCommentModal()" [attr.aria-label]="i18n.t('story.comment.modal.close')">x</button>
        </header>

        <p class="comment-target">{{ commentModalEntry.title }}</p>
        <p class="comment-author">{{ i18n.t('story.comment.modal.authorLabel') }} {{ auth.username || i18n.t('story.comment.modal.loginHint') }}</p>

        <textarea
          [(ngModel)]="commentDraft"
          rows="4"
          maxlength="500"
          [attr.placeholder]="i18n.t('story.comment.modal.placeholder')"
          [disabled]="isCommentSubmitting"
        ></textarea>

        <p class="comment-error" *ngIf="commentError">{{ commentError }}</p>
        <p class="comment-success" *ngIf="commentSuccess">{{ commentSuccess }}</p>

        <div class="comment-actions">
          <button type="button" class="comment-submit" (click)="submitComment()" [disabled]="isCommentSubmitting">
            {{ isCommentSubmitting ? i18n.t('story.comment.modal.submitting') : i18n.t('story.comment.modal.submit') }}
          </button>
          <button type="button" class="comment-cancel" (click)="closeCommentModal()" [disabled]="isCommentSubmitting">
            {{ i18n.t('story.comment.modal.cancel') }}
          </button>
        </div>

        <div class="comment-list">
          <p *ngIf="isCommentLoading">{{ i18n.t('story.comment.modal.loading') }}</p>
          <p class="comment-error" *ngIf="commentLoadError">{{ commentLoadError }}</p>
          <p *ngIf="!isCommentLoading && !commentLoadError && activeComments.length === 0">{{ i18n.t('story.comment.modal.empty') }}</p>
          <article class="comment-row" *ngFor="let item of activeComments; trackBy: trackByCommentId">
            <header>
              <strong>{{ item.author_name }}</strong>
              <div class="comment-row-tools">
                <time>{{ formatFull(item.created_at) }}</time>
                <button
                  *ngIf="auth.isAdmin"
                  type="button"
                  class="comment-delete"
                  [disabled]="isCommentDeleting(item)"
                  [attr.aria-label]="i18n.t('story.comment.modal.deleteAria', { id: item.id })"
                  (click)="deleteComment(item)"
                >
                  x
                </button>
              </div>
            </header>
            <p>{{ item.message }}</p>
          </article>
        </div>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .timeline-wrap {
      width: min(1100px, 100%);
      margin: 0 auto;
    }

    .timeline-head {
      text-align: center;
      margin-bottom: 18px;
    }

    .timeline-head .eyebrow {
      margin: 0;
      color: var(--color-ink);
      font-size: 28px;
      line-height: 1;
      letter-spacing: 0.02em;
    }

    .timeline-head h2 {
      margin: 6px 0 0;
      color: var(--color-ink);
      font-size: clamp(20px, 3vw, 28px);
    }

    .state {
      text-align: center;
      padding: 16px;
      border-radius: 14px;
      font-weight: 600;
      border: 1px solid var(--color-line);
      background: var(--color-paper);
    }

    .state-loading { color: var(--color-ink-muted); }
    .state-error { color: var(--color-accent-contrast); border-color: var(--color-accent-contrast); }
    .state-empty { color: var(--color-ink-muted); }

    .timeline {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      position: relative;
    }

    .timeline::before {
      content: '';
      position: absolute;
      top: 16px;
      bottom: 16px;
      left: 50%;
      width: 3px;
      transform: translateX(-50%);
      background: var(--color-ink);
      border-radius: 2px;
      opacity: 0.9;
    }

    .entry {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 56px 1fr;
      align-items: start;
      margin: 18px 0;
    }

    .entry.entry-reveal {
      opacity: 0;
      transform: translateY(16px) scale(0.987);
      transition:
        opacity var(--motion-duration-enter) var(--motion-ease-emphasized),
        transform var(--motion-duration-enter) var(--motion-ease-emphasized);
      transition-delay: calc(var(--stagger-index, 0) * 70ms);
    }

    .entry.entry-reveal.entry-visible {
      opacity: 1;
      transform: none;
    }

    .anchor {
      grid-column: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 24px;
    }

    .dot {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: var(--color-accent);
      border: 2px solid var(--color-ink);
      box-shadow: 0 0 0 4px var(--color-app-bg);
    }

    .anchor-date {
      margin-top: 10px;
      padding: 2px 8px;
      border: 1px solid var(--color-ink);
      border-radius: 999px;
      background: var(--color-paper);
      color: var(--color-ink-soft);
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
    }

    .entry .card {
      grid-column: 1;
      margin-right: 12px;
      border-radius: 16px;
      border: 2px solid var(--color-ink);
      background: var(--color-paper);
      box-shadow: 4px 4px 0 var(--color-ink);
      overflow: hidden;
      transform-style: preserve-3d;
      transition:
        transform var(--motion-duration-enter) var(--motion-ease-emphasized),
        box-shadow var(--motion-duration-enter) var(--motion-ease-emphasized),
        border-color var(--motion-duration-enter) var(--motion-ease-emphasized);
    }

    .entry.align-right .card {
      grid-column: 3;
      margin-right: 0;
      margin-left: 12px;
    }

    .card-text {
      background: var(--color-accent-wash);
    }

    .media-frame {
      background: var(--color-paper-sunk);
      aspect-ratio: 16 / 10;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-bottom: 2px solid var(--color-ink);
      position: relative;
    }

    .media-frame img,
    .media-frame video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform var(--motion-duration-enter) var(--motion-ease-emphasized);
    }

    .media-frame::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: var(--fx-timeline-media-shimmer);
      transform: translateX(-130%);
      opacity: 0;
      transition:
        transform var(--motion-duration-enter) var(--motion-ease-emphasized),
        opacity var(--motion-duration-standard) var(--motion-ease-standard);
    }

    .media-button {
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
      border: 0;
      background: transparent;
      cursor: zoom-in;
      display: block;
      transition: transform var(--motion-duration-fast) var(--motion-ease-standard);
    }

    .media-button:focus-visible {
      outline: 3px solid var(--color-accent);
      outline-offset: -3px;
    }

    @media (hover: hover) and (pointer: fine) {
      .entry[data-type='image'] .card:hover,
      .entry[data-type='video'] .card:hover {
        transform: perspective(920px) rotateX(1.8deg) rotateY(-2.2deg) translateY(-3px);
        box-shadow: 8px 10px 0 var(--color-ink);
      }

      .entry.align-right[data-type='image'] .card:hover,
      .entry.align-right[data-type='video'] .card:hover {
        transform: perspective(920px) rotateX(1.8deg) rotateY(2.2deg) translateY(-3px);
      }

      .entry[data-type='image'] .card:hover .media-frame img,
      .entry[data-type='video'] .card:hover .media-frame video {
        transform: scale(1.035);
      }

      .entry[data-type='image'] .card:hover .media-frame::after,
      .entry[data-type='video'] .card:hover .media-frame::after {
        opacity: 1;
        transform: translateX(130%);
      }
    }

    .meta {
      padding: 14px 16px;
    }

    .meta h3 {
      margin: 0;
      font-size: 19px;
      color: var(--color-ink);
    }

    .card-text .meta h3 {
      color: var(--color-ink);
      font-size: 22px;
    }

    .desc,
    .body {
      margin: 8px 0 0;
      color: var(--color-ink-soft);
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .card-text .body {
      color: var(--color-ink-soft);
      font-size: 15.5px;
    }

    .foot {
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .engagement {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .foot time {
      color: var(--color-ink-muted);
      font-family: 'Caveat', cursive;
      font-size: 17px;
    }

    .like-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1.5px solid var(--color-ink);
      background: var(--color-paper);
      color: var(--color-ink);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition:
        transform var(--motion-duration-fast) var(--motion-ease-standard),
        background var(--motion-duration-fast) var(--motion-ease-standard);
    }

    .like-button:hover:not(:disabled) { background: var(--color-accent-wash); }
    .like-button:active:not(:disabled) { transform: scale(0.96); }
    .like-button.liked {
      background: var(--color-accent-contrast);
      border-color: var(--color-accent-contrast);
      color: var(--color-paper);
    }
    .like-button:disabled { cursor: default; opacity: 0.75; }
    .like-button .heart { font-size: 16px; line-height: 1; }

    .comment-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1.5px solid var(--color-ink);
      background: var(--color-paper);
      color: var(--color-ink);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition:
        transform var(--motion-duration-fast) var(--motion-ease-standard),
        background var(--motion-duration-fast) var(--motion-ease-standard);
    }

    .comment-button svg {
      width: 15px;
      height: 15px;
      fill: currentColor;
      display: block;
    }

    .comment-button:hover:not(:disabled) {
      background: var(--color-cool-wash);
    }

    .comment-button:active:not(:disabled) {
      transform: scale(0.96);
    }

    .pager {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin: 28px 0 8px;
      flex-wrap: wrap;
    }

    .pager-num,
    .pager-edge {
      min-width: 36px;
      height: 36px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1.5px solid var(--color-ink);
      background: var(--color-paper);
      color: var(--color-ink);
      font-weight: 700;
      cursor: pointer;
    }

    .pager-num.active {
      background: var(--color-accent);
      color: var(--color-ink);
      border-color: var(--color-ink);
    }

    .pager-num:disabled,
    .pager-edge:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: var(--fx-lightbox-backdrop);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(16px, 4vw, 48px);
      cursor: zoom-out;
      animation: lightbox-fade 160ms ease-out;
    }

    @keyframes lightbox-fade { from { opacity: 0; } to { opacity: 1; } }

    .lightbox-figure {
      margin: 0;
      max-width: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      cursor: default;
    }

    .lightbox-figure img {
      max-width: 100%;
      max-height: calc(100vh - 140px);
      object-fit: contain;
      border-radius: 10px;
      border: 2px solid var(--color-paper);
    }

    .lightbox-figure figcaption {
      color: var(--color-paper);
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
      max-width: 680px;
    }

    .lightbox-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      border: 2px solid var(--color-paper);
      background: transparent;
      color: var(--color-paper);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }

    .lightbox-close:hover {
      background: var(--color-accent);
      color: var(--color-ink);
      border-color: var(--color-accent);
    }

    .comment-modal-mask {
      position: fixed;
      inset: 0;
      z-index: 1001;
      background: var(--fx-comment-backdrop);
      display: grid;
      place-items: center;
      padding: 16px;
    }

    .comment-modal {
      width: min(640px, 100%);
      max-height: 85vh;
      overflow: auto;
      border-radius: 14px;
      border: 2px solid var(--color-ink);
      background: var(--color-paper);
      padding: 14px;
      box-shadow: 4px 4px 0 var(--color-ink);
    }

    .comment-modal header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .comment-modal h3 {
      margin: 0;
    }

    .comment-close {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid var(--color-ink);
      background: var(--color-paper);
      cursor: pointer;
    }

    .comment-target,
    .comment-author {
      margin: 8px 0 0;
      color: var(--color-ink-soft);
    }

    .comment-modal textarea {
      width: 100%;
      margin-top: 10px;
      border: 1px solid var(--color-line);
      border-radius: 10px;
      font: inherit;
      padding: 10px;
      resize: vertical;
      background: var(--color-paper);
    }

    .comment-actions {
      margin-top: 10px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .comment-submit,
    .comment-cancel {
      border: 1.5px solid var(--color-ink);
      border-radius: 10px;
      min-height: 38px;
      padding: 0 12px;
      background: var(--color-accent);
      cursor: pointer;
      font-weight: 700;
    }

    .comment-cancel {
      background: var(--color-paper);
    }

    .comment-error {
      margin: 8px 0 0;
      color: var(--color-accent-contrast);
      font-weight: 600;
      animation: status-feedback-in var(--motion-duration-standard) var(--motion-ease-emphasized);
    }

    .comment-success {
      margin: 8px 0 0;
      color: var(--color-ink);
      font-weight: 600;
      animation: status-feedback-in var(--motion-duration-standard) var(--motion-ease-emphasized);
    }

    .comment-list {
      margin-top: 12px;
      border-top: 1px solid var(--color-line);
      padding-top: 10px;
      display: grid;
      gap: 8px;
    }

    .comment-row {
      border: 1px solid var(--color-line);
      border-radius: 10px;
      padding: 8px 10px;
      background: var(--color-paper);
    }

    .comment-row header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
    }

    .comment-row-tools {
      display: inline-flex;
      align-items: center;
    }

    .comment-delete {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      border: 1px solid var(--color-line);
      background: var(--color-paper);
      color: var(--color-ink-muted);
      cursor: pointer;
    }

    .comment-delete:hover:not(:disabled) {
      border-color: var(--color-accent-contrast);
      color: var(--color-accent-contrast);
    }

    .comment-delete:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .comment-row p {
      margin: 6px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--color-ink-soft);
    }

  `
})
export class StoryTimelineComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('entryNode') private entryNodes?: QueryList<ElementRef<HTMLLIElement>>;
  entries: TimelineEntry[] = [];
  isLoading = true;
  errorMessage = '';
  activeImage: TimelineEntry | null = null;
  page = 1;
  pageSize = 10;
  totalPages = 1;
  total = 0;

  private readonly likedKeys = new Set<string>();
  private readonly likePending = new Set<string>();
  private apiBaseUrl = '';
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  commentModalEntry: TimelineEntry | null = null;
  commentDraft = '';
  isCommentSubmitting = false;
  isCommentLoading = false;
  commentError = '';
  commentSuccess = '';
  commentLoadError = '';
  activeComments: StoryComment[] = [];
  private entryNodesSubscription?: { unsubscribe(): void };
  private entryObserver: IntersectionObserver | null = null;
  private readonly revealedEntryKeys = new Set<string>();
  private readonly replayCountByEntry = new Map<string, number>();
  private readonly maxRevealReplays = 1;
  private readonly prefersReducedMotion = this.detectReducedMotion();
  private readonly deletingCommentIds = new Set<string>();

  constructor(private readonly cdr?: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    this.apiBaseUrl = (resolveApiBaseUrl() || '').trim();
    this.loadLikedKeysFromStorage();
    await this.loadPage(1);
  }

  ngAfterViewInit(): void {
    this.entryNodesSubscription = this.entryNodes?.changes.subscribe(() => {
      this.refreshRevealTargets();
    });
    this.refreshRevealTargets();
  }

  ngOnDestroy(): void {
    this.entryNodesSubscription?.unsubscribe();
    this.entryObserver?.disconnect();
  }

  private loadLikedKeysFromStorage(): void {
    try {
      const raw = localStorage.getItem(LIKED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const entry of parsed) {
        if (entry && typeof entry === 'object') {
          const type = (entry as { type?: unknown }).type;
          const id = (entry as { id?: unknown }).id;
          if (
            (type === 'image' || type === 'video' || type === 'text') &&
            (typeof id === 'string' || typeof id === 'number')
          ) {
            this.likedKeys.add(`${type}:${id}`);
          }
        }
      }
    } catch {
      // storage unavailable or corrupted — ignore
    }
  }

  private persistLikedKeys(): void {
    try {
      const rows = Array.from(this.likedKeys).map((key) => {
        const separator = key.indexOf(':');
        return separator > 0
          ? { type: key.slice(0, separator), id: key.slice(separator + 1) }
          : null;
      });
      localStorage.setItem(
        LIKED_STORAGE_KEY,
        JSON.stringify(rows.filter(Boolean))
      );
    } catch {
      // storage unavailable — ignore
    }
  }

  get pageNumbers(): number[] {
    const total = Math.max(1, this.totalPages);
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const set = new Set<number>([1, total, this.page]);
    if (this.page > 1) set.add(this.page - 1);
    if (this.page < total) set.add(this.page + 1);
    return Array.from(set).sort((a, b) => a - b);
  }

  trackByKey = (_index: number, entry: TimelineEntry): string => `${entry.type}:${entry.id}`;

  isLiked(entry: TimelineEntry): boolean {
    return this.likedKeys.has(this.entryKey(entry));
  }

  isLikePending(entry: TimelineEntry): boolean {
    return this.likePending.has(this.entryKey(entry));
  }

  async onToggleLike(entry: TimelineEntry): Promise<void> {
    const key = this.entryKey(entry);
    if (this.likePending.has(key) || !this.apiBaseUrl) {
      return;
    }

    const isUnlike = this.likedKeys.has(key);
    const method = isUnlike ? 'DELETE' : 'POST';
    const fallback = isUnlike ? Math.max(0, entry.likesCount - 1) : entry.likesCount + 1;

    this.likePending.add(key);
    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entry.type === 'text' ? 'text' : 'media')}/${encodeURIComponent(String(entry.id))}/like`,
        {
          method,
          headers: this.auth.authHeaders()
        }
      );
      if (!response.ok) {
        if (response.status === 401) {
          this.errorMessage = this.i18n.t('story.comment.error.loginFirstLike');
          this.cdr?.markForCheck();
        }
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { likesCount?: number }
        | null;
      entry.likesCount =
        payload && typeof payload.likesCount === 'number' ? payload.likesCount : fallback;

      if (isUnlike) {
        this.likedKeys.delete(key);
      } else {
        this.likedKeys.add(key);
      }
      this.persistLikedKeys();
    } finally {
      this.likePending.delete(key);
      this.cdr?.markForCheck();
    }
  }

  openFullscreen(entry: TimelineEntry): void {
    if (entry.type !== 'image' || !entry.mediaUrl) {
      return;
    }
    this.activeImage = entry;
  }

  closeFullscreen(): void {
    this.activeImage = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activeImage) {
      this.closeFullscreen();
    }
    if (this.commentModalEntry) {
      this.closeCommentModal();
    }
  }

  async goToPage(next: number): Promise<void> {
    const target = Math.max(1, Math.min(this.totalPages, Math.floor(next)));
    if (target === this.page || this.isLoading) {
      return;
    }
    await this.loadPage(target);
    if (typeof window !== 'undefined') {
      const host = document.getElementById('story');
      host?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.alt = `${target.alt} (failed to load)`;
    target.style.objectFit = 'contain';
    target.style.padding = '20px';
    target.style.background = 'var(--color-paper-sunk)';
  }

  formatFull(raw: string | null | undefined): string {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const ts = Date.parse(`${raw}T00:00:00Z`);
      if (Number.isNaN(ts)) return raw;
      return new Date(ts).toLocaleDateString();
    }
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return raw;
    return new Date(ts).toLocaleString();
  }

  formatDay(raw: string | null | undefined): string {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      const asDate = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(asDate.getTime())) return raw;
      const month = asDate.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' });
      return `${month} ${asDate.getUTCDate()}`;
    }
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return raw;
    const d = new Date(ts);
    const month = d.toLocaleString(undefined, { month: 'short' });
    return `${month} ${d.getDate()}`;
  }

  private async loadPage(pageNumber: number): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    if (!this.apiBaseUrl) {
      this.errorMessage = 'Missing API base URL.';
      this.isLoading = false;
      this.cdr?.markForCheck();
      return;
    }

    try {
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/timeline?page=${encodeURIComponent(String(pageNumber))}`,
        { headers: this.auth.authHeaders() }
      );
      if (!response.ok) {
        throw new Error(`Timeline request failed (${response.status}).`);
      }
      const payload = (await response.json()) as TimelineResponse;
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      this.entries = rawItems
        .map((row) => this.mapEntry(row))
        .filter((entry): entry is TimelineEntry => entry !== null);
      for (const row of rawItems) {
        if (row && row.likedByMe) {
          const type = this.normalizeType(row.type);
          if (!type) continue;
          const id = row.id;
          if (typeof id === 'string' || typeof id === 'number') {
            this.likedKeys.add(`${type}:${id}`);
          }
        }
      }
      this.persistLikedKeys();
      this.page = Math.max(1, Number(payload.page) || pageNumber);
      this.pageSize = Math.max(1, Number(payload.pageSize) || 10);
      this.total = Math.max(0, Number(payload.total) || 0);
      this.totalPages = Math.max(1, Number(payload.totalPages) || 1);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : this.i18n.t('story.state.error.fallback');
      this.entries = [];
    } finally {
      this.isLoading = false;
      this.cdr?.markForCheck();
    }
  }

  trackByCommentId(_index: number, item: StoryComment): number | string {
    return item.id;
  }

  isCommentDeleting(item: StoryComment): boolean {
    return this.deletingCommentIds.has(String(item.id));
  }

  openCommentModal(entry: TimelineEntry): void {
    this.commentModalEntry = entry;
    this.commentDraft = '';
    this.commentError = '';
    this.commentSuccess = '';
    this.commentLoadError = '';
    void this.loadCommentsForEntry(entry);
  }

  closeCommentModal(): void {
    this.commentModalEntry = null;
    this.commentDraft = '';
    this.commentError = '';
    this.commentSuccess = '';
    this.commentLoadError = '';
    this.activeComments = [];
    this.cdr?.markForCheck();
  }

  async submitComment(): Promise<void> {
    if (!this.commentModalEntry || !this.apiBaseUrl) {
      return;
    }

    const authorName = (this.auth.username || '').trim();
    if (!authorName) {
      this.commentError = this.i18n.t('story.comment.error.loginFirst');
      return;
    }

    const message = this.commentDraft.trim();
    if (!message || message.length > 500) {
      this.commentError = this.i18n.t('story.comment.error.length');
      return;
    }

    this.isCommentSubmitting = true;
    this.commentError = '';
    this.commentSuccess = '';
    try {
      const entryType = this.toCommentEntryType(this.commentModalEntry);
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entryType)}/${encodeURIComponent(String(this.commentModalEntry.id))}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorName, message })
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; item?: StoryComment; message?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.item) {
        throw new Error(payload?.message || this.i18n.t('story.comment.error.postFailed'));
      }

      this.activeComments = [payload.item, ...this.activeComments];
      this.updateCommentsCount(this.commentModalEntry, this.activeComments.length);
      this.commentDraft = '';
      this.commentSuccess = this.i18n.t('story.comment.success.posted');
    } catch (error) {
      this.commentError =
        error instanceof Error ? error.message : this.i18n.t('story.comment.error.postFailed');
    } finally {
      this.isCommentSubmitting = false;
      this.cdr?.markForCheck();
    }
  }

  private async loadCommentsForEntry(entry: TimelineEntry): Promise<void> {
    if (!this.apiBaseUrl) {
      return;
    }

    this.isCommentLoading = true;
    this.commentLoadError = '';
    try {
      const entryType = this.toCommentEntryType(entry);
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entryType)}/${encodeURIComponent(String(entry.id))}/comments?limit=20`
      );
      const payload = (await response.json().catch(() => null)) as StoryCommentsResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `Comment request failed (${response.status}).`);
      }
      this.activeComments = Array.isArray(payload.items) ? payload.items : [];
      this.updateCommentsCount(entry, Number.isFinite(Number(payload.total)) ? Number(payload.total) : this.activeComments.length);
    } catch (error) {
      this.commentLoadError =
        error instanceof Error ? error.message : this.i18n.t('story.comment.error.loadFailed');
      this.activeComments = [];
    } finally {
      this.isCommentLoading = false;
      this.cdr?.markForCheck();
    }
  }

  private toCommentEntryType(entry: TimelineEntry): 'media' | 'text' {
    return entry.type === 'text' ? 'text' : 'media';
  }

  async deleteComment(item: StoryComment): Promise<void> {
    if (!this.commentModalEntry || !this.apiBaseUrl || !this.auth.isAdmin) {
      return;
    }
    const deleteKey = String(item.id);
    if (this.deletingCommentIds.has(deleteKey)) {
      return;
    }

    this.deletingCommentIds.add(deleteKey);
    this.commentError = '';
    this.commentSuccess = '';
    try {
      const entryType = this.toCommentEntryType(this.commentModalEntry);
      const base = this.apiBaseUrl.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/api/story/${encodeURIComponent(entryType)}/${encodeURIComponent(String(this.commentModalEntry.id))}/comments/${encodeURIComponent(String(item.id))}`,
        {
          method: 'DELETE',
          headers: this.auth.authHeaders()
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || this.i18n.t('story.comment.error.deleteFailed'));
      }

      this.activeComments = this.activeComments.filter((row) => String(row.id) !== deleteKey);
      this.updateCommentsCount(this.commentModalEntry, Math.max(0, this.activeComments.length));
      this.commentSuccess = this.i18n.t('story.comment.success.deleted');
    } catch (error) {
      this.commentError =
        error instanceof Error ? error.message : this.i18n.t('story.comment.error.deleteFailed');
    } finally {
      this.deletingCommentIds.delete(deleteKey);
      this.cdr?.markForCheck();
    }
  }

  private mapEntry(row: RawTimelineEntry): TimelineEntry | null {
    const type = this.normalizeType(row.type);
    if (!type) return null;
    const displayDate = row.displayDate ? String(row.displayDate) : null;
    if (type !== 'text') {
      const normalizedUrl = this.normalizeHttpUrl(row.mediaUrl);
      if (!normalizedUrl) return null;
      return {
        type,
        id: row.id ?? normalizedUrl,
        title: String(row.title || 'Untitled'),
        description: String(row.description || ''),
        body: null,
        mediaUrl: normalizedUrl,
        thumbnailUrl: this.normalizeHttpUrl(row.thumbnailUrl ?? null) ?? null,
        likesCount: this.toLikeCount(row.likesCount),
        commentsCount: this.toLikeCount(row.commentsCount),
        displayDate,
        createdAt: row.createdAt ? String(row.createdAt) : null
      };
    }
    return {
      type: 'text',
      id: row.id ?? `${Date.now()}`,
      title: String(row.title || 'Untitled'),
      description: '',
      body: String(row.body || ''),
      mediaUrl: null,
      thumbnailUrl: null,
      likesCount: this.toLikeCount(row.likesCount),
      commentsCount: this.toLikeCount(row.commentsCount),
      displayDate,
      createdAt: row.createdAt ? String(row.createdAt) : null
    };
  }

  private normalizeType(raw: unknown): TimelineEntryType | null {
    const value = String(raw || '').toLowerCase();
    if (value === 'image' || value === 'video' || value === 'text') {
      return value;
    }
    return null;
  }

  private toLikeCount(raw: unknown): number {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }

  private normalizeHttpUrl(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const parsed = new URL(raw.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private entryKey(entry: TimelineEntry): string {
    return `${entry.type}:${entry.id}`;
  }

  private updateCommentsCount(entry: TimelineEntry, nextCount: number): void {
    const normalized = Number.isFinite(nextCount) && nextCount >= 0 ? Math.floor(nextCount) : 0;
    entry.commentsCount = normalized;
    for (const item of this.entries) {
      if (item.type === entry.type && String(item.id) === String(entry.id)) {
        item.commentsCount = normalized;
        break;
      }
    }
  }

  private detectReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private refreshRevealTargets(): void {
    const nodes = this.entryNodes?.toArray() ?? [];
    if (!nodes.length) {
      this.entryObserver?.disconnect();
      return;
    }

    if (this.prefersReducedMotion || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      this.entryObserver?.disconnect();
      for (const node of nodes) {
        this.setEntryVisible(node.nativeElement, true);
      }
      return;
    }

    if (!this.entryObserver) {
      this.entryObserver = new IntersectionObserver(
        (entries) => {
          for (const item of entries) {
            const target = item.target as HTMLLIElement;
            const key = this.entryDomKey(target);
            if (item.isIntersecting && item.intersectionRatio >= 0.25) {
              this.revealedEntryKeys.add(key);
              this.setEntryVisible(target, true);
              continue;
            }

            if (this.revealedEntryKeys.has(key) && this.allowReplay(target, key)) {
              this.revealedEntryKeys.delete(key);
              this.setEntryVisible(target, false);
            }
          }
        },
        { threshold: [0.25, 0.45], rootMargin: '0px 0px -8% 0px' }
      );
    } else {
      this.entryObserver.disconnect();
    }

    for (const node of nodes) {
      const element = node.nativeElement;
      const key = this.entryDomKey(element);
      this.setEntryVisible(element, this.revealedEntryKeys.has(key));
      this.entryObserver.observe(element);
    }
  }

  private entryDomKey(element: HTMLLIElement): string {
    return element.dataset['entryKey'] || '';
  }

  private setEntryVisible(element: HTMLLIElement, visible: boolean): void {
    element.classList.toggle('entry-visible', visible);
    element.classList.toggle('entry-pending', !visible);
  }

  private allowReplay(element: HTMLLIElement, key: string): boolean {
    if (!key || typeof window === 'undefined') {
      return false;
    }

    const viewportHeight = window.innerHeight || 800;
    const rect = element.getBoundingClientRect();
    const farOutside = rect.bottom < -viewportHeight * 0.2 || rect.top > viewportHeight * 1.2;
    if (!farOutside) {
      return false;
    }

    const current = this.replayCountByEntry.get(key) || 0;
    if (current >= this.maxRevealReplays) {
      return false;
    }

    this.replayCountByEntry.set(key, current + 1);
    return true;
  }

}
