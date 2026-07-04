# Marginalia · 批注

*A reading companion for physical books — built for a bilingual reader of serious books.*

**Live prototype:** open `prototype/marginalia.html` in a browser (best on a phone).

---

## The idea in one paragraph

You are reading a paper book — Mill, Foucault, Wittgenstein — in your second
language. Twice per page, the book leaves you alone: a word stops making sense,
or a whole paragraph clearly *means more* than it says and you can't reach it.
Marginalia is the phone lying next to the book. Snap the page, tap what
confuses you: a word gets **the one meaning the author intended in that
sentence** (plain English first, 中文 to confirm), a paragraph gets **the story
underneath it** — a plain restatement, the 中文大意, the historical/philosophical
context, and a question to carry back into the page. Then it gets out of your
way. The book stays in your hands; the phone stays in the margin.

## The two pain points (in the founder's own words)

1. *"Sometimes I don't understand the English word, and I really want to know
   what it means and what they are talking about actually."*
2. *"I want something that can guide me to read the book — what I can get from
   this book, what are the underlying stories of this paragraph. Help my
   reading be more interactive in the parts that I want."*

## Product principles

- **The paper book is the product's hero, not its competitor.** Marginalia
  never replaces reading with summaries. It answers only what you ask, then
  returns you to the page — ideally with a question in hand.
- **One sense, not eight.** Dictionary apps dump every meaning of a word.
  Because Marginalia can see the sentence, it gives the single in-context
  sense. ("Warrant" in Mill is a justification, not a police warrant;
  "visiting him with any evil" is not 拜访.)
- **中文 is a bridge, not a crutch.** Explanations lead in simple English —
  that is the practice the reader wants. 中文 appears one line below, to
  confirm understanding, never to replace the English.
- **Interactive only where the reader wants it.** No forced flows, no streaks,
  no gamification. Three gestures: snap 拍, tap 点, unpack 解.
- **It should feel like an object of the reading world.** The visual identity
  borrows 朱批 — the cinnabar red-ink margin annotations of Chinese
  scholarship — because that is literally what the product is: red ink in the
  margins of your English books.

## Core experience

### 1. Snap the page (拍)
Point the camera at the open book. OCR reads the page; the model also
identifies **which book and chapter** you are in (most pages of well-known
books are identifiable from a paragraph of text). Every later answer knows its
context. Fallbacks: paste text, dictate a sentence.

### 2. Tap a word (点)
A bottom sheet gives: headword, IPA, part of speech, **one in-context sense**
in plain English, the 中文 gloss, the original sentence with the word
highlighted, and — when relevant — a ⚠ trap note for familiar words wearing
unfamiliar meanings. One tap saves the word (with its sentence) to **My
Words**.

**Tricky-word radar (朱批):** the app pre-underlines, in dotted cinnabar,
words statistically likely to trick a non-native reader — usually common words
in uncommon senses ("will" as a noun, "exercised" of power, "visiting" as
inflicting). This is the feature a plain dictionary can never offer.

### 3. Unpack a paragraph (解)
A ¶ mark sits beside each paragraph. Tapping it opens: **In plain English**
(restatement) → **中文大意** → **The story underneath** (who is arguing with
whom; what was at stake when it was written) → **Why it still matters** →
**Carry back to the page** (2 guiding questions). Depth on demand, never by
default.

### Supporting surfaces
- **Guide** — per-book: "three things to take from this book," a chapter map
  with *you are here*, and one question to carry while reading.
- **My Words** — every saved word with its in-book meaning and source;
  spaced-repetition review in v2, always quizzed with the sentence it came from.

## Roadmap

| Stage | What ships | Notes |
|-------|-----------|-------|
| **v0 — now** | Interactive prototype (`prototype/marginalia.html`) | Full loop simulated on one passage of *On Liberty* Ch. I (public domain). All answers pre-written. |
| **v1 — MVP** | Phone-first web app (PWA), then iOS | Camera → vision model reads the page + identifies book → live in-context answers via Claude API. One reader, any book. |
| **v2 — habit** | My Words review + book guides | Spaced repetition with source sentences; guide library for the reader's shelf (Mill, Foucault, Wittgenstein…); reading history. |

## v1 technical sketch

```
photo ──► Claude (vision): OCR + layout + "which book/chapter is this?"
                │                        (cache book identity per session)
                ▼
        interactive page text
                │ tap word
                ▼
        Claude: one in-context sense, zh gloss, trap check   (small, fast prompt)
                │ tap ¶
                ▼
        Claude: unpack prompt (restatement / 大意 / context / questions)
                │
                ▼
        My Words store (word + sense + source sentence) ──► v2 review
```

- **Client:** mobile-first web app (camera via `getUserMedia` / file input),
  no account needed for v1; local storage for My Words.
- **Server:** thin API proxy holding the Anthropic key; prompt templates for
  the three call types (page read, word sense, paragraph unpack).
- **Cost control:** page OCR is the expensive call and happens once per page;
  word taps are short cached prompts keyed on (book, sentence, word).

## Open questions

- Photo per page vs. photo per spread? (Spread = fewer snaps, harder OCR.)
- Should the tricky-word radar be on by default, or a toggle? (It marks the
  page — some readers may want the page untouched until they ask.)
- Copyright: the app processes photos the reader takes of a book they own,
  and shows only its own explanations plus short quoted context — same posture
  as dictionary/translate camera apps, but worth a proper review before launch.
- English-level calibration: should explanations adapt (CEFR-ish) to the
  reader's level over time, based on which words they tap?
