const fs = require("fs");
const path = require("path");

let ModulePromise = null;

async function loadModule() {
  if (ModulePromise) {
    return ModulePromise;
  }

  ModulePromise = (async () => {
    const repoRoot = path.resolve(__dirname, "..", "..");
    const modulePath = path.join(repoRoot, "luau.js");
    const wasmPath = path.join(repoRoot, "luau.wasm");

    if (!fs.existsSync(modulePath) || !fs.existsSync(wasmPath)) {
      throw new Error("missing luau.js or luau.wasm");
    }

    const LuauModule = require(modulePath);
    const wasmBinary = fs.readFileSync(wasmPath);
    return LuauModule({ wasmBinary });
  })();

  return ModulePromise;
}

function compileSource(M, source, wrapTask) {
  const srcLen = M.lengthBytesUTF8(source);
  const srcPtr = M._malloc(srcLen + 1);
  M.stringToUTF8(source, srcPtr, srcLen + 1);

  try {
    const errPtr = M._getError(srcPtr, srcLen, wrapTask ? 1 : 0);
    if (errPtr) {
      throw new Error(M.UTF8ToString(errPtr));
    }

    const size = M._compileFull(srcPtr, srcLen, wrapTask ? 1 : 0);
    if (size <= 0) {
      throw new Error("compilation produced empty output");
    }

    const resultPtr = M._getResult();
    const output = Buffer.from(new Uint8Array(M.HEAPU8.buffer, resultPtr, size));
    M._freeResult();
    return output;
  } finally {
    M._free(srcPtr);
  }
}

async function compileToBase64(source, wrapTask) {
  const M = await loadModule();
  const output = compileSource(M, source, wrapTask);
  return {
    size: output.length,
    bytecode: output.toString("base64")
  };
}

module.exports = {
  compileToBase64
};
