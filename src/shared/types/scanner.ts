export type DecoderModeValue = 0 | 4 | 66 | 67 | 68;

export interface DecoderModeOption {
  value: DecoderModeValue;
  label: string;
}

export const DECODER_MODE_OPTIONS: DecoderModeOption[] = [
  { value: 0, label: 'Auto' },
  { value: 68, label: 'B' },
  { value: 4, label: '4C' },
  { value: 66, label: 'BU' },
  { value: 67, label: 'BM' },
];

export type ScannerStatus =
  | 'idle'
  | 'requestingPermission'
  | 'ready'
  | 'scanning'
  | 'detectingMode'
  | 'receiving'
  | 'completed'
  | 'error';

export interface DownloadArtifact {
  fileName: string;
  blob: Blob;
  blobUrl: string;
}

export interface ScannerState {
  status: ScannerStatus;
  configuredMode: DecoderModeValue;
  detectedMode: DecoderModeValue | null;
  progress: number;
  elapsedMs: number | null;
  message: string;
  download: DownloadArtifact | null;
}

export interface FramePayload {
  width: number;
  height: number;
  buffer: ArrayBuffer;
}

export interface DecoderSnapshot {
  configuredMode: DecoderModeValue;
  detectedMode: DecoderModeValue | null;
  progress: number;
  accepted: boolean;
  report: string;
}

export interface FrameDecodeResult extends DecoderSnapshot {
  completedFile:
    | {
        fileName: string;
        buffer: ArrayBuffer;
        mimeType: string;
      }
    | null;
}

export const MODE_LABELS: Record<Exclude<DecoderModeValue, 0>, string> = {
  4: '4C',
  66: 'BU',
  67: 'BM',
  68: 'B',
};

export function modeLabel(mode: DecoderModeValue | null): string {
  if (mode === null) {
    return 'Pending';
  }

  if (mode === 0) {
    return 'Auto';
  }

  return MODE_LABELS[mode];
}
