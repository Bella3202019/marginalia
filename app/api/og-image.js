import { OG_IMAGE_PNG } from "../lib/og-image.js";

export default function handler(req, res) {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.status(200).send(OG_IMAGE_PNG);
}
