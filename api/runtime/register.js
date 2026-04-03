const { register, hasBlobStore } = require("../_lib/runtime-store");
const { readBody } = require("../_lib/read-body");

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

  const body = readBody(req.body);
  const clientId = await register(body.clientId);
  res.status(200).json({
    ok: true,
    clientId,
    provider: hasBlobStore ? "blob" : "memory"
  });
};
