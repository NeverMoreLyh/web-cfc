Place `cimbar_js.js` and `cimbar_js.wasm` here.

Recommended source:

1. Build `libcimbar` with Emscripten using its `package-wasm.sh`.
2. Copy the generated artifacts from `../libcimbar/web/` or `ios-cfc/Vendor/libcimbar/web/`.
3. Or run `npm run sync:wasm` from this `web-cfc` directory after the artifacts exist locally.

The web receiver loads:

- `public/vendor/libcimbar/cimbar_js.js`
- `public/vendor/libcimbar/cimbar_js.wasm`
