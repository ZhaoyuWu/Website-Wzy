import { Routes } from '@angular/router';
import { roleGuard } from './core/auth.guard';
import { HomePageComponent } from './pages/home-page.component';

// Home stays eagerly loaded (it is the landing page); everything else is
// lazy so visitors never download the admin/media bundles.
export const routes: Routes = [
  { path: '', component: HomePageComponent },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register-page.component').then((m) => m.RegisterPageComponent)
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin-page.component').then((m) => m.AdminPageComponent),
    canActivate: [roleGuard('Admin', 'Publisher')]
  },
  {
    path: 'manage-media',
    loadComponent: () =>
      import('./pages/media-page.component').then((m) => m.MediaPageComponent),
    canActivate: [roleGuard('Admin', 'Publisher')]
  },
  { path: 'showcase', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
