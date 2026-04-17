const AUTO_MODE_SEQUENCE = [4, 66, 67, 68];

let runtimeReady = false;
let moduleRuntime = null;
let currentMode = 0;
let lastConfiguredMode = null;
let detectedMode = null;
let frameCounter = 0;
let progress = 0;
let stickyProgress = 0;
let stickyAccepted = false;
let reportText = '';
const heapBuffers = new Map();

function nextAutoMode() {
  frameCounter += 1;
  return AUTO_MODE_SEQUENCE[(frameCounter - 1) % AUTO_MODE_SEQUENCE.length];
}

function normalizeMode(mode) {
  return Number(mode) > 0 ? Number(mode) : 0;
}

function configureMode(mode) {
  const wasmMode = mode > 0 ? mode : 68;
  if (lastConfiguredMode === wasmMode) {
    return;
  }
  moduleRuntime._cimbard_configure_decode(wasmMode);
  lastConfiguredMode = wasmMode;
}

function ensureBuffer(name, size) {
  const existing = heapBuffers.get(name);
  if (existing && existing.size >= size) {
    return existing;
  }

  if (existing) {
    moduleRuntime._free(existing.ptr);
  }

  const ptr = moduleRuntime._malloc(size);
  const next = { ptr, size };
  heapBuffers.set(name, next);
  return next;
}

function heapView(name, size) {
  const { ptr } = ensureBuffer(name, size);
  return new Uint8Array(moduleRuntime.HEAPU8.buffer, ptr, size);
}

function readReport() {
  const err = heapView('report', 4096);
  const length = moduleRuntime._cimbard_get_report(err.byteOffset, err.length);
  if (length <= 0) {
    return '';
  }

  return new TextDecoder().decode(
    new Uint8Array(moduleRuntime.HEAPU8.buffer, err.byteOffset, length),
  );
}

function parseProgress(report) {
  if (!report) {
    return 0;
  }

  try {
    const parsed = JSON.parse(report);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return 0;
    }
    return Math.max(...parsed.map((value) => Number(value) || 0));
  } catch {
    return 0;
  }
}

function sanitizeFileName(name, fileId) {
  const trimmed = (name || '').trim();
  if (trimmed) {
    return trimmed;
  }
  return `cimbar-received-${fileId}.bin`;
}

function assembleCompletedFile(fileId) {
  const filenameBuffer = heapView('filename', 1024);
  const filenameLength = moduleRuntime._cimbard_get_filename(
    fileId,
    filenameBuffer.byteOffset,
    filenameBuffer.length,
  );

  if (filenameLength < 0) {
    throw new Error(`Failed to recover completed file name (${filenameLength}).`);
  }

  const rawName =
    filenameLength > 0
      ? new TextDecoder().decode(
          new Uint8Array(
            moduleRuntime.HEAPU8.buffer,
            filenameBuffer.byteOffset,
            filenameLength,
          ),
        )
      : '';

  const chunkSize = moduleRuntime._cimbard_get_decompress_bufsize();
  const output = [];
  let total = 0;
  const outBuffer = heapView('decompress', chunkSize);

  while (true) {
    const read = moduleRuntime._cimbard_decompress_read(
      fileId,
      outBuffer.byteOffset,
      outBuffer.length,
    );

    if (read < 0) {
      throw new Error(`Failed to read decompressed bytes (${read}).`);
    }

    if (read === 0) {
      break;
    }

    const chunk = new Uint8Array(
      moduleRuntime.HEAPU8.buffer,
      outBuffer.byteOffset,
      read,
    ).slice();
    output.push(chunk);
    total += read;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of output) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    fileName: sanitizeFileName(rawName, fileId),
    buffer: merged.buffer,
    mimeType: 'application/octet-stream',
  };
}

async function bootRuntime(payload) {
  if (runtimeReady) {
    currentMode = normalizeMode(payload.mode);
    detectedMode = null;
    progress = 0;
    stickyProgress = 0;
    stickyAccepted = false;
    reportText = '';
    frameCounter = 0;
    lastConfiguredMode = null;
    configureMode(currentMode);
    return;
  }

  await new Promise((resolve, reject) => {
    self.Module = {
      locateFile(path) {
        if (path.endsWith('.wasm')) {
          return payload.wasmBinaryUrl;
        }
        return new URL(path, payload.wasmScriptUrl).toString();
      },
      onRuntimeInitialized() {
        moduleRuntime = self.Module;
        runtimeReady = true;
        currentMode = normalizeMode(payload.mode);
        detectedMode = null;
        progress = 0;
        stickyProgress = 0;
        stickyAccepted = false;
        reportText = '';
        frameCounter = 0;
        lastConfiguredMode = null;
        configureMode(currentMode);
        resolve();
      },
      onAbort(reason) {
        reject(new Error(String(reason || 'WASM aborted.')));
      },
    };

    try {
      importScripts(payload.wasmScriptUrl);
    } catch (error) {
      reject(error);
    }
  });
}

function bigintToFileId(value) {
  if (typeof value === 'bigint') {
    return Number(value & 0xffffffffn);
  }
  return Number(value);
}

function processFrame(payload) {
  if (!runtimeReady || !moduleRuntime) {
    throw new Error('Decoder runtime is not ready.');
  }

  const frameMode = currentMode === 0 ? nextAutoMode() : currentMode;
  configureMode(frameMode);

  const rgba = new Uint8Array(payload.buffer);
  const imgBuffer = heapView('image', rgba.length);
  imgBuffer.set(rgba);

  const outputLength = moduleRuntime._cimbard_get_bufsize();
  const fountainBuffer = heapView('fountain', outputLength);

  const extractedBytes = moduleRuntime._cimbard_scan_extract_decode(
    imgBuffer.byteOffset,
    payload.width,
    payload.height,
    4,
    fountainBuffer.byteOffset,
    fountainBuffer.length,
  );

  reportText = readReport();

  if (extractedBytes <= 0) {
    progress = Math.max(stickyProgress, parseProgress(reportText));
    return {
      configuredMode: currentMode,
      detectedMode,
      progress,
      accepted: stickyAccepted,
      report: reportText,
      completedFile: null,
    };
  }

  const decodeResult = moduleRuntime._cimbard_fountain_decode(
    fountainBuffer.byteOffset,
    extractedBytes,
  );

  reportText = readReport();
  progress = parseProgress(reportText);

  if (currentMode === 0) {
    detectedMode = frameMode;
  } else {
    detectedMode = currentMode;
  }

  stickyProgress = Math.max(stickyProgress, progress);
  stickyAccepted = true;

  const fileId = bigintToFileId(decodeResult);
  const completedFile = fileId > 0 ? assembleCompletedFile(fileId) : null;

  return {
    configuredMode: currentMode,
    detectedMode,
    progress: completedFile ? 1 : stickyProgress,
    accepted: true,
    report: reportText,
    completedFile,
  };
}

self.onmessage = async (event) => {
  const { data } = event;

  try {
    if (data.type === 'init') {
      await bootRuntime(data.payload);
      self.postMessage({
        type: 'ready',
        requestId: data.requestId,
      });
      return;
    }

    if (data.type === 'processFrame') {
      const result = processFrame(data.payload);
      const transfer = [];
      if (result.completedFile?.buffer) {
        transfer.push(result.completedFile.buffer);
      }
      self.postMessage(
        {
          type: 'frameResult',
          requestId: data.requestId,
          payload: result,
        },
        transfer,
      );
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: data.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
