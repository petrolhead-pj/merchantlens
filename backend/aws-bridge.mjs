import { createRequire } from "node:module";
const sdk = createRequire(
  new URL("../.demo-tools/package.json", import.meta.url),
);
export async function awsBridge(req, res) {
  try {
    const { SignatureV4 } = sdk("@aws-sdk/signature-v4"),
      { fromNodeProviderChain } = sdk("@aws-sdk/credential-providers"),
      { Sha256 } = sdk("@aws-crypto/sha256-js");
    const region = process.env.AWS_REGION,
      url = new URL(process.env.MERCHANTLENS_API);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".execute-api." + region + ".amazonaws.com")
    )
      throw Error("Invalid API endpoint");
    if (
      req.method === "POST" &&
      req.headers["content-type"] !== "application/json"
    )
      throw Error("Expected JSON");
    let body = "";
    for await (const part of req) {
      body += part;
      if (body.length > 8192) throw Error("Request too large");
    }
    const signer = new SignatureV4({
      credentials: fromNodeProviderChain(),
      region,
      service: "execute-api",
      sha256: Sha256,
    });
    const path = req.url.replace("/api/cloud", "/api/cases");
    if (
      ![
        "/api/cases",
        "/api/cases/provider",
        "/api/cases/evidence",
        "/api/cases/review",
      ].includes(path)
    )
      throw Error("Unknown route");
    let after;
    const cases = [];
    do {
      const signed = await signer.sign({
        method: req.method,
        protocol: "https:",
        hostname: url.hostname,
        path,
        query: after ? { after } : {},
        headers: { host: url.host, "content-type": "application/json" },
        body: body || undefined,
      });
      const reply = await fetch(
        url.origin +
          path +
          (after ? "?after=" + encodeURIComponent(after) : ""),
        {
          method: req.method,
          headers: signed.headers,
          body: body || undefined,
        },
      );
      if (!reply.ok || req.method !== "GET") {
        res.writeHead(reply.status);
        res.end(await reply.text());
        return;
      }
      cases.push(...(await reply.json()));
      after = reply.headers.get("x-next-case");
    } while (after);
    cases.sort((a, b) =>
      b.records[0].received.localeCompare(a.records[0].received),
    );
    res.end(JSON.stringify(cases));
  } catch {
    res.writeHead(503);
    res.end('{"error":"AWS feed unavailable"}');
  }
}
