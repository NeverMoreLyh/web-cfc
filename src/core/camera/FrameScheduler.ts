type TickHandler = () => Promise<void> | void;

interface FrameSchedulerOptions {
  targetFps?: number;
}

export class FrameScheduler {
  private targetFps: number;
  private animationFrameId = 0;
  private running = false;
  private inFlight = false;
  private lastTickAt = 0;

  constructor(options: FrameSchedulerOptions = {}) {
    this.targetFps = options.targetFps ?? 6;
  }

  start(handler: TickHandler): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTickAt = 0;

    const loop = async (timestamp: number) => {
      if (!this.running) {
        return;
      }

      const interval = 1000 / this.targetFps;
      if (!this.inFlight && timestamp - this.lastTickAt >= interval) {
        this.inFlight = true;
        this.lastTickAt = timestamp;
        try {
          await handler();
        } finally {
          this.inFlight = false;
        }
      }

      this.animationFrameId = window.requestAnimationFrame(loop);
    };

    this.animationFrameId = window.requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    this.inFlight = false;
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  setTargetFps(targetFps: number): void {
    this.targetFps = Math.max(1, targetFps);
  }
}
