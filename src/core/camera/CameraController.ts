import type { FramePayload } from '../../shared/types/scanner';

interface CameraControllerOptions {
  preferredMaxDimension?: number;
}

export class CameraController {
  private readonly preferredMaxDimension: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private stream: MediaStream | null = null;

  constructor(options: CameraControllerOptions = {}) {
    this.preferredMaxDimension = options.preferredMaxDimension ?? 960;
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('2D canvas is not available in this browser.');
    }
    this.context = context;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support getUserMedia.');
    }

    if (this.stream) {
      this.stop();
    }

    const environmentFirst: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 24, max: 30 },
      },
    };

    const fallback: MediaStreamConstraints = {
      audio: false,
      video: true,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(environmentFirst);
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(fallback);
      } catch (error) {
        throw this.normalizeCameraError(error);
      }
    }

    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = this.stream;

    await video.play();

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
    }
  }

  stop(video?: HTMLVideoElement): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  captureFrame(video: HTMLVideoElement): FramePayload | null {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      return null;
    }

    const scale = Math.min(
      1,
      this.preferredMaxDimension / Math.max(sourceWidth, sourceHeight),
    );
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.context.drawImage(video, 0, 0, width, height);
    const imageData = this.context.getImageData(0, 0, width, height);

    return {
      width,
      height,
      buffer: imageData.data.buffer,
    };
  }

  private normalizeCameraError(error: unknown): Error {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return new Error('Camera permission was denied. Allow camera access in Safari and try again.');
      }
      if (error.name === 'NotFoundError') {
        return new Error('No camera was found on this device.');
      }
      if (error.name === 'NotReadableError') {
        return new Error('The camera is already in use by another app or browser tab.');
      }
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Failed to initialize the camera.');
  }
}
