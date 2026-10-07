import { describe, expect, it } from "vitest";
import {
  addDays,
  buildLetter,
  nextAnniversary,
  noticeDueBy,
  transferPlacement,
} from "./hr-flow-calc";
import {
  advance,
  answerStep,
  changeState,
  confirmState,
  detectFlow,
  flowIntro,
  flows,
  letterClauses,
  letterData,
  stepOptions,
  type FlowAnswer,
  type FlowState,
  type Outcome,
  type Value,
} from "./hr-flow-engine";
import { clauseById } from "./hr-research-data";
import { matchQuestion } from "./hr-research-matcher";

const TODAY = "2026-10-07";

/** Starts a flow from wording and answers each step in turn (default value when no answer is given) until the flow stops asking. */
function drive(original: string, answers: Record<string, Value> = {}) {
  const d = detectFlow(original);
  if (!d || d.kind !== "flow") throw new Error(`no flow detected for: ${original}`);
  let state: FlowState = d.state;
  for (let i = 0; i < 40; i++) {
    const out = advance(state, TODAY);
    if (out.type !== "step") return { out, state };
    const a = answers[out.step.key] ?? out.defaultValue;
    if (a === undefined) throw new Error(`no answer given for step "${out.step.key}"`);
    const r = answerStep(state, out.step, a);
    if (!r.ok) throw new Error(`step "${out.step.key}": ${r.error}`);
    state = r.state;
  }
  throw new Error("flow did not stop");
}
const confirmed = (state: FlowState) => advance(confirmState(state), TODAY);
const resultOf = (o: Outcome): FlowAnswer => {
  if (o.type !== "result") throw new Error(`expected result, got ${o.type}`);
  return o.answer;
};
const ids = (a: FlowAnswer) => a.sections.map((s) => s.clauseId);

describe("flow detection from wording", () => {
  const cases: [string, string, string | undefined][] = [
    [
      "How do I start a pregnancy or parental leave?",
      "leave",
      "Starting a pregnancy or parental leave",
    ],
    [
      "Do my benefits continue while I am on a leave of absence?",
      "leave",
      "Benefits during a leave",
    ],
    [
      "Do I have to keep contributing to my pension during a leave?",
      "leave",
      "Pension during a leave",
    ],
    ["How does the SUB top-up work?", "leave", "EI and the SUB top-up"],
    ["When do I get my ROE?", "leave", "EI and the SUB top-up"],
    ["I am a nurse and I need an employment letter.", "letter", undefined],
    ["Can I get proof of employment for a mortgage?", "letter", undefined],
    ["How do I add my newborn to my benefits?", "benefits", "Adding or changing a dependant"],
    ["When is my next step increase?", "benefits", "Next step increase"],
    [
      "If I transfer to this role, what would my rate be?",
      "benefits",
      "Rate if the employee transfers",
    ],
    ["How do I enrol in the pension plan?", "benefits", "Pension enrolment"],
  ];
  it.each(cases)("%s", (q, flowId, topic) => {
    const d = detectFlow(q);
    expect(d?.kind).toBe("flow");
    if (d?.kind !== "flow") return;
    expect(d.state.flowId).toBe(flowId);
    if (topic) expect(d.state.values.topic).toBe(topic);
  });
  it("answers letter policy questions directly, with a chip back to the letter flow", () => {
    const sal = detectFlow("Can the letter include my salary and hours?");
    expect(sal?.kind === "direct" && sal.answer.sections.map((s) => s.clauseId)).toEqual([
      "EL-2.1",
    ]);
    const imm = detectFlow("Can HR customize the letter for immigration or a mortgage?");
    expect(imm?.kind === "direct" && imm.answer.sections.map((s) => s.clauseId)).toEqual([
      "EL-3.1",
      "EL-2.3",
    ]);
    const contract = detectFlow("Can the letter show my contract dates?");
    expect(contract?.kind === "direct" && contract.answer.sections.map((s) => s.clauseId)).toEqual([
      "EL-2.2",
    ]);
    const noc = detectFlow("What is the NOC code on the letter?");
    expect(noc?.kind === "direct" && noc.answer.sections.map((s) => s.clauseId)).toEqual([
      "EL-2.3",
    ]);
    if (sal?.kind === "direct")
      expect(sal.answer.related?.[0]?.label).toBe("Start an employment letter");
  });
  it("does not start a flow for unrelated questions", () => {
    expect(
      detectFlow("How many days of annual leave does a part-time employee get?"),
    ).toBeUndefined();
  });
  it("takes priority over the old dataset topics but not over the sensitive and payroll routes", () => {
    expect(matchQuestion("What is the maternity leave top-up?").kind).toBe("flow");
    expect(matchQuestion("medical leave of absence").kind).toBe("routed");
    expect(matchQuestion("employment letter for my payslip")).toMatchObject({
      kind: "routed",
      team: "Payroll",
    });
  });
});

describe("Flow A: leave of absence", () => {
  it("routes medical leave even when it is chosen from the chips", () => {
    const d = detectFlow("leave of absence");
    if (d?.kind !== "flow") throw new Error();
    let s = d.state;
    for (const [key, val] of [
      ["topic", "Benefits during a leave"],
      ["kind", "Medical"],
    ] as const) {
      const o = advance(s, TODAY);
      if (o.type !== "step" || o.step.key !== key) throw new Error(`expected step ${key}`);
      const r = answerStep(s, o.step, val);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    const out = advance(s, TODAY);
    expect(out.type).toBe("routed");
    if (out.type === "routed") {
      expect(out.routed.team).toBe("Health and Wellness");
      expect(out.routed.instruction).toBe(
        "Medical leave needs a person's judgment and confidentiality. Pass the question to Health and Wellness (or Disability Support for sick pay) and do not reply with policy wording.",
      );
    }
  });
  it("does not ask for what the question already states", () => {
    const d = detectFlow("How do I start a pregnancy or parental leave?");
    if (d?.kind !== "flow") throw new Error();
    expect(d.state.values).toMatchObject({
      topic: "Starting a pregnancy or parental leave",
      kind: "Pregnancy or parental",
    });
    const o = advance(d.state, TODAY);
    expect(o.type === "step" && o.step.key).toBe("status");
  });
  it("answers nothing until Confirm, and shows the notice date computed from the start date", () => {
    const { out, state } = drive("How do I start a pregnancy or parental leave?", {
      status: "Full-time",
      start: "2026-12-01",
    });
    expect(out.type).toBe("confirm");
    if (out.type !== "confirm") return;
    expect(out.rows.find((r) => r.label === "Notice due by")).toEqual({
      label: "Notice due by",
      value: "2026-11-03",
      note: "Based on clause LOA-1.1",
    });
    expect(noticeDueBy("2026-12-01")).toBe("2026-11-03");
    const a = resultOf(confirmed(state));
    expect(ids(a)).toEqual(["LOA-1.1", "LOA-1.2", "LOA-1.3"]);
    expect(a.forms).toEqual(["loa"]);
    expect(a.computed?.[0]).toContain("Notice due by 2026-11-03");
    expect(a.computed?.[0]).toContain("Notice is on time.");
  });
  it("flags notice that is already late", () => {
    const { state } = drive("How do I start a pregnancy or parental leave?", {
      status: "Full-time",
      start: "2026-10-20",
    });
    expect(resultOf(confirmed(state)).computed?.[0]).toContain("has already passed");
  });
  it("shows the casual eligibility clause first and the SUB caution, and leaves LOA-4.2 out", () => {
    const { state } = drive("How does the SUB top-up work?", {
      kind: "Pregnancy or parental",
      status: "Casual",
      start: "2026-12-01",
    });
    const a = resultOf(confirmed(state));
    expect(a.sections[0]).toEqual({ clauseId: "LOA-0.1", label: "Eligibility" });
    expect(ids(a)).not.toContain("LOA-4.2");
    expect(a.cautions).toContain("Casual employees are not eligible for the SUB top-up.");
  });
  it("shows the SUB clause for full-time employees and no caution", () => {
    const { state } = drive("How does the SUB top-up work?", {
      kind: "Pregnancy or parental",
      status: "Full-time",
      start: "2026-12-01",
    });
    const a = resultOf(confirmed(state));
    expect(ids(a)).toEqual(["LOA-4.1", "LOA-4.2", "LOA-4.3", "LOA-4.4"]);
    expect(a.cautions).toBeUndefined();
  });
  it("uses LOA-0.2 as eligibility for an unpaid personal leave and drops the top-up clauses", () => {
    const { state } = drive("How does the SUB top-up work?", {
      kind: "Personal (unpaid)",
      status: "Full-time",
      start: "2026-12-01",
    });
    const a = resultOf(confirmed(state));
    expect(a.sections[0]).toEqual({ clauseId: "LOA-0.2", label: "Eligibility" });
    expect(ids(a)).not.toContain("LOA-4.2");
    expect(ids(a)).not.toContain("LOA-4.4");
  });
  it.each([
    [
      "Do my benefits continue while I am on a leave of absence?",
      ["LOA-2.1", "LOA-2.2", "LOA-2.3"],
    ],
    [
      "Do I have to keep contributing to my pension during a leave?",
      ["LOA-3.1", "LOA-3.2", "LOA-3.3"],
    ],
  ])("topic clauses: %s", (q, expected) => {
    const { state } = drive(q, {
      kind: "Pregnancy or parental",
      status: "Part-time",
      start: "2026-12-01",
    });
    expect(ids(resultOf(confirmed(state)))).toEqual(expected);
  });
  it("related chips keep the confirmed context and change only the topic", () => {
    const { state } = drive("How do I start a pregnancy or parental leave?", {
      status: "Full-time",
      start: "2026-12-01",
    });
    const a = resultOf(confirmed(state));
    expect(a.related).toHaveLength(3);
    const chip = a.related?.find((r) => r.label === "Pension during a leave");
    expect(chip?.state?.values).toMatchObject({
      kind: "Pregnancy or parental",
      status: "Full-time",
      start: "2026-12-01",
      topic: "Pension during a leave",
    });
    expect(chip?.state?.confirmed).toBe(false);
  });
  it("every clause the leave flow cites exists in the data", () => {
    for (const id of [
      "LOA-0.1",
      "LOA-0.2",
      "LOA-1.1",
      "LOA-1.2",
      "LOA-1.3",
      "LOA-2.1",
      "LOA-2.2",
      "LOA-2.3",
      "LOA-3.1",
      "LOA-3.2",
      "LOA-3.3",
      "LOA-4.1",
      "LOA-4.2",
      "LOA-4.3",
      "LOA-4.4",
    ])
      expect(clauseById(id), id).toBeDefined();
  });
});

describe("Flow B: employment letter", () => {
  const nurse = {
    name: "Jane Doe",
    id: "",
    status: "Full-time",
    start: "2019-03-04",
    purpose: "Immigration",
    include: ["Salary", "Hours of work", "NOC code"],
    addressee: "To whom it may concern",
  };
  it("has the governing procedure (EL-1.1 and EL-5.1) to show before any question", () => {
    expect(flowIntro("letter")?.map((s) => s.clauseId)).toEqual(["EL-1.1", "EL-5.1"]);
  });
  it("requires the employee name", () => {
    const d = detectFlow("I am a nurse and I need an employment letter.");
    if (d?.kind !== "flow") throw new Error();
    const o = advance(d.state, TODAY);
    if (o.type !== "step") throw new Error();
    expect(o.step.key).toBe("name");
    expect(answerStep(d.state, o.step, "")).toMatchObject({ ok: false });
    expect(answerStep(d.state, o.step, "   ")).toMatchObject({ ok: false });
    expect(answerStep(d.state, o.step, "Jane Doe")).toMatchObject({ ok: true });
  });
  it("keeps the name and ID out of the visible thread but labels the name field", () => {
    const d = detectFlow("I need an employment letter.");
    if (d?.kind !== "flow") throw new Error();
    const o = advance(d.state, TODAY);
    if (o.type !== "step") throw new Error();
    expect(o.step.help).toBe(
      "Used only to fill the letter in your browser. It is not stored or sent anywhere.",
    );
    const r = answerStep(d.state, o.step, "Jane Doe");
    expect(r.ok && r.display).not.toContain("Jane");
  });
  it("prefills the job title from the wording and the NOC code from the title", () => {
    const d = detectFlow("I am a nurse and I need an employment letter.");
    if (d?.kind !== "flow") throw new Error();
    let s = d.state;
    const asked: Record<string, Value | undefined> = {};
    for (let i = 0; i < 40; i++) {
      const o = advance(s, TODAY);
      if (o.type !== "step") break;
      asked[o.step.key] = o.defaultValue;
      const a =
        (nurse as Record<string, Value>)[o.step.key] ?? o.defaultValue ?? "Registered Nurse";
      const r = answerStep(s, o.step, a);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(asked["title"]).toBe("Registered Nurse");
    expect(asked["noc"]).toBe("31301");
    expect(asked["rate"]).toBe("$52.00 per hour (synthetic sample)");
    expect(asked["hours"]).toBe("37.5 hours per week");
    expect(asked["include"]).toEqual(["NOC code"]);
  });
  it.each([
    ["registered practical nurse", "32101"],
    ["personal support worker", "33102"],
    ["nurse", "31301"],
  ])("NOC for %s is %s", (title, noc) => {
    const { out } = drive(`I am a ${title} and I need an employment letter`, { ...nurse, id: "" });
    expect(out.type).toBe("confirm");
    if (out.type === "confirm")
      expect(out.rows.find((r) => r.label === "NOC code")?.value).toBe(noc);
  });
  it("lists the clauses applied on the confirm card, and gates the letter behind Confirm", () => {
    const { out, state } = drive("I am a nurse and I need an employment letter.", nurse);
    expect(out.type).toBe("confirm");
    if (out.type !== "confirm") return;
    expect(out.rows.find((r) => r.label === "Clauses applied")?.value).toBe(
      "EL-1.2, EL-2.1, EL-2.3, EL-3.1",
    );
    const a = resultOf(confirmed(state));
    expect(a.letter).toMatchObject({
      name: "Jane Doe",
      title: "Registered Nurse",
      noc: "31301",
      purpose: "Immigration",
    });
    expect(ids(a)).toEqual(["EL-1.2", "EL-2.1", "EL-2.3", "EL-3.1"]);
    expect(a.draft).toContain("[your name]");
  });
  it("adds a caution for casual employees", () => {
    const { out } = drive("I need an employment letter.", {
      ...nurse,
      title: "Registered Nurse",
      status: "Casual",
    });
    expect(out.type === "confirm" && out.cautions).toEqual([
      "Check with People Operations: the procedure covers current employees.",
    ]);
  });
  it("only offers contract dates to fixed-term employees and the NOC code for immigration", () => {
    const inc = flows.letter.steps.find((s) => s.key === "include")!;
    expect(
      stepOptions(inc, { status: "Full-time", purpose: "Mortgage" }).map((o) => o.label),
    ).toEqual(["Salary", "Hours of work"]);
    expect(
      stepOptions(inc, { status: "Fixed-term contract", purpose: "Immigration" }).map(
        (o) => o.label,
      ),
    ).toEqual(["Salary", "Hours of work", "Contract dates", "NOC code"]);
    expect(
      stepOptions(inc, { status: "Fixed-term contract", purpose: "Rental or lease" }).map(
        (o) => o.label,
      ),
    ).toEqual(["Salary", "Hours of work", "Contract dates"]);
  });
  it("builds clause lists and letter text that only include what was selected", () => {
    expect(letterClauses({ status: "Full-time", purpose: "Mortgage", include: [] })).toEqual([
      "EL-1.2",
      "EL-3.1",
    ]);
    expect(
      letterClauses({
        status: "Fixed-term contract",
        purpose: "Mortgage",
        include: ["Contract dates"],
      }),
    ).toEqual(["EL-1.2", "EL-2.2", "EL-3.1"]);
    expect(
      letterClauses({
        status: "Full-time",
        purpose: "Mortgage",
        include: ["Contract dates", "NOC code"],
      }),
    ).toEqual(["EL-1.2", "EL-3.1"]);
    const data = letterData({
      name: "Jane Doe",
      id: "E0123",
      title: "Registered Nurse",
      status: "Full-time",
      start: "2019-03-04",
      purpose: "Mortgage",
      include: ["Salary", "NOC code"],
      rate: "$52.00 per hour (synthetic sample)",
      noc: "31301",
      addressee: "To whom it may concern",
    });
    const text = buildLetter(data, TODAY);
    const body = text.paragraphs.join(" ");
    expect(text.re).toBe("Re: Employment verification for Jane Doe (E0123)");
    expect(text.date).toBe("October 7, 2026");
    expect(body).toContain("Registered Nurse");
    expect(body).toContain("March 4, 2019");
    expect(body).toContain("$52.00 per hour");
    expect(body).not.toContain("NOC");
    expect(body).not.toContain("hours of work");
    expect(text.paragraphs[1]).toBe(
      "This letter is provided at the employee's request for mortgage purposes.",
    );
    expect(text.closing).toEqual([
      "Sincerely,",
      "People Operations",
      "Waterloo Regional Health Network",
    ]);
    expect(text.footer).toBe(
      "Synthetic sample generated by the HR Research Assistant prototype. Not an official WRHN document.",
    );
  });
  it("uses a named recipient when one is given", () => {
    const t = buildLetter(
      {
        ...letterData({
          name: "A B",
          title: "RN",
          status: "Full-time",
          start: "2020-01-02",
          purpose: "Other",
          purposeOther: "a rental application",
          include: [],
          addressee: "A named recipient",
          recipient: "Maple Lending",
        }),
      },
      TODAY,
    );
    expect(t.addressee).toBe("Maple Lending");
    expect(t.paragraphs[1]).toContain("a rental application");
  });
  it("every clause the letter flow cites exists in the data", () => {
    for (const id of ["EL-1.1", "EL-1.2", "EL-2.1", "EL-2.2", "EL-2.3", "EL-3.1", "EL-5.1"])
      expect(clauseById(id), id).toBeDefined();
  });
});

describe("Flow C: benefits, step increases, transfers and pension", () => {
  const daysAgo = (n: number) => addDays(TODAY, -n);
  it("applies the 31-day rule on both sides", () => {
    const at31 = drive("How do I add my newborn to my benefits?", {
      eventDate: daysAgo(31),
      status: "Full-time",
    });
    const at32 = drive("How do I add my newborn to my benefits?", {
      eventDate: daysAgo(32),
      status: "Full-time",
    });
    if (at31.out.type !== "confirm" || at32.out.type !== "confirm") throw new Error();
    expect(at31.out.rows.find((r) => r.label === "Window")?.value).toBe("within 31 days");
    expect(at32.out.rows.find((r) => r.label === "Window")?.value).toBe("after 31 days");
    const a31 = resultOf(confirmed(at31.state)),
      a32 = resultOf(confirmed(at32.state));
    expect(a31.computed?.[0]).toBe(
      "The life event was 31 days ago, so the standard route applies.",
    );
    expect(a32.computed?.[0]).toBe(
      "The life event was 32 days ago, so the insurer's underwriting route applies.",
    );
    expect(ids(a31)).toEqual(["BC-1.1", "BC-1.2", "BC-1.3"]);
    expect(a31.forms).toEqual(["benefits"]);
  });
  it("skips the life-event step when the wording already states it", () => {
    const d = detectFlow("How do I add my newborn to my benefits?");
    if (d?.kind !== "flow") throw new Error();
    expect(d.state.values).toMatchObject({
      topic: "Adding or changing a dependant",
      event: "Birth or adoption",
    });
  });
  it("finds the next anniversary, including 29 February", () => {
    expect(nextAnniversary("2019-03-04", "2026-10-07")).toBe("2027-03-04");
    expect(nextAnniversary("2019-12-25", "2026-10-07")).toBe("2026-12-25");
    expect(nextAnniversary("2019-10-07", "2026-10-07")).toBe("2026-10-07");
    expect(nextAnniversary("2020-02-29", "2026-10-07")).toBe("2027-02-28");
    expect(nextAnniversary("2020-02-29", "2027-10-07")).toBe("2028-02-29");
    expect(nextAnniversary("2020-02-29", "2028-01-10")).toBe("2028-02-29");
  });
  it("answers the next step increase from the anniversary date", () => {
    const { out, state } = drive("When is my next step increase?", {
      anniv: "2019-03-04",
      status: "Full-time",
    });
    expect(
      out.type === "confirm" && out.rows.find((r) => r.label === "Next anniversary")?.value,
    ).toBe("2027-03-04");
    const a = resultOf(confirmed(state));
    expect(ids(a)).toEqual(["BC-2.1"]);
    expect(a.computed?.[0]).toBe("Next step increase takes effect on March 4, 2027.");
  });
  it("places a $46.00 rate in Band 4 at Step 2, $47.50", () => {
    expect(transferPlacement(46, "Band 4")).toEqual({ step: 2, rate: 47.5, aboveTop: false });
    const { state } = drive("If I transfer to this role, what would my rate be?", {
      rate: "46.00",
      band: "Band 4",
    });
    const a = resultOf(confirmed(state));
    expect(a.computed?.[0]).toBe("Placed at Step 2 of Band 4: $47.50 per hour.");
    expect(ids(a)).toEqual(["BC-2.2"]);
    expect(a.table?.head).toEqual(["Band", "Step 1", "Step 2", "Step 3", "Step 4"]);
    expect(a.table?.rows).toHaveLength(3);
    expect(a.cautions).toEqual([]);
  });
  it("lands on the exact step when the rate equals a step", () => {
    expect(transferPlacement(47.5, "Band 4")).toEqual({ step: 2, rate: 47.5, aboveTop: false });
    expect(transferPlacement(40, "Band 3").step).toBe(1);
  });
  it("cautions to check with Total Rewards when the rate is above the top step", () => {
    expect(transferPlacement(60, "Band 4")).toEqual({ step: 4, rate: 52.5, aboveTop: true });
    const { state } = drive("If I transfer to this role, what would my rate be?", {
      rate: "60.00",
      band: "Band 4",
    });
    expect(resultOf(confirmed(state)).cautions).toEqual([
      "The current rate is above the top step, so check with Total Rewards.",
    ]);
  });
  it("rejects a rate that is not a positive number", () => {
    const d = detectFlow("If I transfer to this role, what would my rate be?");
    if (d?.kind !== "flow") throw new Error();
    const o = advance(d.state, TODAY);
    if (o.type !== "step") throw new Error();
    expect(o.step.key).toBe("rate");
    for (const bad of ["", "abc", "0", "-5"])
      expect(answerStep(d.state, o.step, bad)).toMatchObject({ ok: false });
    expect(answerStep(d.state, o.step, "$46.00")).toMatchObject({ ok: true });
  });
  it("shows the pension enrolment clauses and form, and eligibility first for casual employees", () => {
    const ft = resultOf(
      confirmed(drive("How do I enrol in the pension plan?", { status: "Full-time" }).state),
    );
    expect(ids(ft)).toEqual(["BC-3.1", "BC-3.2"]);
    expect(ft.forms).toEqual(["pension"]);
    const casual = resultOf(
      confirmed(drive("How do I enrol in the pension plan?", { status: "Casual" }).state),
    );
    expect(ids(casual)).toEqual(["BC-0.1", "BC-3.2", "BC-3.1"]);
    expect(casual.sections[0]).toEqual({ clauseId: "BC-0.1", label: "Eligibility" });
    expect(casual.cautions?.[0]).toContain(
      "Casual employees are not eligible for the pension plan",
    );
  });
  it("shows BC-0.1 eligibility and a caution for a casual dependant request", () => {
    const a = resultOf(
      confirmed(
        drive("How do I add my newborn to my benefits?", {
          eventDate: daysAgo(5),
          status: "Casual",
        }).state,
      ),
    );
    expect(a.sections[0]).toEqual({ clauseId: "BC-0.1", label: "Eligibility" });
    expect(a.cautions?.[0]).toContain("Casual employees are not eligible");
  });
  it("every clause the benefits flow cites exists in the data", () => {
    for (const id of [
      "BC-0.1",
      "BC-1.1",
      "BC-1.2",
      "BC-1.3",
      "BC-2.1",
      "BC-2.2",
      "BC-3.1",
      "BC-3.2",
    ])
      expect(clauseById(id), id).toBeDefined();
  });
});

describe("Confirm, Change and typed replies", () => {
  it("Change restarts the steps with earlier answers prefilled, and answers nothing until Confirm again", () => {
    const { state } = drive("If I transfer to this role, what would my rate be?", {
      rate: "46.00",
      band: "Band 4",
    });
    const changed = changeState(state);
    expect(changed.values).toEqual({});
    expect(changed.confirmed).toBe(false);
    const first = advance(changed, TODAY);
    expect(first.type === "step" && first.step.key).toBe("topic");
    expect(first.type === "step" && first.defaultValue).toBe("Rate if the employee transfers");
    let s = changed;
    const seen: Record<string, Value | undefined> = {};
    for (let i = 0; i < 20; i++) {
      const o = advance(s, TODAY);
      if (o.type !== "step") {
        expect(o.type).toBe("confirm");
        break;
      }
      seen[o.step.key] = o.defaultValue;
      const r = answerStep(s, o.step, o.defaultValue as Value);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(seen).toMatchObject({ rate: "46.00", band: "Band 4" });
  });
  it("accepts typed replies to choice steps, by label or keyword", () => {
    const d = detectFlow("How do I enrol in the pension plan?");
    if (d?.kind !== "flow") throw new Error();
    const o = advance(d.state, TODAY);
    if (o.type !== "step") throw new Error();
    expect(answerStep(d.state, o.step, "part time")).toMatchObject({
      ok: true,
      display: "Part-time",
    });
    expect(answerStep(d.state, o.step, "Casual")).toMatchObject({ ok: true, display: "Casual" });
    expect(answerStep(d.state, o.step, "banana")).toMatchObject({ ok: false });
  });
  it("accepts typed replies to the multi step, including none", () => {
    const { state } = drive("I need an employment letter.", {
      name: "A B",
      id: "",
      title: "Registered Nurse",
      status: "Full-time",
      start: "2020-01-02",
      purpose: "Mortgage",
      include: [],
      addressee: "To whom it may concern",
    });
    expect(state.values.include).toEqual([]);
    const d = detectFlow("I need an employment letter.");
    if (d?.kind !== "flow") throw new Error();
    const base: FlowState = {
      ...d.state,
      values: {
        name: "A B",
        id: "",
        title: "RN",
        status: "Full-time",
        start: "2020-01-02",
        purpose: "Mortgage",
      },
    };
    const o = advance(base, TODAY);
    if (o.type !== "step") throw new Error();
    expect(o.step.key).toBe("include");
    expect(answerStep(base, o.step, "salary and hours")).toMatchObject({
      ok: true,
      display: "Salary, Hours of work",
    });
    expect(answerStep(base, o.step, "none")).toMatchObject({ ok: true, display: "None" });
    expect(answerStep(base, o.step, "zzz")).toMatchObject({ ok: false });
  });
  it("rejects dates that are not real dates", () => {
    const d = detectFlow("When is my next step increase?");
    if (d?.kind !== "flow") throw new Error();
    const o = advance(d.state, TODAY);
    if (o.type !== "step") throw new Error();
    for (const bad of ["", "2026-02-30", "03/04/2019", "tomorrow"])
      expect(answerStep(d.state, o.step, bad)).toMatchObject({ ok: false });
  });
});
