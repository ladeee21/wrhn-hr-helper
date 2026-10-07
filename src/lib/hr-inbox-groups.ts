// Common inquiry types taken from the HR shared inbox (questions only; answers in the prototype are synthetic samples).
export type InboxGroup = { title: string; questions: string[] };

export const inboxGroups: InboxGroup[] = [
  {
    title: "Leave of absence",
    questions: [
      "How do I start a pregnancy or parental leave?",
      "Do my benefits continue while I am on a leave of absence?",
      "Do I have to keep contributing to my pension during a leave?",
      "How does the SUB top-up work?",
    ],
  },
  {
    title: "Employment letters",
    questions: [
      "I am a nurse and I need an employment letter.",
      "Can the letter include my salary and hours?",
      "Can HR customize the letter for immigration or a mortgage?",
    ],
  },
  {
    title: "Benefits and compensation",
    questions: [
      "How do I add my newborn to my benefits?",
      "When is my next step increase?",
      "If I transfer to this role, what would my rate be?",
      "How do I enrol in the pension plan?",
    ],
  },
];
