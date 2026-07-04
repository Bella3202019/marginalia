// Marginalia · 批注 — shared reading-companion logic.
// Talks to DeepSeek V4 through its OpenAI-compatible API. Used by BOTH the local
// dev server (../server.js) and the Vercel serverless functions (../api/*.js),
// so the two never drift.
//
// Env:
//   DEEPSEEK_API_KEY   required (unless MARGINALIA_MOCK=1)
//   MARGINALIA_MODEL   deepseek-v4-flash (default) | deepseek-v4-pro
//   MARGINALIA_MOCK=1  return canned answers with no key — verify a deploy first

import * as mock from "../mock-data.js";

const MOCK = process.env.MARGINALIA_MOCK === "1";
const MODEL = process.env.MARGINALIA_MODEL || "deepseek-v4-flash";
const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

let _client = null;
async function client() {
  if (!_client) {
    const { default: OpenAI } = await import("openai");
    _client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: BASE_URL });
  }
  return _client;
}

const SYSTEM = `You are the engine of Marginalia (批注), a reading companion for people
reading physical English books in their second language. The reader's native language is
Mandarin Chinese. House rules, always:
- ONE sense, not eight: when explaining a word, give only the meaning the author intended
  in this exact sentence.
- English first, 中文 to confirm: explanations lead in simple, clear English; a short
  Chinese gloss follows to confirm understanding, never to replace the English.
- Guided, never summarized: never replace the reading. Unpack what is asked, point at what
  to look for, and hand back a question. The reading stays the reader's.
- Warm, precise, unpatronizing. The reader is intelligent; their English is still growing.
- Always reply with a single valid JSON object and nothing else — no markdown, no prose
  around it.`;

/* ---- DeepSeek doesn't enforce a JSON schema, so we describe the shape in the
        prompt (json mode requires the word "json" to appear) and parse defensively. ---- */

function extractJson(text) {
  if (!text || !text.trim()) throw new Error("empty response from the model");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

async function ask(messages, max_tokens) {
  const c = await client();
  const r = await c.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens,
    response_format: { type: "json_object" },
  });
  return extractJson(r.choices?.[0]?.message?.content);
}

/* ---------------- public API ---------------- */

export async function readPage({ image_base64, media_type }) {
  if (MOCK) return mock.readPage();
  if (!image_base64) return { error: "no image" };
  try {
    return await ask([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text:
            'This is a photo of a page of a physical book. Return one JSON object with this shape:\n' +
            '{"recognized": boolean, "book_title": string|null, "author": string|null, "chapter": string|null, ' +
            '"paragraphs": string[], "tricky_words": string[], ' +
            '"guide": {"takeaways": string[], "carry_question": string} | null}\n\n' +
            'Transcribe the body text exactly as printed, split into paragraphs (a paragraph cut off at the ' +
            'page edge still counts). Identify book, author, and chapter if you recognize them from the text. ' +
            'tricky_words = lowercase words on this page likely to trick a native-Mandarin reader — especially ' +
            'common words used in an uncommon sense. If you recognized the book, fill guide with 2-3 takeaways ' +
            'for the whole book and one question to carry while reading; otherwise guide = null. ' +
            'If this is not a readable book page, set recognized=false and paragraphs=[].' },
          { type: "image_url", image_url: { url: `data:${media_type || "image/jpeg"};base64,${image_base64}` } },
        ],
      },
    ], 16000);
  } catch (err) { return { error: friendly(err) }; }
}

export async function wordSense({ word, sentence, book }) {
  if (MOCK) return mock.wordSense(word);
  if (!word || !sentence) return { error: "word and sentence required" };
  try {
    return await ask([
      { role: "system", content: SYSTEM },
      { role: "user", content:
        `Book: ${book || "unknown"}\nSentence: ${sentence}\n\n` +
        `Explain the word "${word}" as used in this exact sentence. Return one JSON object:\n` +
        '{"headword": string, "ipa": string|null, "pos": string, "sense_en": string, "zh": string, "trap": string|null}\n' +
        'sense_en = the single meaning it has in THIS sentence, in simple English. zh = short Chinese gloss of that ' +
        'same sense. trap = if the reader likely knows a different, more common sense of this word, warn them ' +
        '(mention the familiar sense in Chinese); otherwise null.' },
    ], 1024);
  } catch (err) { return { error: friendly(err) }; }
}

export async function unpack({ paragraph, book, chapter }) {
  if (MOCK) return mock.unpack();
  if (!paragraph) return { error: "paragraph required" };
  try {
    return await ask([
      { role: "system", content: SYSTEM },
      { role: "user", content:
        `Book: ${book || "unknown"} ${chapter ? `(${chapter})` : ""}\n\nUnpack this paragraph. Return one JSON object:\n` +
        '{"plain": string, "zh": string, "story": string, "matters": string, "questions": string[]}\n' +
        'plain = the paragraph restated in plain simple English. zh = 中文大意. story = the story underneath: who is ' +
        'arguing with whom, the historical/philosophical context, what was at stake. matters = why it still matters ' +
        'today. questions = 2 questions to carry back to the page.\n\nParagraph:\n' + paragraph },
    ], 4096);
  } catch (err) { return { error: friendly(err) }; }
}

function friendly(err) {
  var msg = (err && err.message) || String(err);
  if (/api key|apikey|401|unauthorized/i.test(msg)) return "The reading companion isn't configured — set DEEPSEEK_API_KEY.";
  return "The reading companion had trouble: " + msg;
}

/* ---------------- serverless helper: read + parse a JSON body ---------------- */

export async function jsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;      // Vercel pre-parses
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size <= 12 * 1024 * 1024) chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}
