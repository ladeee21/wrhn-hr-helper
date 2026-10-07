// Step-based conversation flows for the three HR inbox inquiry types. Pure: no React, no network.
import { buildLetter, daysBetween, longDate, money, nextAnniversary, noticeDueBy, parseISO, payBands, transferPlacement, type LetterData } from "./hr-flow-calc";

export type FlowId = "leave" | "letter" | "benefits";
export type Value = string | string[];
type K = "topic" | "kind" | "status" | "start" | "include" | "purpose" | "purposeOther" | "name" | "id" | "title" | "rate" | "hours" | "contractEnd" | "noc" | "addressee" | "recipient" | "event" | "eventDate" | "anniv" | "band";
export type Values = { [k: string]: Value | undefined } & { [P in K]?: Value };
export type Option = { label: string; keywords: string[] };
export type StepType = "choice" | "text" | "date" | "number" | "multi";
export type Step = {
  key: string;
  type: StepType;
  question: string;
  label: string;
  options?: (v: Values) => Option[];
  help?: string;
  placeholder?: string;
  optional?: boolean;
  /** Values typed here never appear in the thread; they stay in the browser only. */
  private?: boolean;
  prefill?: (v: Values, original: string) => Value | undefined;
  when?: (v: Values) => boolean;
};
export type FlowState = { flowId: FlowId; values: Values; original: string; confirmed: boolean; defaults: Values };
export type FormId = "loa" | "benefits" | "pension";
export type Section = { clauseId: string; label?: string | undefined };
export type RelatedAction = { label: string; ask?: string; state?: FlowState };
export type FlowAnswer = {
  sections: Section[];
  computed?: string[];
  cautions?: string[];
  table?: { caption: string; head: string[]; rows: string[][] };
  forms?: FormId[];
  related?: RelatedAction[];
  letter?: LetterData;
  draft?: string;
};
export type Routed = { team: string; reason: string; instruction: string };
export type ConfirmRow = { label: string; value: string; note?: string };
export type Outcome =
  | { type: "step"; step: Step; defaultValue: Value | undefined }
  | { type: "confirm"; rows: ConfirmRow[]; cautions: string[] }
  | { type: "routed"; routed: Routed }
  | { type: "result"; answer: FlowAnswer };
type Flow = {
  steps: Step[];
  intro?: Section[];
  route?: (v: Values) => Routed | undefined;
  extraRows?: (v: Values, today: string) => ConfirmRow[];
  cautions?: (v: Values) => string[];
  result: (v: Values, today: string, state: FlowState) => FlowAnswer;
};

export const formTitles: Record<FormId, string> = {
  loa: "Leave of absence request form",
  benefits: "Benefits change form",
  pension: "Pension enrolment form",
};

const opt = (label: string, ...keywords: string[]): Option => ({ label, keywords });
const opts = (...o: Option[]) => () => o;
const str = (v: Value | undefined) => (Array.isArray(v) ? v.join(", ") : (v ?? ""));
const has = (t: string, ...k: string[]) => k.some((x) => t.includes(x));
const statusStep = (question = "What is the employee's employment status?"): Step => ({
  key: "status", type: "choice", question, label: "Employment status",
  options: opts(opt("Full-time", "full"), opt("Part-time", "part"), opt("Casual", "casual")),
});
export const statusFromText = (t: string) =>
  has(t, "full-time", "full time") ? "Full-time" : has(t, "part-time", "part time") ? "Part-time" : has(t, "casual") ? "Casual" : undefined;

// ---------- Flow A: leave of absence ----------
const LOA_TOPICS = ["Starting a pregnancy or parental leave", "Benefits during a leave", "Pension during a leave", "EI and the SUB top-up"] as const;
const leaveDraft = (ids: string[]) => `Hello [employee name],\n\nI checked the Leaves of Absence Guideline, ${ids.join(", ")}.\n\n[your answer for this employee's situation]\n\nPlease let me know if any of the facts above are not correct.`;
const leaveFlow: Flow = {
  steps: [
    { key: "topic", type: "choice", question: "What is the employee asking about?", label: "Topic", options: opts(opt(LOA_TOPICS[0], "start", "pregnan", "parental", "notice"), opt(LOA_TOPICS[1], "benefit", "premium"), opt(LOA_TOPICS[2], "pension", "hoopp"), opt(LOA_TOPICS[3], "ei", "sub", "top-up", "roe")) },
    { key: "kind", type: "choice", question: "What kind of leave is it?", label: "Leave type", options: opts(opt("Pregnancy or parental", "pregnan", "parental", "maternity", "paternity"), opt("Medical", "medical", "sick"), opt("Personal (unpaid)", "personal", "unpaid")) },
    statusStep(),
    { key: "start", type: "date", question: "What is the planned first day of leave?", label: "Planned start date" },
  ],
  route: (v) => v.kind === "Medical" ? { team: "Health and Wellness", reason: "Medical leave needs a person's judgment and confidentiality.", instruction: "Medical leave needs a person's judgment and confidentiality. Pass the question to Health and Wellness (or Disability Support for sick pay) and do not reply with policy wording." } : undefined,
  extraRows: (v) => (typeof v.start === "string" && parseISO(v.start) ? [{ label: "Notice due by", value: noticeDueBy(v.start), note: "Based on clause LOA-1.1" }] : []),
  result: (v, today, state) => {
    const topic = str(v.topic), kind = str(v.kind), status = str(v.status), start = str(v.start);
    const keep = { kind, status, start };
    const related: RelatedAction[] = LOA_TOPICS.filter((x) => x !== topic).map((x) => ({ label: x, state: { ...state, values: { ...keep, topic: x }, confirmed: false, defaults: {} } }));
    let a: FlowAnswer;
    if (topic === LOA_TOPICS[0]) {
      const due = noticeDueBy(start);
      a = {
        sections: [{ clauseId: "LOA-1.1", label: "When to tell the manager" }, { clauseId: "LOA-1.2", label: "Forms and documents" }, { clauseId: "LOA-1.3", label: "How long the leave can be" }],
        computed: [`Notice due by ${due}. Today is ${today}. ${today <= due ? "Notice is on time." : "The notice period has already passed, so check with People Operations."}`],
        forms: ["loa"],
      };
    } else if (topic === LOA_TOPICS[1]) {
      a = { sections: [{ clauseId: "LOA-2.1", label: "Do benefits continue?" }, { clauseId: "LOA-2.2", label: "How premiums are paid" }, { clauseId: "LOA-2.3", label: "Can the employee opt out?" }] };
    } else if (topic === LOA_TOPICS[2]) {
      a = { sections: [{ clauseId: "LOA-3.1", label: "Do contributions continue?" }, { clauseId: "LOA-3.2", label: "Can contributions stop?" }, { clauseId: "LOA-3.3", label: "What happens to service?" }] };
    } else {
      const ei = { clauseId: "LOA-4.1", label: "When to apply for EI and when the ROE is issued" };
      const statements = { clauseId: "LOA-4.3", label: "Where to send EI statements" };
      if (kind === "Personal (unpaid)") a = { sections: [{ clauseId: "LOA-0.2", label: "Eligibility" }, ei, statements] };
      else if (status === "Casual") a = { sections: [{ clauseId: "LOA-0.1", label: "Eligibility" }, ei, statements, { clauseId: "LOA-4.4", label: "Extended parental EI" }], cautions: ["Casual employees are not eligible for the SUB top-up."] };
      else a = { sections: [ei, { clauseId: "LOA-4.2", label: "How the SUB top-up works" }, statements, { clauseId: "LOA-4.4", label: "Extended parental EI" }] };
    }
    return { ...a, related, draft: leaveDraft(a.sections.map((s) => s.clauseId)) };
  },
};

// ---------- Flow B: employment letter ----------
const titleFromText = (t: string) =>
  has(t, "registered practical nurse") ? "Registered Practical Nurse" : has(t, "personal support worker") ? "Personal Support Worker" : has(t, "nurse") ? "Registered Nurse" : undefined;
const nocFor = (title: string) => ({ "Registered Nurse": "31301", "Registered Practical Nurse": "32101", "Personal Support Worker": "33102" } as Record<string, string>)[title] ?? "";
const includes = (v: Values, x: string) => Array.isArray(v.include) && v.include.includes(x);
export const letterClauses = (v: Values) => {
  const ids = ["EL-1.2"];
  if (includes(v, "Salary") || includes(v, "Hours of work")) ids.push("EL-2.1");
  if (includes(v, "Contract dates") && v.status === "Fixed-term contract") ids.push("EL-2.2");
  if (includes(v, "NOC code") && v.purpose === "Immigration") ids.push("EL-2.3");
  ids.push("EL-3.1");
  return ids;
};
export function letterData(v: Values): LetterData {
  const inc = (Array.isArray(v.include) ? v.include : []).filter((x) => (x === "Contract dates" ? v.status === "Fixed-term contract" : x === "NOC code" ? v.purpose === "Immigration" : true));
  return {
    name: str(v.name).trim(), id: str(v.id).trim() || undefined, title: str(v.title).trim(), status: str(v.status), start: str(v.start),
    purpose: str(v.purpose), purposeOther: str(v.purposeOther) || undefined, include: inc,
    rate: str(v.rate) || undefined, hours: str(v.hours) || undefined, contractEnd: str(v.contractEnd) || undefined, noc: str(v.noc) || undefined,
    addressee: str(v.addressee) || "To whom it may concern", recipient: str(v.recipient) || undefined,
  };
}
export const NAME_NOTE = "Used only to fill the letter in your browser. It is not stored or sent anywhere.";
const letterFlow: Flow = {
  intro: [{ clauseId: "EL-1.1" }, { clauseId: "EL-5.1" }],
  steps: [
    { key: "name", type: "text", question: "Who is the letter for? Enter the employee's full name.", label: "Employee name", help: NAME_NOTE, private: true },
    { key: "id", type: "text", question: "What is the employee's ID?", label: "Employee ID", placeholder: "For example E0123", optional: true, private: true, help: NAME_NOTE },
    { key: "title", type: "text", question: "What is the employee's job title?", label: "Job title", prefill: (_v, o) => titleFromText(o.toLowerCase()) },
    { key: "status", type: "choice", question: "What is the employment status?", label: "Employment status", options: opts(opt("Full-time", "full"), opt("Part-time", "part"), opt("Casual", "casual"), opt("Fixed-term contract", "fixed", "contract", "term")) },
    { key: "start", type: "date", question: "What was the employee's start date?", label: "Start date" },
    { key: "purpose", type: "choice", question: "What is the letter for?", label: "Purpose", options: opts(opt("Mortgage", "mortgage"), opt("Immigration", "immigra", "visa", "permanent residen"), opt("Rental or lease", "rent", "lease", "landlord"), opt("Loan or credit", "loan", "credit"), opt("Other", "other")) },
    { key: "purposeOther", type: "text", question: "Describe the purpose", label: "Purpose details", optional: true, when: (v) => v.purpose === "Other" },
    {
      key: "include", type: "multi", label: "Extra content",
      question: "What should the letter include? The standard letter always has job title, status and start date.",
      options: (v) => [opt("Salary", "salary", "pay", "rate"), opt("Hours of work", "hour"), ...(v.status === "Fixed-term contract" ? [opt("Contract dates", "contract", "dates")] : []), ...(v.purpose === "Immigration" ? [opt("NOC code", "noc")] : [])],
      prefill: (v) => (v.purpose === "Immigration" ? ["NOC code"] : []),
    },
    { key: "rate", type: "text", question: "Rate of pay", label: "Rate of pay", prefill: () => "$52.00 per hour (synthetic sample)", when: (v) => includes(v, "Salary") },
    { key: "hours", type: "text", question: "Hours of work", label: "Hours of work", prefill: () => "37.5 hours per week", when: (v) => includes(v, "Hours of work") },
    { key: "contractEnd", type: "date", question: "Contract end date", label: "Contract end date", when: (v) => includes(v, "Contract dates") && v.status === "Fixed-term contract" },
    { key: "noc", type: "text", question: "NOC code", label: "NOC code", help: "Sample value. Confirm with HR before issuing.", prefill: (v) => nocFor(str(v.title)), when: (v) => includes(v, "NOC code") && v.purpose === "Immigration" },
    { key: "addressee", type: "choice", question: "Who is the letter addressed to?", label: "Addressed to", options: opts(opt("To whom it may concern", "whom", "concern", "general"), opt("A named recipient", "named", "recipient")) },
    { key: "recipient", type: "text", question: "Recipient name or organization", label: "Recipient", when: (v) => v.addressee === "A named recipient" },
  ],
  extraRows: (v) => [{ label: "Clauses applied", value: letterClauses(v).join(", ") }],
  cautions: (v) => (v.status === "Casual" ? ["Check with People Operations: the procedure covers current employees."] : []),
  result: (v) => ({
    sections: letterClauses(v).map((clauseId) => ({ clauseId })),
    letter: letterData(v),
    draft: "Hello [employee name],\n\nPlease find your employment letter attached. It confirms your job title, employment status and start date, along with the details you asked us to include.\n\nPlease review it and let me know if anything needs to be corrected.\n\nThank you,\n[your name]\nPeople Operations",
  }),
};

// ---------- Flow C: benefits and compensation ----------
const BC_TOPICS = ["Adding or changing a dependant", "Next step increase", "Rate if the employee transfers", "Pension enrolment"] as const;
const casualCaution = "Casual employees are not eligible. Check with People Operations before replying.";
const bcRelated = (topic: string): RelatedAction[] =>
  ([["How do I add my newborn to my benefits?", BC_TOPICS[0]], ["When is my next step increase?", BC_TOPICS[1]], ["If I transfer to this role, what would my rate be?", BC_TOPICS[2]], ["How do I enrol in the pension plan?", BC_TOPICS[3]]] as const)
    .filter(([, t]) => t !== topic).map(([q]) => ({ label: q, ask: q }));
const bcDraft = (ids: string[]) => `Hello [employee name],\n\nI checked the Benefits and Compensation Guide, ${ids.join(", ")}.\n\n[your answer for this employee's situation]\n\nPlease let me know if any of the facts above are not correct.`;
const isTopic = (t: string) => (v: Values) => v.topic === t;
const benefitsFlow: Flow = {
  steps: [
    { key: "topic", type: "choice", question: "What is the employee asking about?", label: "Topic", options: opts(opt(BC_TOPICS[0], "dependant", "dependent", "newborn", "spouse", "baby"), opt(BC_TOPICS[1], "step"), opt(BC_TOPICS[2], "transfer", "rate"), opt(BC_TOPICS[3], "pension", "enrol")) },
    { key: "event", type: "choice", question: "What was the life event?", label: "Life event", when: isTopic(BC_TOPICS[0]), options: opts(opt("Birth or adoption", "birth", "adopt", "newborn", "baby"), opt("Marriage or partner", "marri", "partner", "spouse"), opt("Other", "other")) },
    { key: "eventDate", type: "date", question: "When did the life event happen?", label: "Date of life event", when: isTopic(BC_TOPICS[0]) },
    { key: "anniv", type: "date", question: "What is the employee's anniversary date (the date they started)?", label: "Anniversary date", when: isTopic(BC_TOPICS[1]) },
    { key: "rate", type: "number", question: "What is the employee's current hourly rate?", label: "Current hourly rate", placeholder: "For example 46.00", when: isTopic(BC_TOPICS[2]) },
    { key: "band", type: "choice", question: "Which pay band is the new role in?", label: "New pay band", when: isTopic(BC_TOPICS[2]), options: opts(opt("Band 3", "3"), opt("Band 4", "4"), opt("Band 5", "5")) },
    { ...statusStep(), when: (v) => v.topic !== BC_TOPICS[2] },
  ],
  extraRows: (v, today) => {
    if (v.topic === BC_TOPICS[0] && typeof v.eventDate === "string" && parseISO(v.eventDate)) {
      const n = daysBetween(v.eventDate, today);
      return [{ label: "Days since the life event", value: String(n) }, { label: "Window", value: n <= 31 ? "within 31 days" : "after 31 days" }];
    }
    if (v.topic === BC_TOPICS[1] && typeof v.anniv === "string" && parseISO(v.anniv)) return [{ label: "Next anniversary", value: nextAnniversary(v.anniv, today) }];
    return [];
  },
  cautions: (v) => (v.status === "Casual" ? [casualCaution] : []),
  result: (v, today) => {
    const topic = str(v.topic), casual = v.status === "Casual";
    const elig: Section[] = casual ? [{ clauseId: "BC-0.1", label: "Eligibility" }] : [];
    const cautions = casual ? [casualCaution] : [];
    let a: FlowAnswer;
    if (topic === BC_TOPICS[0]) {
      const n = daysBetween(str(v.eventDate), today);
      a = { sections: [...elig, { clauseId: "BC-1.1", label: "Which form" }, { clauseId: "BC-1.2", label: "Documents needed" }, { clauseId: "BC-1.3", label: "How long after a life event" }], computed: [`The life event was ${n} days ago, so ${n <= 31 ? "the standard route applies" : "the insurer's underwriting route applies"}.`], cautions, forms: ["benefits"] };
    } else if (topic === BC_TOPICS[1]) {
      a = { sections: [...elig, { clauseId: "BC-2.1", label: "When the step increase happens" }], computed: [`Next step increase takes effect on ${longDate(nextAnniversary(str(v.anniv), today))}.`], cautions };
    } else if (topic === BC_TOPICS[2]) {
      const band = str(v.band), p = transferPlacement(Number(v.rate), band);
      a = {
        sections: [{ clauseId: "BC-2.2", label: "How the new rate is set" }],
        table: { caption: "Pay band table (synthetic sample)", head: ["Band", "Step 1", "Step 2", "Step 3", "Step 4"], rows: Object.entries(payBands).map(([b, s]) => [b, ...s.map(money)]) },
        computed: [`Placed at Step ${p.step} of ${band}: ${money(p.rate)} per hour.`],
        cautions: p.aboveTop ? ["The current rate is above the top step, so check with Total Rewards."] : [],
      };
    } else {
      const s31 = { clauseId: "BC-3.1", label: "How to enrol" }, s32 = { clauseId: "BC-3.2", label: "Who is eligible" };
      a = { sections: [...elig, ...(casual ? [s32, s31] : [s31, s32])], cautions: casual ? ["Casual employees are not eligible for the pension plan. Check with People Operations before replying."] : [], forms: ["pension"] };
    }
    return { ...a, related: bcRelated(topic), draft: bcDraft(a.sections.map((s) => s.clauseId)) };
  },
};

export const flows: Record<FlowId, Flow> = { leave: leaveFlow, letter: letterFlow, benefits: benefitsFlow };
export const flowIntro = (id: FlowId) => flows[id].intro;

const start = (flowId: FlowId, original: string, values: Values): FlowState => ({ flowId, values, original, confirmed: false, defaults: {} });

/** Direct policy answers about letters (no request, so no context needed). */
export function directLetterAnswer(t: string): FlowAnswer | undefined {
  const q = t.includes("?") || /^(can|do|does|is|will|what)\b/.test(t.trim());
  if (!q) return undefined;
  const chip: RelatedAction[] = [{ label: "Start an employment letter", ask: "I need an employment letter." }];
  const mk = (ids: string[]): FlowAnswer => ({ sections: ids.map((clauseId) => ({ clauseId })), related: chip, draft: `Hello [employee name],\n\nI checked the Employment Letter Procedure, ${ids.join(", ")}.\n\n[your answer for this employee's situation]\n\nPlease let me know if any of the facts above are not correct.` });
  if (has(t, "contract dates")) return mk(["EL-2.2"]);
  if (has(t, "noc code") && !has(t, "letter for")) return mk(["EL-2.3"]);
  if (has(t, "letter") && has(t, "immigration", "mortgage", "customi")) return mk(["EL-3.1", "EL-2.3"]);
  if (has(t, "letter") && has(t, "salary", "hours")) return mk(["EL-2.1"]);
  return undefined;
}

export type Detection = { kind: "flow"; state: FlowState } | { kind: "direct"; answer: FlowAnswer } | undefined;
export function detectFlow(original: string): Detection {
  const t = original.toLowerCase();
  const direct = directLetterAnswer(t);
  if (direct) return { kind: "direct", answer: direct };
  if (has(t, "employment letter", "letter of employment", "employment verification", "verification letter", "proof of employment", "noc code")) {
    const v: Values = {};
    const name = /\bfor ([A-Z][a-z'-]+(?: [A-Z][a-z'-]+)+)/.exec(original)?.[1];
    if (name) v.name = name;
    const st = statusFromText(t);
    if (st) v.status = st;
    else if (has(t, "fixed-term", "fixed term", "contract")) v.status = "Fixed-term contract";
    if (has(t, "mortgage")) v.purpose = "Mortgage";
    else if (has(t, "immigra")) v.purpose = "Immigration";
    return { kind: "flow", state: start("letter", original, v) };
  }
  const pregnancy = has(t, "pregnan", "parental", "maternity", "paternity");
  const pension = has(t, "pension", "hoopp");
  if (has(t, "leave of absence", "pregnan", "parental", "maternity", "paternity", "sub top-up", "top-up", "record of employment", "employment insurance", "benefits continue", "benefits while", "premium") || (pension && t.includes("leave")) || /\b(ei|roe)\b/.test(t)) {
    const v: Values = {};
    if (has(t, "top-up", "employment insurance", "record of employment") || /\b(ei|roe|sub)\b/.test(t)) v.topic = LOA_TOPICS[3];
    else if (pension) v.topic = LOA_TOPICS[2];
    else if (has(t, "benefit", "premium")) v.topic = LOA_TOPICS[1];
    else if (pregnancy) v.topic = LOA_TOPICS[0];
    if (pregnancy) v.kind = "Pregnancy or parental";
    else if (has(t, "unpaid", "personal leave")) v.kind = "Personal (unpaid)";
    const st = statusFromText(t);
    if (st) v.status = st;
    return { kind: "flow", state: start("leave", original, v) };
  }
  if (has(t, "dependant", "dependent", "newborn", "spouse", "baby", "step increase", "enrol", "enroll", "hoopp") || (t.includes("transfer") && has(t, "rate", "pay", "salary")) || (t.includes("pension") && !t.includes("leave"))) {
    const v: Values = {};
    if (has(t, "dependant", "dependent", "newborn", "spouse", "baby")) {
      v.topic = BC_TOPICS[0];
      if (has(t, "newborn", "baby", "birth", "adopt")) v.event = "Birth or adoption";
      else if (has(t, "spouse", "marri", "partner")) v.event = "Marriage or partner";
    } else if (t.includes("step increase")) v.topic = BC_TOPICS[1];
    else if (t.includes("transfer")) v.topic = BC_TOPICS[2];
    else v.topic = BC_TOPICS[3];
    const st = statusFromText(t);
    if (st) v.status = st;
    return { kind: "flow", state: start("benefits", original, v) };
  }
  return undefined;
}

const active = (s: Step, v: Values) => !s.when || s.when(v);
export function summaryRows(state: FlowState, today: string): ConfirmRow[] {
  const f = flows[state.flowId];
  const rows = f.steps.filter((s) => active(s, state.values) && s.key in state.values).map((s) => {
    const val = state.values[s.key];
    return { label: s.label, value: Array.isArray(val) ? (val.length ? val.join(", ") : "None") : val || "Not given" };
  });
  return [...rows, ...(f.extraRows?.(state.values, today) ?? [])];
}

export function advance(state: FlowState, today: string): Outcome {
  const f = flows[state.flowId];
  const routed = f.route?.(state.values);
  if (routed) return { type: "routed", routed };
  for (const step of f.steps) {
    if (!active(step, state.values) || step.key in state.values) continue;
    return { type: "step", step, defaultValue: state.defaults[step.key] ?? step.prefill?.(state.values, state.original) };
  }
  if (!state.confirmed) return { type: "confirm", rows: summaryRows(state, today), cautions: f.cautions?.(state.values) ?? [] };
  return { type: "result", answer: f.result(state.values, today, state) };
}

export const stepOptions = (step: Step, v: Values) => step.options?.(v) ?? [];
export const matchOption = (options: Option[], reply: string) => {
  const t = reply.trim().toLowerCase();
  if (!t) return undefined;
  return options.find((o) => o.label.toLowerCase() === t) ?? options.find((o) => o.keywords.some((k) => t.includes(k)));
};

export type AnswerResult = { ok: true; state: FlowState; display: string } | { ok: false; error: string };
/** Applies a reply (from the widget or the bottom bar) to the active step. */
export function answerStep(state: FlowState, step: Step, raw: Value): AnswerResult {
  const set = (value: Value, display: string): AnswerResult => ({ ok: true, state: { ...state, values: { ...state.values, [step.key]: value } }, display });
  const text = Array.isArray(raw) ? raw.join(", ") : raw.trim();
  switch (step.type) {
    case "choice": {
      const o = matchOption(stepOptions(step, state.values), text);
      return o ? set(o.label, o.label) : { ok: false, error: "I did not catch that. Choose one of these:" };
    }
    case "multi": {
      const options = stepOptions(step, state.values);
      const picked = Array.isArray(raw)
        ? options.filter((o) => raw.includes(o.label)).map((o) => o.label)
        : /^(none|nothing|no)\b/.test(text.toLowerCase()) ? [] : options.filter((o) => o.keywords.some((k) => text.toLowerCase().includes(k))).map((o) => o.label);
      if (!Array.isArray(raw) && !picked.length && !/^(none|nothing|no)\b/.test(text.toLowerCase())) return { ok: false, error: "I did not catch that. Tick the items to include, or type none." };
      return set(picked, picked.length ? picked.join(", ") : "None");
    }
    case "date":
      return parseISO(text) ? set(text, text) : { ok: false, error: "Enter a date as YYYY-MM-DD." };
    case "number": {
      const n = Number(text.replace(/[$,\s]/g, ""));
      return text && Number.isFinite(n) && n > 0 ? set(n.toFixed(2), n.toFixed(2)) : { ok: false, error: "Enter a number, for example 46.00." };
    }
    case "text":
      if (!text && !step.optional) return { ok: false, error: "This is needed to continue." };
      return set(text, step.private ? (text ? `${step.label} entered (kept in this browser only)` : `No ${step.label.toLowerCase()} given`) : text || "Skipped");
  }
}

export const confirmState = (s: FlowState): FlowState => ({ ...s, confirmed: true });
/** "Change" restarts the steps; earlier values become the defaults of each widget. */
export const changeState = (s: FlowState): FlowState => ({ ...s, values: {}, confirmed: false, defaults: { ...s.values } });

export { buildLetter };
