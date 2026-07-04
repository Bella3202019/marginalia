// Canned responses for MARGINALIA_MOCK=1 — lets the client be developed and
// demoed end-to-end without an API key. Passage: Mill, On Liberty (1859), public domain.

export function readPage() {
  return {
    recognized: true,
    book_title: "On Liberty",
    author: "John Stuart Mill",
    chapter: "Chapter I — Introductory",
    paragraphs: [
      "That the only purpose for which power can be rightfully exercised over any member of a civilised community, against his will, is to prevent harm to others. His own good, either physical or moral, is not a sufficient warrant.",
      "He cannot rightfully be compelled to do or forbear because it will be better for him to do so, because it will make him happier, because, in the opinions of others, to do so would be wise, or even right. These are good reasons for remonstrating with him, or reasoning with him, or persuading him, or entreating him, but not for compelling him, or visiting him with any evil in case he do otherwise.",
    ],
    tricky_words: ["will", "warrant", "exercised", "good", "compelling", "visiting"],
    guide: {
      takeaways: [
        "The harm principle — the one-sentence rule for when society may interfere with a person.",
        "The strongest defense of free speech ever written (Ch. II) — including why wrong opinions must be heard.",
        "Individuality as a good in itself (Ch. III) — why society needs 'experiments of living'.",
      ],
      carry_question:
        "Is Mill worried about government power — or the quieter pressure of other people's opinions? He fears the second one more.",
    },
  };
}

const WORDS = {
  warrant: {
    headword: "warrant", ipa: "/ˈwɔːrənt/", pos: "noun",
    sense_en: "A justification; a good enough reason. “Not a sufficient warrant” = not reason enough.",
    zh: "正当理由；依据",
    trap: "Not 逮捕令 (a police warrant)! In philosophy, a warrant is a justification — “not a sufficient warrant” = 不足以构成正当理由。",
  },
  visiting: {
    headword: "visiting", ipa: "/ˈvɪzɪtɪŋ/", pos: "verb",
    sense_en: "Inflicting; imposing something bad on someone. “Visiting him with any evil” = punishing him.",
    zh: "施加（惩罚）",
    trap: "Not 拜访! Old usage: “visit X with evil” = 对X施加惩罚。",
  },
};

export function wordSense(word) {
  const key = String(word || "").toLowerCase();
  return WORDS[key] || {
    headword: key, ipa: null, pos: "—",
    sense_en: `(mock mode) In the real app, Claude explains “${key}” in its exact sentence.`,
    zh: "（演示模式）", trap: null,
  };
}

export function unpack() {
  return {
    plain: "Society may force a person to do something for exactly one reason: to stop them from harming other people. “It's for your own good” is never a good enough reason.",
    zh: "社会唯一可以正当地强制一个人的理由，是防止他伤害别人。“为你好”永远不足以成为强制你的理由。",
    story: "This is the famous harm principle (伤害原则), the heart of On Liberty (1859). Mill was pushing back against government censorship — and against something subtler he feared more: the “tyranny of the majority,” society pressuring everyone to live the same way.",
    matters: "This sentence still frames modern debates: seatbelt laws, drug policy, vaccine mandates, speech rules online.",
    questions: [
      "Think of one law you know that exists purely to protect people from themselves. Does Mill convince you it's wrong?",
      "Who counts as “others”? If a choice hurts your family's feelings, is that “harm to others”?",
    ],
  };
}
