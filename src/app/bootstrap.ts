import { ScannerController } from '../features/scanner/ScannerController';
import { AppView } from '../shared/ui/AppView';

function resolvePublicAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return new URL(`${base}${path}`, window.location.href).toString();
}

export async function bootstrap(root: HTMLElement | null): Promise<void> {
  if (!root) {
    throw new Error('App root element not found.');
  }

  const view = new AppView(root);
  const controller = new ScannerController({
    view,
    workerUrl: resolvePublicAsset('workers/cimbar-decoder-worker.js'),
    wasmScriptUrl: resolvePublicAsset('vendor/libcimbar/cimbar_js.js'),
    wasmBinaryUrl: resolvePublicAsset('vendor/libcimbar/cimbar_js.wasm'),
  });

  controller.mount();
}
