import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { EyeTrackingComponent } from './components/eye-tracking.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [EyeTrackingComponent],
  template: `
    <div class="app-container">
      <app-eye-tracking></app-eye-tracking>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
  `]
})
export class App {}

bootstrapApplication(App, {
  providers: []
});