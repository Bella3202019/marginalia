// Marginalia · 批注 — v1 server
// A thin proxy between the phone client and the Claude API.
// Run:  ANTHROPIC_API_KEY=sk-... npm start        (real answers)
//       npm run mock                              (canned answers, no key needed)

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 3000;
const MOCK = process.env.MARGINALIA_MOCK === "1";
const MODEL = "claude-opus-4-8";
const ROOT = fileURLToPath(new URL("./public/", import.meta.url));

let client = null;
async function anthropic() {
  if (!client) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    client = new Anthropic(); // resolves ANTHROPIC_API_KEY / auth profile from env
  }
  return client;
}

/* ---------------- prompts (stable — cached across requests) ---------------- */

const HOUSE_STYLE = `You are the engine of Marginalia (批注), a reading companion for people
reading physical English books in their second language. The reader's native language is
Mandarin Chinese. House rules, always:
- ONE sense, not eight: when explaining a word, give only the meaning the author intended
  in this exact sentence.
- English first, 中文 to confirm: explanations lead in simple, clear English; a short
  Chinese gloss follows to confirm understanding, never to replace the English.
- Guided, never summarized: never replace the reading. Unpack what is asked, point at what
  to look for, and hand back a question. The reading stays the reader's.
- Warm, precise, unpatronizing. The reader is intelligent; their English is still growing.`;

const READ_PAGE_SCHEMA = {
  type: "object",
  properties: {
    recognized: { type: "boolean" },
    book_title: { type: ["string", "null"] },
    author: { type: ["string", "null"] },
    chapter: { type: ["string", "null"] },
    paragraphs: { type: "array", items: { type: "string" } },
    tricky_words: {
      type: "array",
      items: { type: "string" },
      description: "lowercase words on this page likely to trick a native-Mandarin reader — especially common words used in uncommon senses"
    },
    guide: {
      type: ["object", "null"],
      properties: {
        takeaways: { type: "array", items: { type: "string" } },
        carry_question: { type: "string" }
      },
      required: ["takeaways", "carry_question"],
      additionalProperties: false
    }
  },
  required: ["recognized", "book_title", "author", "chapter", "paragraphs", "tricky_words", "guide"],
  additionalProperties: false
};

const WORD_SCHEMA = {
  type: "object",
  properties: {
    headword: { type: "string" },
    ipa: { type: ["string", "null"] },
    pos: { type: "string" },
    sense_en: { type: "string", description: "the single meaning this word has in this sentence, in simple English" },
    zh: { type: "string", description: "short Chinese gloss of that same sense" },
    trap: { type: ["string", "null"], description: "if the reader likely knows a DIFFERENT sense of this word, warn them here (mention the familiar sense in Chinese); else null" }
  },
  required: ["headword", "ipa", "pos", "sense_en", "zh", "trap"],
  additionalProperties: false
};

const UNPACK_SCHEMA = {
  type: "object",
  properties: {
    plain: { type: "string", description: "the paragraph restated in plain, simple English" },
    zh: { type: "string", description: "中文大意 — the gist in Chinese" },
    story: { type: "string", description: "the story underneath: who is arguing with whom, the historical/philosophical context, what was at stake" },
    matters: { type: "string", description: "why this still matters today" },
    questions: { type: "array", items: { type: "string" }, description: "2 questions to carry back to the page" }
  },
  required: ["plain", "zh", "story", "matters", "questions"],
  additionalProperties: false
};

/* ---------------- API handlers ---------------- */

async function readPage({ image_base64, media_type }) {
  if (MOCK) return (await mock()).readPage();
  const c = await anthropic();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: HOUSE_STYLE, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: READ_PAGE_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image_base64 } },
        {
          type: "text",
          text: "This is a photo of a page of a physical book. Transcribe the body text exactly as printed, split into paragraphs (a paragraph cut off at the page edge still counts). Identify the book, author, and chapter if you can recognize them from the text. List the tricky words. If you recognized the book, add a short guide: 2-3 takeaways for the whole book and one question to carry while reading. If the photo is not a readable book page, set recognized=false and return empty paragraphs."
        }
      ]
    }]
  });
  return parseStructured(response);
}

async function wordSense({ word, sentence, book }) {
  if (MOCK) return (await mock()).wordSense(word);
  const c = await anthropic();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: WORD_SCHEMA } },
    system: [{ type: "text", text: HOUSE_STYLE, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `Book: ${book || "unknown"}\nSentence: ${sentence}\n\nExplain the word "${word}" as used in this exact sentence.`
    }]
  });
  return parseStructured(response);
}

async function unpack({ paragraph, book, chapter }) {
  if (MOCK) return (await mock()).unpack();
  const c = await anthropic();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: UNPACK_SCHEMA } },
    system: [{ type: "text", text: HOUSE_STYLE, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: `Book: ${book || "unknown"} ${chapter ? `(${chapter})` : ""}\n\nUnpack this paragraph for me:\n\n${paragraph}`
    }]
  });
  return parseStructured(response);
}

function parseStructured(response) {
  if (response.stop_reason === "refusal") {
    return { error: "The model declined this request." };
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return { error: "Empty response from the model." };
  return JSON.parse(text);
}

async function mock() {
  const m = await import("./mock-data.js");
  return m;
}

/* ---------------- tiny cache for word lookups ---------------- */

const wordCache = new Map();
async function cachedWordSense(body) {
  const key = `${body.book}|${body.word}|${body.sentence}`.toLowerCase();
  if (wordCache.has(key)) return wordCache.get(key);
  const result = await wordSense(body);
  if (!result.error) wordCache.set(key, result);
  return result;
}

/* ---------------- HTTP plumbing ---------------- */

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

const ROUTES = {
  "/api/read-page": readPage,
  "/api/word": cachedWordSense,
  "/api/unpack": unpack,
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && ROUTES[req.url]) {
      const body = await readBody(req);
      const result = await ROUTES[req.url](body);
      res.writeHead(result.error ? 502 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    // static files
    let path = req.url.split("?")[0];
    if (path === "/") path = "/index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    if (err.code === "ENOENT") { res.writeHead(404); res.end("not found"); return; }
    console.error(err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: err.message || "server error" }));
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

server.listen(PORT, () => {
  console.log(`Marginalia ${MOCK ? "(mock mode) " : ""}listening on http://localhost:${PORT}`);
  if (!MOCK && !process.env.ANTHROPIC_API_KEY) {
    console.log("note: ANTHROPIC_API_KEY is not set — the SDK will try other credential sources (ant auth profile).");
  }
});
