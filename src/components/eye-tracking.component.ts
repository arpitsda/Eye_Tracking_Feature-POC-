import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraService } from '../services/camera.service';
import { FaceDetectionService, FaceMetrics } from '../services/face-detection.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-eye-tracking',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="eye-tracking-container">
      <div class="header">
        <h1>🎯 Eye Tracking Interview System</h1>
        <p class="subtitle">AI-powered attention monitoring for remote interviews</p>
      </div>

      <!-- System Status and Diagnostics -->
      <div class="diagnostics-panel" *ngIf="showDiagnostics">
        <h3>🔧 System Diagnostics</h3>
        <div class="diagnostic-item">
          <span class="diagnostic-label">Browser Support:</span>
          <span [class]="cameraService.isSupported() ? 'status-good' : 'status-bad'">
            {{ cameraService.isSupported() ? '✅ Supported' : '❌ Not Supported' }}
          </span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">Secure Context (HTTPS):</span>
          <span [class]="cameraService.isSecureContext() ? 'status-good' : 'status-bad'">
            {{ cameraService.isSecureContext() ? '✅ Secure' : '❌ Insecure (Camera may not work)' }}
          </span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">Camera Permission:</span>
          <span class="status-info">{{ cameraPermissionStatus }}</span>
        </div>
        <div class="diagnostic-item">
          <span class="diagnostic-label">Available Cameras:</span>
          <span class="status-info">{{ availableCameras.length }} found</span>
        </div>
        <button class="btn btn-secondary" (click)="runDiagnostics()">🔄 Refresh Diagnostics</button>
      </div>

      <div class="main-content">
        <div class="camera-section">
          <div class="camera-container">
            <video #videoElement
                   [width]="640" 
                   [height]="480"
                   autoplay 
                   muted 
                   playsinline
                   (click)="onVideoClick()">
            </video>
            <canvas #canvasElement
                    [width]="640" 
                    [height]="480"
                    class="overlay-canvas">
            </canvas>
            
            <!-- Manual play button for browsers that require user interaction -->
            <div class="play-button-overlay" *ngIf="showPlayButton" (click)="manualPlay()">
              <button class="play-button">▶️ Click to Start Video</button>
            </div>
          </div>
          
          <div class="camera-controls">
            <button class="btn btn-primary" 
                    (click)="startTracking()" 
                    [disabled]="isTracking">
              🎥 Start Tracking
            </button>
            <button class="btn btn-danger" 
                    (click)="stopTracking()" 
                    [disabled]="!isTracking">
              ⏹️ Stop Tracking
            </button>
            <button class="btn btn-secondary" 
                    (click)="toggleDiagnostics()">
              🔧 {{ showDiagnostics ? 'Hide' : 'Show' }} Diagnostics
            </button>
          </div>

          <div class="status-bar">
            <span class="status-indicator" 
                  [class]="getStatusClass()">
              {{ getStatusText() }}
            </span>
            <span class="status-indicator status-info" *ngIf="currentMetrics">
              Attention: {{ currentMetrics.attentionScore | number:'1.0-0' }}%
            </span>
          </div>
        </div>

        <div class="metrics-panel">
          <h3>📊 Real-time Metrics</h3>
          
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-value">{{ currentMetrics?.faceDirection || 'N/A' }}</div>
              <div class="metric-label">Face Direction</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">{{ currentMetrics?.gazeDirection || 'N/A' }}</div>
              <div class="metric-label">Gaze Direction</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">{{ getAttentionColor() }}</div>
              <div class="metric-label">Attention Level</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">{{ totalWarnings }}</div>
              <div class="metric-label">Total Warnings</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">{{ getSessionDuration() }}</div>
              <div class="metric-label">Session Duration</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-value">{{ averageAttention | number:'1.0-0' }}%</div>
              <div class="metric-label">Average Attention</div>
            </div>
          </div>

          <div class="warning-section" *ngIf="currentWarning">
            <div class="warning-alert">
              ⚠️ {{ currentWarning }}
            </div>
          </div>

          <div class="movement-history">
            <h4>📈 Movement Analysis</h4>
            <div class="movement-stats">
              <div class="movement-stat">
                <span class="movement-label">Left:</span>
                <span class="movement-count">{{ movementCounts.left }}</span>
              </div>
              <div class="movement-stat">
                <span class="movement-label">Right:</span>
                <span class="movement-count">{{ movementCounts.right }}</span>
              </div>
              <div class="movement-stat">
                <span class="movement-label">Up:</span>
                <span class="movement-count">{{ movementCounts.up }}</span>
              </div>
              <div class="movement-stat">
                <span class="movement-label">Down:</span>
                <span class="movement-count">{{ movementCounts.down }}</span>
              </div>
              <div class="movement-stat">
                <span class="movement-label">Center:</span>
                <span class="movement-count">{{ movementCounts.center }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="info-panel">
        <h4>ℹ️ Troubleshooting Tips</h4>
        <ul>
          <li><strong>Camera Permission:</strong> Click "Allow" when prompted for camera access</li>
          <li><strong>HTTPS Required:</strong> Camera only works on secure connections (https://)</li>
          <li><strong>Browser Support:</strong> Use Chrome, Firefox, Safari, or Edge</li>
          <li><strong>Camera in Use:</strong> Close other apps that might be using your camera</li>
          <li><strong>Refresh Page:</strong> If issues persist, refresh the page and try again</li>
          <li><strong>Check Settings:</strong> Ensure camera is not blocked in browser settings</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .eye-tracking-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 2.5rem;
      color: #333;
      margin-bottom: 10px;
    }

    .subtitle {
      font-size: 1.1rem;
      color: #666;
      margin-bottom: 0;
    }

    .diagnostics-panel {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .diagnostics-panel h3 {
      margin-bottom: 15px;
      color: #333;
    }

    .diagnostic-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .diagnostic-item:last-child {
      border-bottom: none;
    }

    .diagnostic-label {
      font-weight: 600;
      color: #333;
    }

    .status-good {
      color: #4CAF50;
      font-weight: bold;
    }

    .status-bad {
      color: #f44336;
      font-weight: bold;
    }

    .main-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }

    .camera-section {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .camera-container {
      position: relative;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      margin-bottom: 20px;
    }

    .overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    .play-button-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .play-button {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 10px;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .play-button:hover {
      background: #45a049;
      transform: scale(1.05);
    }

    video {
      display: block;
      background: #000;
      cursor: pointer;
    }

    .camera-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #5a6268;
      transform: translateY(-2px);
    }

    .status-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
    }

    .status-info {
      background: #2196F3;
      color: white;
    }

    .metrics-panel {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .metrics-panel h3 {
      margin-bottom: 20px;
      color: #333;
      font-size: 1.4rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }

    .metric-card {
      background: rgba(255, 255, 255, 0.8);
      padding: 15px;
      border-radius: 10px;
      text-align: center;
      border-left: 4px solid #4CAF50;
      transition: transform 0.2s ease;
    }

    .metric-card:hover {
      transform: translateY(-2px);
    }

    .metric-value {
      font-size: 20px;
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }

    .metric-label {
      font-size: 12px;
      color: #666;
    }

    .warning-section {
      margin-bottom: 25px;
    }

    .movement-history h4 {
      margin-bottom: 15px;
      color: #333;
    }

    .movement-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }

    .movement-stat {
      background: rgba(33, 150, 243, 0.1);
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 14px;
    }

    .movement-label {
      font-weight: 600;
      color: #333;
    }

    .movement-count {
      color: #2196F3;
      font-weight: bold;
      margin-left: 5px;
    }

    .info-panel {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .info-panel h4 {
      margin-bottom: 15px;
      color: #333;
    }

    .info-panel ul {
      list-style: none;
      padding: 0;
    }

    .info-panel li {
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      color: #555;
    }

    .info-panel li:last-child {
      border-bottom: none;
    }

    .info-panel strong {
      color: #333;
    }

    @media (max-width: 768px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      
      .metrics-grid {
        grid-template-columns: 1fr;
      }
      
      video, canvas {
        width: 100%;
        max-width: 480px;
        height: auto;
      }

      .camera-controls {
        flex-direction: column;
        align-items: center;
      }
    }
  `]
})
export class EyeTrackingComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement', { static: true }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: true }) canvasElement!: ElementRef<HTMLCanvasElement>;

  isTracking = false;
  currentMetrics: FaceMetrics | null = null;
  currentWarning = '';
  totalWarnings = 0;
  sessionStartTime = 0;
  averageAttention = 0;
  showDiagnostics = false;
  showPlayButton = false;
  cameraPermissionStatus = 'Checking...';
  availableCameras: MediaDeviceInfo[] = [];
  
  movementCounts = {
    left: 0,
    right: 0,
    up: 0,
    down: 0,
    center: 0
  };

  private subscriptions: Subscription[] = [];
  private attentionHistory: number[] = [];

  constructor(
    public cameraService: CameraService,
    private faceDetectionService: FaceDetectionService
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.runDiagnostics();
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupSubscriptions(): void {
    // Face metrics subscription
    this.subscriptions.push(
      this.faceDetectionService.faceMetrics$.subscribe(metrics => {
        this.currentMetrics = metrics;
        this.updateMovementCounts(metrics.faceDirection);
        this.updateAttentionHistory(metrics.attentionScore);
      })
    );

    // Warning alerts subscription
    this.subscriptions.push(
      this.faceDetectionService.warningAlert$.subscribe(warning => {
        this.currentWarning = warning;
        this.totalWarnings++;
        
        // Clear warning after 3 seconds
        setTimeout(() => {
          this.currentWarning = '';
        }, 3000);
      })
    );

    // Camera error subscription
    this.subscriptions.push(
      this.cameraService.cameraError$.subscribe(error => {
        console.error('Camera error:', error);
        alert(error);
      })
    );
  }

  async runDiagnostics(): Promise<void> {
    this.cameraPermissionStatus = await this.cameraService.checkCameraPermissions();
    this.availableCameras = await this.cameraService.listCameraDevices();
  }

  toggleDiagnostics(): void {
    this.showDiagnostics = !this.showDiagnostics;
    if (this.showDiagnostics) {
      this.runDiagnostics();
    }
  }

  onVideoClick(): void {
    const video = this.videoElement.nativeElement;
    if (video.paused) {
      video.play().catch(console.error);
    }
  }

  manualPlay(): void {
    const video = this.videoElement.nativeElement;
    video.play().then(() => {
      this.showPlayButton = false;
    }).catch(console.error);
  }

  async startTracking(): Promise<void> {
    if (!this.cameraService.isSupported()) {
      alert('Your browser does not support camera access. Please use Chrome, Firefox, Safari, or Edge.');
      return;
    }

    if (!this.cameraService.isSecureContext()) {
      alert('Camera access requires a secure connection (HTTPS). Please use HTTPS or localhost.');
      return;
    }

    try {
      const success = await this.cameraService.initializeCamera(this.videoElement.nativeElement);
      if (!success) {
        this.showPlayButton = true;
        return;
      }

      await this.faceDetectionService.initializeFaceDetection(
        this.videoElement.nativeElement,
        this.canvasElement.nativeElement
      );

      this.faceDetectionService.startDetection();
      this.isTracking = true;
      this.sessionStartTime = Date.now();
      this.resetMetrics();
    } catch (error) {
      console.error('Failed to start tracking:', error);
      alert('Failed to initialize eye tracking. Please check the diagnostics panel and try again.');
    }
  }

  stopTracking(): void {
    this.faceDetectionService.stopDetection();
    this.cameraService.stopCamera();
    this.isTracking = false;
    this.showPlayButton = false;
    
    // Clear canvas
    const ctx = this.canvasElement.nativeElement.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
    }
  }

  private updateMovementCounts(direction: string): void {
    if (direction in this.movementCounts) {
      (this.movementCounts as any)[direction]++;
    }
  }

  private updateAttentionHistory(score: number): void {
    this.attentionHistory.push(score);
    if (this.attentionHistory.length > 100) {
      this.attentionHistory.shift();
    }
    
    this.averageAttention = this.attentionHistory.reduce((a, b) => a + b, 0) / this.attentionHistory.length;
  }

  private resetMetrics(): void {
    this.totalWarnings = 0;
    this.averageAttention = 0;
    this.attentionHistory = [];
    this.movementCounts = { left: 0, right: 0, up: 0, down: 0, center: 0 };
  }

  getStatusClass(): string {
    if (!this.isTracking) return 'status-error';
    if (!this.currentMetrics) return 'status-warning';
    return this.currentMetrics.attentionScore > 70 ? 'status-active' : 'status-warning';
  }

  getStatusText(): string {
    if (!this.isTracking) return 'Not Tracking';
    if (!this.currentMetrics) return 'Initializing...';
    return this.currentMetrics.attentionScore > 70 ? 'Good Attention' : 'Low Attention';
  }

  getAttentionColor(): string {
    if (!this.currentMetrics) return 'N/A';
    const score = this.currentMetrics.attentionScore;
    if (score >= 80) return '🟢 Excellent';
    if (score >= 60) return '🟡 Good';
    return '🔴 Poor';
  }

  getSessionDuration(): string {
    if (!this.sessionStartTime) return '00:00';
    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}