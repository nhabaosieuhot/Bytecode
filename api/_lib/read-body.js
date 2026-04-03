function parseJson(text) {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function readBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    return parseJson(body);
  }

  if (Buffer.isBuffer(body)) {
    return parseJson(body.toString("utf8"));
  }

  if (typeof body === "object") {
    if (typeof body.toString === "function" && body.constructor && body.constructor.name === "Uint8Array") {
      return parseJson(Buffer.from(body).toString("utf8"));
    }
    return body;
  }

  return {};
}

module.exports = {
  readBody
};
