import type {
  DecoderModeValue,
  DecoderSnapshot,
  FrameDecodeResult,
  FramePayload,
} from '../../shared/types/scanner';
import { DecoderWorkerClient } from '../worker/DecoderWorkerClient';

interface DecoderBridgeOptions {
  workerUrl: string;
  wasmScriptUrl: string;
  wasmBinaryUrl: string;
}

export class DecoderBridge {
  private readonly client: DecoderWorkerClient;
  private currentMode: DecoderModeValue = 0;
  private snapshot: DecoderSnapshot = {
    configuredMode: 0,
    detectedMode: null,
    progress: 0,
    accepted: false,
    report: '',
  };

  constructor(options: DecoderBridgeOptions) {
    this.client = new DecoderWorkerClient(options);
  }

  async start(mode: DecoderModeValue): Promise<void> {
    this.currentMode = mode;
    await this.client.start(mode);
    this.snapshot = {
      configuredMode: mode,
      detectedMode: null,
      progress: 0,
      accepted: false,
      report: '',
    };
  }

  async reset(mode: DecoderModeValue): Promise<void> {
    await this.start(mode);
  }

  stop(): void {
    this.client.stop();
  }

  async processFrame(frame: FramePayload): Promise<FrameDecodeResult> {
    const result = await this.client.processFrame(frame);
    this.snapshot = {
      configuredMode: result.configuredMode,
      detectedMode: result.detectedMode,
      progress: result.progress,
      accepted: result.accepted,
      report: result.report,
    };
    return result;
  }

  snapshotState(): DecoderSnapshot {
    return this.snapshot;
  }

  get mode(): DecoderModeValue {
    return this.currentMode;
  }
}
