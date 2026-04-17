import type {
  DecoderModeValue,
  DownloadArtifact,
  ScannerState,
} from '../../shared/types/scanner';

export interface FrameObservedPayload {
  configuredMode: DecoderModeValue;
  detectedMode: DecoderModeValue | null;
  progress: number;
  accepted: boolean;
  report: string;
}

export type ScannerEvent =
  | { type: 'START_REQUESTED'; mode: DecoderModeValue }
  | { type: 'READY'; mode: DecoderModeValue }
  | { type: 'FRAME_OBSERVED'; payload: FrameObservedPayload }
  | { type: 'COMPLETED'; mode: DecoderModeValue; download: DownloadArtifact }
  | { type: 'RESET'; mode: DecoderModeValue; message?: string }
  | { type: 'FAILED'; mode: DecoderModeValue; message: string }
  | { type: 'STOPPED'; mode: DecoderModeValue; message?: string };

export function createInitialScannerState(
  mode: DecoderModeValue = 0,
): ScannerState {
  return {
    status: 'idle',
    configuredMode: mode,
    detectedMode: null,
    progress: 0,
    message: 'Tap "Start scanning" after opening the page in Safari over HTTPS.',
    download: null,
  };
}

export function reduceScannerState(
  state: ScannerState,
  event: ScannerEvent,
): ScannerState {
  switch (event.type) {
    case 'START_REQUESTED':
      return {
        status: 'requestingPermission',
        configuredMode: event.mode,
        detectedMode: null,
        progress: 0,
        message: 'Requesting camera permission and booting the WASM decoder...',
        download: null,
      };
    case 'READY':
      return {
        ...state,
        status: 'ready',
        configuredMode: event.mode,
        message: 'Camera is ready. Align the animated cimbar code inside the guide frame.',
      };
    case 'FRAME_OBSERVED': {
      const nextStatus =
        event.payload.progress > 0
          ? 'receiving'
          : event.payload.configuredMode === 0 && !event.payload.detectedMode
            ? 'detectingMode'
            : 'scanning';

      return {
        ...state,
        status: nextStatus,
        configuredMode: event.payload.configuredMode,
        detectedMode: event.payload.detectedMode ?? state.detectedMode,
        progress: Math.max(state.progress, event.payload.progress),
        message:
          Math.max(state.progress, event.payload.progress) > 0
            ? `Receiving file... ${Math.round(Math.max(state.progress, event.payload.progress) * 100)}%`
            : event.payload.accepted
              ? 'Frame accepted. Keep the screen stable for the remaining packets.'
              : event.payload.report || 'Scanning for cimbar frames...',
      };
    }
    case 'COMPLETED':
      return {
        status: 'completed',
        configuredMode: event.mode,
        detectedMode: state.detectedMode,
        progress: 1,
        message: `Decode finished. "${event.download.fileName}" is ready to download.`,
        download: event.download,
      };
    case 'RESET':
      return {
        status: 'idle',
        configuredMode: event.mode,
        detectedMode: null,
        progress: 0,
        message:
          event.message ??
          'Decoder state cleared. Start scanning when the sender begins again.',
        download: null,
      };
    case 'FAILED':
      return {
        status: 'error',
        configuredMode: event.mode,
        detectedMode: state.detectedMode,
        progress: state.progress,
        message: event.message,
        download: state.download,
      };
    case 'STOPPED':
      return {
        status: 'idle',
        configuredMode: event.mode,
        detectedMode: null,
        progress: 0,
        message:
          event.message ?? 'Scanner stopped. Tap "Start scanning" to open the camera again.',
        download: state.download,
      };
  }
}
