import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdatePromptComponent } from './components/update-prompt.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdatePromptComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
