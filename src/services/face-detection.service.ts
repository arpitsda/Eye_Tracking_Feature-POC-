import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

declare const FaceMesh: any;
declare const Camera: any;

export interface EyePosition {
  x: number;
  y: number;
}

export interface FaceMetrics {
  leftEye: EyePosition;
  rightEye: EyePosition;
  faceDirection: 'center' | 'left' | 'right' | 'up' | 'down';
  gazeDirection: string;
  attentionScore: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService {
  private faceMesh: any;
  private camera: any;
  private isInitialized = false;

  public faceMetrics$ = new Subject<FaceMetrics>();
  public warningAlert$ = new Subject<string>();

  // Face mesh landmark indices for eyes
  private readonly LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  private readonly RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

  private attentionHistory: number[] = [];
  private lastWarningTime = 0;

  async initializeFaceDetection(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      await this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults((results: any) => {
        this.processResults(results, canvasElement);
      });

      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          if (this.faceMesh) {
            await this.faceMesh.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Face detection initialization failed:', error);
      throw error;
    }
  }

  startDetection(): void {
    if (this.camera && this.isInitialized) {
      this.camera.start();
    }
  }

  stopDetection(): void {
    if (this.camera) {
      this.camera.stop();
    }
  }

  private processResults(results: any, canvasElement: HTMLCanvasElement): void {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      
      // Calculate eye positions
      const leftEyeCenter = this.calculateEyeCenter(landmarks, this.LEFT_EYE_INDICES);
      const rightEyeCenter = this.calculateEyeCenter(landmarks, this.RIGHT_EYE_INDICES);
      
      // Determine face direction
      const faceDirection = this.calculateFaceDirection(landmarks);
      
      // Calculate attention score
      const attentionScore = this.calculateAttentionScore(leftEyeCenter, rightEyeCenter, faceDirection);
      
      // Update attention history
      this.attentionHistory.push(attentionScore);
      if (this.attentionHistory.length > 30) { // Keep last 30 frames (1 second at 30fps)
        this.attentionHistory.shift();
      }

      const metrics: FaceMetrics = {
        leftEye: leftEyeCenter,
        rightEye: rightEyeCenter,
        faceDirection,
        gazeDirection: this.calculateGazeDirection(leftEyeCenter, rightEyeCenter),
        attentionScore,
        timestamp: Date.now()
      };

      this.faceMetrics$.next(metrics);
      this.checkForWarnings(metrics);
      
      // Draw eye dots
      this.drawEyeDot(ctx, leftEyeCenter, canvasElement);
      this.drawEyeDot(ctx, rightEyeCenter, canvasElement);
      
      // Draw face outline
      this.drawFaceOutline(ctx, landmarks, canvasElement);
    }
  }

  private calculateEyeCenter(landmarks: any[], eyeIndices: number[]): EyePosition {
    let x = 0, y = 0;
    
    eyeIndices.forEach(index => {
      x += landmarks[index].x;
      y += landmarks[index].y;
    });
    
    return {
      x: x / eyeIndices.length,
      y: y / eyeIndices.length
    };
  }

  private calculateFaceDirection(landmarks: any[]): 'center' | 'left' | 'right' | 'up' | 'down' {
    const noseTip = landmarks[1];
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];
    const topHead = landmarks[10];
    const chin = landmarks[152];

    const horizontalRatio = (noseTip.x - leftFace.x) / (rightFace.x - leftFace.x);
    const verticalRatio = (noseTip.y - topHead.y) / (chin.y - topHead.y);

    if (horizontalRatio < 0.4) return 'right';
    if (horizontalRatio > 0.6) return 'left';
    if (verticalRatio < 0.4) return 'up';
    if (verticalRatio > 0.6) return 'down';
    
    return 'center';
  }

  private calculateGazeDirection(leftEye: EyePosition, rightEye: EyePosition): string {
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2
    };

    if (eyeCenter.x < 0.4) return 'Looking Right';
    if (eyeCenter.x > 0.6) return 'Looking Left';
    if (eyeCenter.y < 0.4) return 'Looking Up';
    if (eyeCenter.y > 0.6) return 'Looking Down';
    
    return 'Looking Center';
  }

  private calculateAttentionScore(leftEye: EyePosition, rightEye: EyePosition, faceDirection: string): number {
    let score = 100;
    
    // Reduce score based on eye position deviation from center
    const eyeCenter = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2
    };
    
    const horizontalDeviation = Math.abs(eyeCenter.x - 0.5);
    const verticalDeviation = Math.abs(eyeCenter.y - 0.5);
    
    score -= horizontalDeviation * 100;
    score -= verticalDeviation * 80;
    
    // Additional penalty for face direction
    if (faceDirection !== 'center') {
      score -= 30;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private checkForWarnings(metrics: FaceMetrics): void {
    const now = Date.now();
    
    // Check attention score
    if (metrics.attentionScore < 50) {
      if (now - this.lastWarningTime > 3000) { // Throttle warnings to every 3 seconds
        this.warningAlert$.next('Low attention detected! Please look at the camera.');
        this.lastWarningTime = now;
      }
    }
    
    // Check face direction
    if (metrics.faceDirection !== 'center' && metrics.faceDirection !== 'up') {
      if (now - this.lastWarningTime > 2000) {
        this.warningAlert$.next(`Please face the camera. Currently looking ${metrics.faceDirection}.`);
        this.lastWarningTime = now;
      }
    }
    
    // Check average attention over time
    if (this.attentionHistory.length >= 20) {
      const avgAttention = this.attentionHistory.reduce((a, b) => a + b, 0) / this.attentionHistory.length;
      if (avgAttention < 60 && now - this.lastWarningTime > 5000) {
        this.warningAlert$.next('Sustained low attention detected. Please maintain focus on the interview.');
        this.lastWarningTime = now;
      }
    }
  }

  private drawEyeDot(ctx: CanvasRenderingContext2D, eye: EyePosition, canvas: HTMLCanvasElement): void {
    const x = eye.x * canvas.width;
    const y = eye.y * canvas.height;
    
    ctx.fillStyle = '#ff4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  private drawFaceOutline(ctx: CanvasRenderingContext2D, landmarks: any[], canvas: HTMLCanvasElement): void {
    const faceOvalIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    faceOvalIndices.forEach((index, i) => {
      const point = landmarks[index];
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.closePath();
    ctx.stroke();
  }
}