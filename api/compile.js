const { compileToBase64 } = require("./_lib/compiler");

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

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const source = typeof body.source === "string" ? body.source : "";
    const wrapTask = body.wrapTask !== false;

    if (!source) {
      res.status(400).json({ ok: false, error: "missing source" });
      return;
    }

    const result = await compileToBase64(source, wrapTask);
    res.status(200).json({
      ok: true,
      encoding: "base64",
      size: result.size,
      bytecode: result.bytecode
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
};
