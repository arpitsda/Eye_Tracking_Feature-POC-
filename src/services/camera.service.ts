import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private stream: MediaStream | null = null;
  public cameraError$ = new Subject<string>();
  public cameraReady$ = new Subject<boolean>();

  async initializeCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // More permissive constraints
      const constraints = {
        video: {
          width: { ideal: 640, min: 320, max: 1280 },
          height: { ideal: 480, min: 240, max: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15, max: 60 }
        },
        audio: false
      };

      console.log('Requesting camera access...');
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!this.stream) {
        throw new Error('No media stream received');
      }

      console.log('Camera stream obtained, setting up video element...');
      videoElement.srcObject = this.stream;
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 10000);

        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout);
          console.log('Video metadata loaded, starting playback...');
          
          videoElement.play()
            .then(() => {
              console.log('Video playback started successfully');
              this.cameraReady$.next(true);
              resolve(true);
            })
            .catch((playError) => {
              console.error('Video play error:', playError);
              this.cameraError$.next('Failed to start video playback. Try clicking the video area.');
              resolve(false);
            });
        };

        videoElement.onerror = (error) => {
          clearTimeout(timeout);
          console.error('Video element error:', error);
          this.cameraError$.next('Video element error occurred');
          resolve(false);
        };
      });
    } catch (error: any) {
      console.error('Camera initialization failed:', error);
      
      let errorMessage = 'Failed to access camera. ';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Camera permission denied. Please allow camera access and refresh the page.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Camera is being used by another application. Please close other apps using the camera.';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMessage += 'Camera does not meet the required specifications. Trying with basic settings...';
        
        // Fallback with minimal constraints
        try {
          const fallbackConstraints = { video: true, audio: false };
          this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          videoElement.srcObject = this.stream;
          
          return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
              videoElement.play();
              this.cameraReady$.next(true);
              resolve(true);
            };
          });
        } catch (fallbackError) {
          errorMessage += ' Fallback also failed.';
        }
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera not supported in this browser. Try Chrome, Firefox, or Edge.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      this.cameraError$.next(errorMessage);
      return false;
    }
  }

  async checkCameraPermissions(): Promise<string> {
    try {
      if (!navigator.permissions) {
        return 'Permissions API not supported';
      }
      
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return permission.state;
    } catch (error) {
      return 'Unable to check permissions';
    }
  }

  async listCameraDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.label);
      });
      this.stream = null;
    }
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  isSecureContext(): boolean {
    return window.isSecureContext;
  }
}