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
  private readonly options: DecoderBridgeOptions;
  private clients: DecoderWorkerClient[] = [];
  private currentMode: DecoderModeValue = 0;
  private lockedAutoMode: Exclude<DecoderModeValue, 0> | null = null;
  private snapshot: DecoderSnapshot = {
    configuredMode: 0,
    detectedMode: null,
    progress: 0,
    accepted: false,
    report: '',
  };

  constructor(options: DecoderBridgeOptions) {
    this.options = options;
  }

  async start(mode: DecoderModeValue): Promise<void> {
    this.currentMode = mode;
    this.lockedAutoMode = null;
    this.stop();

    const bootModes: DecoderModeValue[] =
      mode === 0 ? [4, 66, 67, 68] : [mode];

    this.clients = bootModes.map(
      () =>
        new DecoderWorkerClient({
          workerUrl: this.options.workerUrl,
          wasmScriptUrl: this.options.wasmScriptUrl,
          wasmBinaryUrl: this.options.wasmBinaryUrl,
        }),
    );

    await Promise.all(
      this.clients.map((client, index) => client.start(bootModes[index])),
    );

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
    for (const client of this.clients) {
      client.stop();
    }
    this.clients = [];
  }

  async processFrame(frame: FramePayload): Promise<FrameDecodeResult> {
    const results = await this.processAcrossClients(frame);
    const result = this.selectBestResult(results);

    if (
      this.currentMode === 0 &&
      !this.lockedAutoMode &&
      result.completedFile === null &&
      result.progress > 0 &&
      result.detectedMode
    ) {
      this.lockedAutoMode = result.detectedMode;
    }

    this.snapshot = {
      configuredMode: this.currentMode,
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

  private async processAcrossClients(frame: FramePayload): Promise<FrameDecodeResult[]> {
    if (this.clients.length === 0) {
      throw new Error('Decoder workers are not running.');
    }

    if (this.currentMode !== 0) {
      return [await this.clients[0].processFrame(frame)];
    }

    if (this.lockedAutoMode) {
      const index = [4, 66, 67, 68].indexOf(this.lockedAutoMode);
      const client = this.clients[index];
      return [await client.processFrame(frame)];
    }

    return Promise.all(
      this.clients.map((client, index) =>
        client.processFrame(cloneFramePayload(frame, index < this.clients.length - 1)),
      ),
    );
  }

  private selectBestResult(results: FrameDecodeResult[]): FrameDecodeResult {
    const completed = results.find((result) => result.completedFile);
    if (completed) {
      return {
        ...completed,
        configuredMode: this.currentMode,
      };
    }

    const receiving = [...results].sort((left, right) => right.progress - left.progress)[0];
    if (receiving.progress > 0) {
      return {
        ...receiving,
        configuredMode: this.currentMode,
      };
    }

    const accepted = results.find((result) => result.accepted);
    if (accepted) {
      return {
        ...accepted,
        configuredMode: this.currentMode,
      };
    }

    return {
      ...results[0],
      configuredMode: this.currentMode,
    };
  }
}

function cloneFramePayload(frame: FramePayload, detachOriginal: boolean): FramePayload {
  if (!detachOriginal) {
    return frame;
  }

  return {
    width: frame.width,
    height: frame.height,
    buffer: frame.buffer.slice(0),
  };
}
