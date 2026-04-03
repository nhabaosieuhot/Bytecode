const { put, list } = require("@vercel/blob");

const memoryClients = new Map();
const hasBlobStore = !!process.env.BLOB_READ_WRITE_TOKEN;
const statePrefix = "runtime-state/";

function now() {
  return Date.now();
}

function randomId(prefix) {
  return `${prefix}_${now()}_${Math.floor(Math.random() * 1e9)}`;
}

function createState() {
  return {
    queue: [],
    results: [],
    lastSeen: now()
  };
}

function touchState(state) {
  state.lastSeen = now();
  return state;
}

function normalizeState(state) {
  if (!state || typeof state !== "object") {
    return touchState(createState());
  }

  if (!Array.isArray(state.queue)) {
    state.queue = [];
  }
  if (!Array.isArray(state.results)) {
    state.results = [];
  }

  return touchState(state);
}

function stateKey(clientId) {
  return `${statePrefix}${encodeURIComponent(clientId)}.json`;
}

async function readBlobText(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`blob read failed (${response.status})`);
  }

  return response.text();
}

async function loadBlobState(clientId) {
  const pathname = stateKey(clientId);
  const found = await list({
    prefix: pathname,
    limit: 1
  });

  if (!found.blobs || found.blobs.length === 0) {
    return touchState(createState());
  }

  const text = await readBlobText(found.blobs[0].url);
  return normalizeState(JSON.parse(text));
}

async function saveBlobState(clientId, state) {
  const pathname = stateKey(clientId);
  await put(pathname, JSON.stringify(normalizeState(state)), {
    access: "public",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json"
  });
}

function loadMemoryState(clientId) {
  if (!memoryClients.has(clientId)) {
    memoryClients.set(clientId, createState());
  }
  return normalizeState(memoryClients.get(clientId));
}

function saveMemoryState(clientId, state) {
  memoryClients.set(clientId, normalizeState(state));
}

async function loadState(clientId) {
  if (hasBlobStore) {
    return loadBlobState(clientId);
  }
  return loadMemoryState(clientId);
}

async function saveState(clientId, state) {
  if (hasBlobStore) {
    await saveBlobState(clientId, state);
    return;
  }
  saveMemoryState(clientId, state);
}

async function register(clientId) {
  const id = typeof clientId === "string" && clientId ? clientId : randomId("runtime");
  const state = await loadState(id);
  await saveState(id, state);
  return id;
}

async function enqueue(clientId, command) {
  const state = await loadState(clientId);
  const item = {
    id: randomId("cmd"),
    type: command.type || "execute",
    source: command.source || "",
    label: command.label || "",
    createdAt: now()
  };
  state.queue.push(item);
  await saveState(clientId, state);
  return item;
}

async function poll(clientId) {
  const state = await loadState(clientId);
  const item = state.queue.shift() || null;
  await saveState(clientId, state);
  return item;
}

async function pushResult(clientId, result) {
  const state = await loadState(clientId);
  const item = {
    id: result.commandId || randomId("result"),
    success: result.success === true,
    message: result.message || "",
    createdAt: now()
  };
  state.results.push(item);
  if (state.results.length > 20) {
    state.results.splice(0, state.results.length - 20);
  }
  await saveState(clientId, state);
  return item;
}

async function latestResult(clientId) {
  const state = await loadState(clientId);
  return state.results.length ? state.results[state.results.length - 1] : null;
}

async function status(clientId) {
  const state = await loadState(clientId);
  return {
    provider: hasBlobStore ? "blob" : "memory",
    queueLength: state.queue.length,
    latestResult: state.results.length ? state.results[state.results.length - 1] : null,
    lastSeen: state.lastSeen
  };
}

module.exports = {
  register,
  enqueue,
  poll,
  pushResult,
  latestResult,
  status,
  hasBlobStore
};
