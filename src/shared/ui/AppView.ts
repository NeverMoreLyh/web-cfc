import {
  DECODER_MODE_OPTIONS,
  modeLabel,
  type DecoderModeValue,
  type ScannerState,
} from '../types/scanner';

interface AppViewBindings {
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onModeChange: (mode: DecoderModeValue) => void;
}

export class AppView {
  readonly root: HTMLElement;
  readonly videoElement: HTMLVideoElement;
  readonly modeSelect: HTMLSelectElement;

  private readonly startButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly statusValue: HTMLElement;
  private readonly configuredModeValue: HTMLElement;
  private readonly detectedModeValue: HTMLElement;
  private readonly progressBar: HTMLElement;
  private readonly progressValue: HTMLElement;
  private readonly messageBox: HTMLElement;
  private readonly downloadLink: HTMLAnchorElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div class="app-shell">
        <header class="hero">
          <div>
            <div class="pill">HTTPS · Safari first · libcimbar WASM</div>
            <h1>cimbar Web Receiver</h1>
            <p>Use the iPhone rear camera to continuously scan animated cimbar codes and export the decoded file directly in Safari.</p>
          </div>
        </header>

        <main class="stage">
          <section class="preview-card">
            <video id="camera-preview" autoplay muted playsinline></video>
            <div class="preview-overlay">
              <div class="guide-frame"></div>
              <div class="guide-text">Keep the sender display bright, steady, and centered inside the frame.</div>
            </div>
          </section>

          <section class="status-grid">
            <article class="status-card">
              <div class="label">Status</div>
              <div class="value" data-field="status">Idle</div>
            </article>
            <article class="status-card">
              <div class="label">Configured Mode</div>
              <div class="value" data-field="configuredMode">Auto</div>
            </article>
            <article class="status-card">
              <div class="label">Detected Mode</div>
              <div class="value" data-field="detectedMode">Pending</div>
            </article>
            <article class="status-card" style="grid-column: 1 / -1;">
              <div class="label">Progress</div>
              <div class="value" data-field="progressText">0%</div>
              <div class="progress-shell">
                <div class="progress-bar" data-field="progressBar"></div>
              </div>
            </article>
          </section>

          <section class="control-card">
            <div class="control-row">
              <button type="button" data-kind="primary" id="start-button">Start scanning</button>
              <button type="button" data-kind="ghost" id="stop-button">Stop</button>
              <button type="button" data-kind="ghost" id="reset-button">Reset</button>
              <select id="mode-select" aria-label="Decoder mode">
                ${DECODER_MODE_OPTIONS.map(
                  (option) =>
                    `<option value="${option.value}">${option.label}</option>`,
                ).join('')}
              </select>
              <a id="download-link" class="download-link" download>Download file</a>
            </div>

            <div id="message-box" class="message-box"></div>

            <ul class="hint-list">
              <li>Start from Safari with a user tap. iPhone will not open the camera reliably on page load alone.</li>
              <li>The page only supports receiving and decoding files within libcimbar/cfc native limits.</li>
              <li>When the file finishes, Safari may preview it or save it depending on the file type and iOS version.</li>
            </ul>
          </section>
        </main>
      </div>
    `;

    this.videoElement = this.root.querySelector('#camera-preview') as HTMLVideoElement;
    this.modeSelect = this.root.querySelector('#mode-select') as HTMLSelectElement;
    this.startButton = this.root.querySelector('#start-button') as HTMLButtonElement;
    this.stopButton = this.root.querySelector('#stop-button') as HTMLButtonElement;
    this.resetButton = this.root.querySelector('#reset-button') as HTMLButtonElement;
    this.statusValue = this.root.querySelector('[data-field="status"]') as HTMLElement;
    this.configuredModeValue = this.root.querySelector(
      '[data-field="configuredMode"]',
    ) as HTMLElement;
    this.detectedModeValue = this.root.querySelector(
      '[data-field="detectedMode"]',
    ) as HTMLElement;
    this.progressBar = this.root.querySelector('[data-field="progressBar"]') as HTMLElement;
    this.progressValue = this.root.querySelector(
      '[data-field="progressText"]',
    ) as HTMLElement;
    this.messageBox = this.root.querySelector('#message-box') as HTMLElement;
    this.downloadLink = this.root.querySelector('#download-link') as HTMLAnchorElement;
  }

  bind(bindings: AppViewBindings): void {
    this.startButton.addEventListener('click', bindings.onStart);
    this.stopButton.addEventListener('click', bindings.onStop);
    this.resetButton.addEventListener('click', bindings.onReset);
    this.modeSelect.addEventListener('change', () => {
      bindings.onModeChange(Number(this.modeSelect.value) as DecoderModeValue);
    });
  }

  render(state: ScannerState): void {
    this.statusValue.textContent = state.status;
    this.configuredModeValue.textContent = modeLabel(state.configuredMode);
    this.detectedModeValue.textContent = modeLabel(state.detectedMode);
    this.progressBar.style.width = `${Math.round(state.progress * 100)}%`;
    this.progressValue.textContent = `${Math.round(state.progress * 100)}%`;
    this.messageBox.textContent = state.message;
    this.messageBox.dataset.tone = state.status === 'error' ? 'error' : 'neutral';
    this.modeSelect.value = String(state.configuredMode);

    if (state.download) {
      this.downloadLink.href = state.download.blobUrl;
      this.downloadLink.download = state.download.fileName;
      this.downloadLink.textContent = `Download ${state.download.fileName}`;
      this.downloadLink.dataset.visible = 'true';
    } else {
      this.downloadLink.removeAttribute('href');
      this.downloadLink.removeAttribute('download');
      this.downloadLink.textContent = 'Download file';
      this.downloadLink.dataset.visible = 'false';
    }
  }
}
