const clients = new Map();

function now() {
  return Date.now();
}

function randomId(prefix) {
  return `${prefix}_${now()}_${Math.floor(Math.random() * 1e9)}`;
}

function getClient(clientId) {
  if (!clients.has(clientId)) {
    clients.set(clientId, {
      queue: [],
      results: [],
      lastSeen: now()
    });
  }
  const client = clients.get(clientId);
  client.lastSeen = now();
  return client;
}

function register(clientId) {
  const id = typeof clientId === "string" && clientId ? clientId : randomId("runtime");
  getClient(id);
  return id;
}

function enqueue(clientId, command) {
  const client = getClient(clientId);
  const item = {
    id: randomId("cmd"),
    type: command.type || "execute",
    source: command.source || "",
    label: command.label || "",
    createdAt: now()
  };
  client.queue.push(item);
  return item;
}

function poll(clientId) {
  const client = getClient(clientId);
  return client.queue.shift() || null;
}

function pushResult(clientId, result) {
  const client = getClient(clientId);
  const item = {
    id: result.commandId || randomId("result"),
    success: result.success === true,
    message: result.message || "",
    createdAt: now()
  };
  client.results.push(item);
  if (client.results.length > 20) {
    client.results.splice(0, client.results.length - 20);
  }
  return item;
}

function latestResult(clientId) {
  const client = getClient(clientId);
  return client.results.length ? client.results[client.results.length - 1] : null;
}

function status(clientId) {
  const client = getClient(clientId);
  return {
    queueLength: client.queue.length,
    latestResult: client.results.length ? client.results[client.results.length - 1] : null,
    lastSeen: client.lastSeen
  };
}

module.exports = {
  register,
  enqueue,
  poll,
  pushResult,
  latestResult,
  status
};
