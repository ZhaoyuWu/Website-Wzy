import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="home">
      <header class="top-nav">
        <a class="brand" [routerLink]="['/']">Nanami Journal</a>
        <nav>
          <a [routerLink]="['/']" fragment="moments">Moments</a>
          <a [routerLink]="['/showcase']">Showcase</a>
          <a [routerLink]="['/register']">Register</a>
          <a [routerLink]="['/login']">Admin Login</a>
          <a [routerLink]="['/admin']">Admin Panel</a>
        </nav>
      </header>

      <section class="hero">
        <p class="eyebrow">Public Homepage</p>
        <h1>Nanami, the sunshine of every walk.</h1>
        <p>
          This page shares Nanami's personality, daily routine, and favorite places in a warm
          timeline style.
        </p>
        <div class="hero-actions">
          <a class="primary" [routerLink]="['/']" fragment="moments">View Story Moments</a>
          <a class="secondary" [routerLink]="['/showcase']">Open Showcase</a>
          <a class="secondary" [routerLink]="['/register']">Create Account</a>
          <a class="secondary" [routerLink]="['/login']">Manage Content</a>
        </div>
      </section>

      <section id="moments" class="moments">
        <article>
          <h2>Morning Energy</h2>
          <p>Nanami starts the day with a quick sprint, then waits politely for breakfast.</p>
        </article>
        <article>
          <h2>Afternoon Adventures</h2>
          <p>Park time means photo-ready smiles, playful zoomies, and curious nose work.</p>
        </article>
        <article>
          <h2>Evening Wind-down</h2>
          <p>After dinner, Nanami checks every corner of home and naps near the family.</p>
        </article>
      </section>
    </main>
  `,
  styles: `
    .home {
      min-height: 100vh;
      padding: 20px;
      background:
        radial-gradient(circle at 14% 20%, rgba(255, 205, 157, 0.45), transparent 38%),
        radial-gradient(circle at 84% 12%, rgba(160, 214, 255, 0.34), transparent 34%),
        linear-gradient(180deg, #fff6ed 0%, #f6fbff 100%);
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

    .hero {
      width: min(1100px, 100%);
      margin: 0 auto;
      border: 1px solid #ebd7c6;
      border-radius: 22px;
      padding: clamp(24px, 5vw, 44px);
      background: #ffffffee;
      box-shadow: 0 22px 46px rgba(46, 27, 10, 0.12);
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
      margin: 10px 0 10px;
      color: #331f13;
      font-size: clamp(31px, 4vw, 50px);
      line-height: 1.08;
      max-width: 14ch;
    }

    .hero p {
      margin: 0;
      color: #5b4534;
      font-size: 17px;
      max-width: 65ch;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 24px;
    }

    .hero-actions a {
      text-decoration: none;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 700;
    }

    .primary {
      color: #ffffff;
      background: linear-gradient(92deg, #c8682d 0%, #de975f 100%);
    }

    .secondary {
      color: #5f3a1e;
      border: 1px solid #d2b79f;
      background: #fffaf5;
    }

    .moments {
      width: min(1100px, 100%);
      margin: 22px auto 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    article {
      border-radius: 16px;
      border: 1px solid #d9e8f5;
      background: #ffffff;
      padding: 20px;
    }

    h2 {
      margin: 0;
      color: #224160;
      font-size: 20px;
    }

    article p {
      margin: 9px 0 0;
      color: #3a5268;
      line-height: 1.55;
    }

    @media (max-width: 900px) {
      .moments {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .home {
        padding: 14px;
      }

      .top-nav {
        flex-direction: column;
        align-items: flex-start;
      }

      nav {
        justify-content: flex-start;
      }

      .moments {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class HomePageComponent {}
