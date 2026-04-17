import { CameraController } from '../../core/camera/CameraController';
import { FrameScheduler } from '../../core/camera/FrameScheduler';
import { DecoderBridge } from '../../core/decoder/DecoderBridge';
import {
  createInitialScannerState,
  reduceScannerState,
} from '../../core/state/scannerMachine';
import { DownloadController } from '../download/DownloadController';
import type { AppView } from '../../shared/ui/AppView';
import type {
  DecoderModeValue,
  FrameDecodeResult,
  ScannerState,
} from '../../shared/types/scanner';
import { modeLabel } from '../../shared/types/scanner';

interface ScannerControllerOptions {
  view: AppView;
  workerUrl: string;
  wasmScriptUrl: string;
  wasmBinaryUrl: string;
}

export class ScannerController {
  private readonly view: AppView;
  private readonly camera = new CameraController();
  private readonly scheduler = new FrameScheduler({ targetFps: 6 });
  private readonly decoder: DecoderBridge;
  private readonly downloads = new DownloadController();
  private state = createInitialScannerState();
  private active = false;
  private processingVisibilityReset = false;

  constructor(options: ScannerControllerOptions) {
    this.view = options.view;
    this.decoder = new DecoderBridge({
      workerUrl: options.workerUrl,
      wasmScriptUrl: options.wasmScriptUrl,
      wasmBinaryUrl: options.wasmBinaryUrl,
    });
  }

  mount(): void {
    this.view.bind({
      onStart: () => {
        void this.start();
      },
      onStop: () => {
        this.stop();
      },
      onReset: () => {
        void this.reset();
      },
      onModeChange: (mode) => {
        void this.changeMode(mode);
      },
    });

    this.render();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseForVisibility();
        return;
      }
      void this.resumeAfterVisibility();
    });
  }

  async start(): Promise<void> {
    if (this.active) {
      return;
    }

    const mode = this.state.configuredMode;
    this.dispatch({ type: 'START_REQUESTED', mode });

    try {
      await this.decoder.start(mode);
      await this.camera.start(this.view.videoElement);
      this.dispatch({ type: 'READY', mode });
      this.active = true;
      this.scheduler.start(async () => {
        await this.scanTick();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start scanner.';
      this.shutdownResources();
      this.dispatch({ type: 'FAILED', mode, message });
    }
  }

  stop(): void {
    this.shutdownResources();
    this.dispatch({
      type: 'STOPPED',
      mode: this.state.configuredMode,
    });
  }

  async reset(): Promise<void> {
    const mode = this.state.configuredMode;
    this.scheduler.stop();
    this.downloads.clear();
    this.dispatch({
      type: 'RESET',
      mode,
      message: 'Decoder reset. Start scanning again when the sender restarts.',
    });

    if (this.active) {
      try {
        await this.decoder.reset(mode);
        this.scheduler.start(async () => {
          await this.scanTick();
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reset decoder.';
        this.shutdownResources();
        this.dispatch({ type: 'FAILED', mode, message });
      }
    }
  }

  async changeMode(mode: DecoderModeValue): Promise<void> {
    const wasActive = this.active;
    this.state = {
      ...this.state,
      configuredMode: mode,
      detectedMode: null,
      progress: 0,
      download: this.state.download,
      message: `Mode set to ${modeLabel(mode)}.`,
    };
    this.render();

    if (!wasActive) {
      return;
    }

    try {
      this.scheduler.stop();
      await this.decoder.reset(mode);
      this.dispatch({
        type: 'RESET',
        mode,
        message: 'Mode changed. Decoder state restarted to match the new mode.',
      });
      this.scheduler.start(async () => {
        await this.scanTick();
      });
      this.active = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch decoder mode.';
      this.shutdownResources();
      this.dispatch({ type: 'FAILED', mode, message });
    }
  }

  private async scanTick(): Promise<void> {
    const frame = this.camera.captureFrame(this.view.videoElement);
    if (!frame) {
      return;
    }

    try {
      const result = await this.decoder.processFrame(frame);
      this.handleFrameResult(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Frame decode failed unexpectedly.';
      this.shutdownResources();
      this.dispatch({
        type: 'FAILED',
        mode: this.state.configuredMode,
        message,
      });
    }
  }

  private handleFrameResult(result: FrameDecodeResult): void {
    if (result.completedFile) {
      const download = this.downloads.create(
        result.completedFile.fileName,
        result.completedFile.buffer,
        result.completedFile.mimeType,
      );
      this.dispatch({
        type: 'COMPLETED',
        mode: result.configuredMode,
        download,
      });
      this.shutdownResources();
      return;
    }

    this.dispatch({
      type: 'FRAME_OBSERVED',
      payload: {
        configuredMode: result.configuredMode,
        detectedMode: result.detectedMode,
        progress: result.progress,
        accepted: result.accepted,
        report: result.report,
      },
    });
  }

  private pauseForVisibility(): void {
    if (!this.active) {
      return;
    }

    this.shutdownResources();
    this.dispatch({
      type: 'STOPPED',
      mode: this.state.configuredMode,
      message: 'Safari paused camera capture in the background. Tap "Start scanning" to resume.',
    });
  }

  private async resumeAfterVisibility(): Promise<void> {
    if (this.processingVisibilityReset || document.hidden || this.active) {
      return;
    }

    this.processingVisibilityReset = true;
    try {
      const shouldRestore =
        this.state.status !== 'completed' && this.state.status !== 'error';
      if (shouldRestore) {
        await this.start();
      }
    } finally {
      this.processingVisibilityReset = false;
    }
  }

  private dispatch(event: Parameters<typeof reduceScannerState>[1]): void {
    this.state = reduceScannerState(this.state, event);
    this.render();
  }

  private shutdownResources(): void {
    this.scheduler.stop();
    this.camera.stop(this.view.videoElement);
    this.decoder.stop();
    this.active = false;
  }

  private render(): void {
    this.view.render(this.state as ScannerState);
  }
}
