import { readPage, jsonBody } from "../lib/reader.js";
import { guard } from "../lib/auth.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    const g = await guard(req);
    if (!g.ok) { res.status(g.status).json({ error: g.error }); return; }
    const result = await readPage(await jsonBody(req));
    res.status(result.error ? 502 : 200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "server error" });
  }
}
