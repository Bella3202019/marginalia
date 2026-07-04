# Marginalia · 批注 — v1 app

The real thing: point your phone camera at any book page, and Claude reads it,
recognizes the book, marks tricky words, and answers your taps live.

## Run it

```bash
cd app
npm install

# With real answers (needs an Anthropic API key — https://platform.claude.com):
ANTHROPIC_API_KEY=sk-ant-... npm start

# Or demo mode with canned answers (no key needed):
npm run mock
```

Then open `http://localhost:3000`.

**To use it on your phone** (same Wi-Fi network): find your computer's local IP
(`ipconfig getifaddr en0` on macOS) and open `http://<that-ip>:3000` on the
phone. Add it to your home screen for an app-like feel.

## How it works

```
phone camera photo ──► POST /api/read-page ──► Claude (vision + structured output)
                                               • transcribes the page into paragraphs
                                               • recognizes book / author / chapter
                                               • flags tricky words (朱批 radar)
                                               • adds a per-book mini guide

tap a word         ──► POST /api/word      ──► one in-context sense, EN + 中文,
                                               trap warning (cached per sentence)

tap ¶              ──► POST /api/unpack    ──► plain English, 中文大意, the story
                                               underneath, why it matters, questions

tap ✧              ──► saved locally        ──► Moments (悟) — your enlightening
                                               sentences, kept beautifully
```

- Model: `claude-opus-4-8`, adaptive thinking, structured outputs, prompt caching
  on the shared system prompt.
- My Words and Moments persist in the browser (localStorage) — no account needed.
- The server is a single zero-framework Node file (`server.js`); the client is a
  single HTML file (`public/index.html`).

## Costs

The page snap is the expensive call (one vision request per page). Word taps are
small, cached requests. Casual daily reading lands comfortably in the
dollars-per-month range; check the console at platform.claude.com for actuals.
