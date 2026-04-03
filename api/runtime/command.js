const { enqueue, latestResult, hasBlobStore } = require("../_lib/runtime-store");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const source = typeof body.source === "string" ? body.source : "";

  if (!clientId || !source) {
    res.status(400).json({ ok: false, error: "missing clientId or source" });
    return;
  }

  const command = await enqueue(clientId, {
    type: body.type,
    source,
    label: body.label
  });

  res.status(200).json({
    ok: true,
    provider: hasBlobStore ? "blob" : "memory",
    command,
    latestResult: await latestResult(clientId)
  });
};
