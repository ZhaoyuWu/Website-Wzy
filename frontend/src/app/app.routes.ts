import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AdminPageComponent } from './pages/admin-page.component';
import { HomePageComponent } from './pages/home-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { ShowcasePageComponent } from './pages/showcase-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'showcase', component: ShowcasePageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'admin', component: AdminPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
