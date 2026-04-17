import type {
  DecoderModeValue,
  FrameDecodeResult,
  FramePayload,
} from '../../shared/types/scanner';

interface InitPayload {
  wasmScriptUrl: string;
  wasmBinaryUrl: string;
  mode: DecoderModeValue;
}

type WorkerRequest =
  | {
      type: 'init';
      requestId: number;
      payload: InitPayload;
    }
  | {
      type: 'processFrame';
      requestId: number;
      payload: FramePayload;
    };

type WorkerResponse =
  | {
      type: 'ready';
      requestId: number;
    }
  | {
      type: 'frameResult';
      requestId: number;
      payload: FrameDecodeResult;
    }
  | {
      type: 'error';
      requestId: number;
      message: string;
    };

interface DecoderWorkerClientOptions {
  workerUrl: string;
  wasmScriptUrl: string;
  wasmBinaryUrl: string;
}

export class DecoderWorkerClient {
  private readonly workerUrl: string;
  private readonly wasmScriptUrl: string;
  private readonly wasmBinaryUrl: string;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
    }
  >();

  constructor(options: DecoderWorkerClientOptions) {
    this.workerUrl = options.workerUrl;
    this.wasmScriptUrl = options.wasmScriptUrl;
    this.wasmBinaryUrl = options.wasmBinaryUrl;
  }

  async start(mode: DecoderModeValue): Promise<void> {
    this.stop();
    this.worker = new Worker(this.workerUrl);
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      const pending = this.pending.get(data.requestId);
      if (!pending) {
        return;
      }

      this.pending.delete(data.requestId);
      if (data.type === 'error') {
        pending.reject(new Error(data.message));
        return;
      }

      pending.resolve('payload' in data ? data.payload : undefined);
    };

    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Decoder worker crashed.');
      this.rejectAll(error);
      this.stop();
    };

    await this.postMessage<void>({
      type: 'init',
      requestId: this.nextId(),
      payload: {
        wasmScriptUrl: this.wasmScriptUrl,
        wasmBinaryUrl: this.wasmBinaryUrl,
        mode,
      },
    });
  }

  async processFrame(frame: FramePayload): Promise<FrameDecodeResult> {
    return this.postMessage<FrameDecodeResult>(
      {
        type: 'processFrame',
        requestId: this.nextId(),
        payload: frame,
      },
      [frame.buffer],
    );
  }

  stop(): void {
    this.rejectAll(new Error('Decoder worker stopped.'));
    this.worker?.terminate();
    this.worker = null;
  }

  private postMessage<T>(
    payload: WorkerRequest,
    transfer: Transferable[] = [],
  ): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error('Decoder worker is not running.'));
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.set(payload.requestId, { resolve, reject });
      this.worker?.postMessage(payload, transfer);
    });
  }

  private nextId(): number {
    return this.nextRequestId++;
  }

  private rejectAll(reason: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(reason);
    }
    this.pending.clear();
  }
}
