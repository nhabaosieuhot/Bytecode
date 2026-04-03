const { pushResult, hasBlobStore } = require("../_lib/runtime-store");

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

  if (!clientId) {
    res.status(400).json({ ok: false, error: "missing clientId" });
    return;
  }

  const result = await pushResult(clientId, body);
  res.status(200).json({
    ok: true,
    provider: hasBlobStore ? "blob" : "memory",
    result
  });
};
