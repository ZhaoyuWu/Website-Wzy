import { Routes } from '@angular/router';
import { roleGuard } from './core/auth.guard';
import { HomePageComponent } from './pages/home-page.component';

// Home stays eagerly loaded (it is the landing page); everything else is
// lazy so visitors never download the admin/media bundles.
// `title` values are i18n keys resolved by I18nTitleStrategy.
export const routes: Routes = [
  { path: '', component: HomePageComponent, title: 'title.home' },
  {
    path: 'login',
    title: 'title.login',
    loadComponent: () =>
      import('./pages/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: 'register',
    title: 'title.register',
    loadComponent: () =>
      import('./pages/register-page.component').then((m) => m.RegisterPageComponent)
  },
  {
    path: 'admin',
    title: 'title.admin',
    loadComponent: () =>
      import('./pages/admin-page.component').then((m) => m.AdminPageComponent),
    canActivate: [roleGuard('Admin', 'Publisher')]
  },
  {
    path: 'manage-media',
    title: 'title.media',
    loadComponent: () =>
      import('./pages/media-page.component').then((m) => m.MediaPageComponent),
    canActivate: [roleGuard('Admin', 'Publisher')]
  },
  {
    path: 'tech',
    title: 'title.tech',
    loadComponent: () =>
      import('./pages/tech-page.component').then((m) => m.TechPageComponent)
  },
  { path: 'showcase', redirectTo: '', pathMatch: 'full' },
  {
    path: '**',
    title: 'title.notFound',
    loadComponent: () =>
      import('./pages/not-found-page.component').then((m) => m.NotFoundPageComponent)
  }
];
