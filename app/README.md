# Marginalia · 批注 — v1 app

Point your phone camera at any book page, and the app reads it, recognizes the
book, marks tricky words, and answers your taps live. Powered by **DeepSeek V4**
through its OpenAI-compatible API.

## Deploy on Vercel (what makes it a real URL for laptop + phone)

1. Push this repo to GitHub (done) and import it in Vercel.
2. In the Vercel project settings, set **Root Directory = `app`**.
   (The API routes live in `app/api/`, the client in `app/public/`, and
   `app/vercel.json` wires them together — no framework preset needed.)
3. Add **Environment Variables**:
   - `DEEPSEEK_API_KEY` = your key from https://platform.deepseek.com
   - *(optional)* `MARGINALIA_MODEL` = `deepseek-v4-pro` for the stronger model
     (default is `deepseek-v4-flash` — cheaper and faster).
   - *(optional, to test the deploy with no key first)* `MARGINALIA_MOCK` = `1`
     — returns canned answers so you can click through the whole flow, then
     remove it and add the real key.
4. Deploy. Open the URL on your **laptop** and on your **phone** (add it to your
   home screen for an app-like feel). Snap a page and go.

## Run locally

```bash
cd app
npm install

DEEPSEEK_API_KEY=sk-... npm start   # real answers
npm run mock                        # canned answers, no key needed
```

Then open `http://localhost:3000`. To reach it from your phone on the same
Wi-Fi, use `http://<your-computer-ip>:3000`.

## How it works

```
phone camera photo ──► Tesseract.js OCR ──► /api/read-page ──► DeepSeek V4 (text, JSON)
   (in the browser)      raw page text                         • cleans OCR into paragraphs
                                                               • recognizes book / author / chapter
                                                               • flags tricky words (朱批 radar)
                                                               • adds a per-book mini guide

tap a word         ──► /api/word      ──► one in-context sense, EN + 中文,
                                          trap warning (cached per sentence)

tap ¶              ──► /api/unpack    ──► plain English, 中文大意, the story
                                          underneath, why it matters, questions

tap ✧              ──► saved locally   ──► Moments (悟) — your enlightening
                                          sentences, kept beautifully
```

- Provider: DeepSeek V4 via the `openai` SDK pointed at `api.deepseek.com`.
  Switch models with `MARGINALIA_MODEL`; swap providers by changing
  `app/lib/reader.js` (it's the only file that talks to the model).
- On Vercel each `/api/*` route is a serverless function (`app/api/*.js`); both
  it and the local server share `app/lib/reader.js`, so they never drift.
- My Words and Moments persist in the browser (localStorage) — no account.

## Notes on DeepSeek

- **DeepSeek's API is text-only** — its V4 "vision" is web-chat only, not exposed
  through the API. So the page photo is OCR'd in the browser with Tesseract.js
  (loaded from a CDN), and only the recognized *text* is sent to DeepSeek. If you
  later switch to a vision-capable provider, `readPage` in `app/lib/reader.js` is
  the one place to send the image instead of the OCR text.
- OCR quality depends on the photo: flat page, good light, filling the frame.
  DeepSeek then cleans up OCR errors and joins wrapped lines into paragraphs.
- DeepSeek doesn't enforce a JSON schema, so the prompts describe the exact JSON
  shape and the client parses defensively (`extractJson` in `reader.js`).
- The page-snap is the expensive call (one vision request per page). Word taps
  are small and cached per sentence. `deepseek-v4-flash` is the low-cost default;
  use `-pro` if transcription/recognition accuracy needs a bump.
- Serverless functions are capped at `maxDuration: 60s` (`vercel.json`); if your
  Vercel plan caps lower and a page read times out, that's the knob to raise.
