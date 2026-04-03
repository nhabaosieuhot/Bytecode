const { status } = require("../_lib/runtime-store");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }

  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  if (!clientId) {
    res.status(400).json({ ok: false, error: "missing clientId" });
    return;
  }

  res.status(200).json({
    ok: true,
    clientId,
    status: status(clientId)
  });
};
