import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  title = 'Website 1st';
  backendUrl = 'http://localhost:4000';
  healthStatus = 'Checking backend...';

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch(`${this.backendUrl}/api/health`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      this.healthStatus = 'Backend is connected';
    } catch {
      this.healthStatus = 'Backend is not reachable yet';
    }
  }
}
