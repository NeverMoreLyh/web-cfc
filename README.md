# web-cfc

`web-cfc` is a static Safari-first cimbar receiver built with TypeScript, Vite, browser camera APIs, Web Workers, and libcimbar WebAssembly.

The project only implements receiving and decoding. It does not include a sender, backend upload, or the 100MB sharding protocol.

## What This Project Reuses

- `libcimbar` provides the actual frame extraction, cimbar decoding, fountain reassembly, and zstd decompression.
- `cfc` provides the receiver behavior model: auto mode probing, receive-progress reporting, and file completion flow.
- The browser layer replaces native Android/iOS pieces such as camera preview, JNI, document export, and lifecycle management.

## Directory Layout

```text
web-cfc/
  public/
    vendor/libcimbar/
    workers/
  scripts/
  src/
    app/
    core/camera/
    core/decoder/
    core/state/
    core/worker/
    features/download/
    features/scanner/
    shared/types/
    shared/ui/
  index.html
  package.json
  README.md
  tsconfig.json
  vite.config.ts
```

## Local Development

1. Install dependencies:

   ```bash
   cd web-cfc
   npm install
   ```

2. Build or prepare the libcimbar wasm artifacts.

   The app expects these files:

   - `public/vendor/libcimbar/cimbar_js.js`
   - `public/vendor/libcimbar/cimbar_js.wasm`

   If you already built `libcimbar` locally and the output exists under `../libcimbar/web/` or `../ios-cfc/Vendor/libcimbar/web/`, run:

   ```bash
   npm run sync:wasm
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open the printed HTTPS-capable tunnel or local address in Safari.

   For iPhone testing, Safari camera access requires `https://` unless you use localhost directly on-device.

## How To Build The libcimbar WASM Assets

The repository already documents the wasm build path in `libcimbar/WASM.md`. The short version is:

1. Enter a Docker image with Emscripten.
2. Run `package-wasm.sh` from the `libcimbar` root.
3. Copy the generated `cimbar_js.js` and `cimbar_js.wasm` into `web-cfc/public/vendor/libcimbar/`.

Example flow:

```bash
cd ../libcimbar
docker run --mount type=bind,source="$(pwd)",target="/usr/src/app" -it emscripten/emsdk:3.1.39
bash /usr/src/app/package-wasm.sh
```

After the build completes:

```bash
cd ../cfc/web-cfc
npm run sync:wasm
```

## Build Static Output

```bash
cd web-cfc
npm run build
```

Vite writes static assets to `dist/`. No server-side runtime is required.

## Deploy To GitHub Pages

1. Run:

   ```bash
   npm run build
   ```

2. Publish the contents of `dist/` to the target Pages branch or `gh-pages`.
3. Make sure the deployed site is served over HTTPS.
4. Confirm `cimbar_js.js` and `cimbar_js.wasm` are included under the deployed `vendor/libcimbar/` path.

Because `vite.config.ts` uses `base: './'`, the built app stays portable for project pages and direct static hosting.

## Deploy To Cloudflare Pages

1. Run:

   ```bash
   npm run build
   ```

2. Create a Pages project.
3. Set the build output directory to `web-cfc/dist`.
4. Deploy without any server or function binding.

Cloudflare Pages serves the app as a normal static HTTPS site, which matches Safari camera requirements.

## Safari Usage Notes

- Start scanning with a user tap. iPhone Safari is stricter than desktop browsers about camera startup and autoplay.
- Use the rear camera for better focus and less mirroring.
- Keep the sender display bright and stable.
- If Safari backgrounds or locks the page, camera capture may stop. Reopen Safari and tap `Start scanning` again.
- Large files increase memory pressure because the browser keeps the reconstructed bytes in memory before download.

## Known Limitations

- Receive only. No web sender page is included.
- No 100MB sharding protocol.
- The current bridge expects the existing libcimbar wasm receive exports and does not reimplement decoding in TypeScript.
- `reset` is implemented by recreating the decoder worker, because libcimbar's public wasm receive API does not expose a full state-reset function.
- Download behavior varies by Safari version and file type. Some files open in preview first, while others save directly.
- The app currently processes RGBA frames captured from a canvas for broad Safari compatibility, instead of relying on newer WebCodecs-only pathways.

## First-Run Checklist

- `npm install`
- Build `libcimbar` wasm
- `npm run sync:wasm`
- `npm run dev`
- Open over HTTPS in Safari
- Tap `Start scanning`
