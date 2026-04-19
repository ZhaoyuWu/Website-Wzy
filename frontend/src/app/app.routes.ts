import { Routes } from '@angular/router';
import { roleGuard } from './core/auth.guard';
import { AdminPageComponent } from './pages/admin-page.component';
import { HomePageComponent } from './pages/home-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { MediaPageComponent } from './pages/media-page.component';
import { RegisterPageComponent } from './pages/register-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'admin', component: AdminPageComponent, canActivate: [roleGuard('Admin', 'Publisher')] },
  { path: 'manage-media', component: MediaPageComponent, canActivate: [roleGuard('Admin', 'Publisher')] },
  { path: 'showcase', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
