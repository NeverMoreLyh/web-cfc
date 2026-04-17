import type { DownloadArtifact } from '../../shared/types/scanner';

export class DownloadController {
  private current: DownloadArtifact | null = null;

  create(fileName: string, bytes: ArrayBuffer, mimeType = 'application/octet-stream'): DownloadArtifact {
    this.clear();

    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    this.current = {
      fileName,
      blob,
      blobUrl,
    };
    return this.current;
  }

  clear(): void {
    if (this.current) {
      URL.revokeObjectURL(this.current.blobUrl);
      this.current = null;
    }
  }

  snapshot(): DownloadArtifact | null {
    return this.current;
  }
}
