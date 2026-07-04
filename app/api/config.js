import { publicConfig } from "../lib/auth.js";

export default function handler(req, res) {
  res.status(200).json(publicConfig());
}
