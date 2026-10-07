// Click-through tests of the real conversation page, rendered in jsdom (not a real browser).
// Every test fails on any console.error or uncaught window error.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/hr-pdf", () => ({
  letterPdf: vi.fn(async () => ({
    blob: new Blob(["%PDF-test"], { type: "application/pdf" }),
    filename: "employment-letter-doe-sample.pdf",
    save: vi.fn(),
  })),
  downloadForm: vi.fn(async () => {}),
}));

import { AssistantPage } from "@/components/assistant-page";
import { TurnBoundary } from "@/components/flow-widgets";
import { addDays, todayISO } from "@/lib/hr-flow-calc";
import { clauseById } from "@/lib/hr-research-data";
import { HrResearchProvider } from "@/lib/hr-research-context";
import { downloadForm, letterPdf } from "@/lib/hr-pdf";
import { inboxGroups } from "@/lib/hr-inbox-groups";

let consoleErrors: ReturnType<typeof vi.spyOn>;
const windowErrors: unknown[] = [];
const onWindowError = (e: ErrorEvent) => {
  windowErrors.push(e.error ?? e.message);
  e.preventDefault();
};

beforeEach(() => {
  windowErrors.length = 0;
  consoleErrors = vi.spyOn(console, "error").mockImplementation(() => {});
  window.addEventListener("error", onWindowError);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  vi.mocked(letterPdf).mockClear();
  vi.mocked(downloadForm).mockClear();
});
afterEach(() => {
  window.removeEventListener("error", onWindowError);
  const calls = consoleErrors.mock.calls.map((c: unknown[]) => String(c[0]).slice(0, 200));
  consoleErrors.mockRestore();
  cleanup();
  expect(calls, "console.error calls").toEqual([]);
  expect(windowErrors, "window errors").toEqual([]);
});

const page = () =>
  render(
    <HrResearchProvider>
      <AssistantPage />
    </HrResearchProvider>,
  );
const bodyText = () => document.body.textContent ?? "";
const hasQuote = (id: string) => bodyText().includes(clauseById(id)!.text);

/** Typed question from the home screen. */
function ask(text: string) {
  fireEvent.change(screen.getByLabelText("HR policy question"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /^Ask/ }));
}
/** Typed reply from the bottom bar. */
function reply(text: string) {
  fireEvent.change(screen.getByLabelText(/Reply to the assistant/), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}
const enabled = (name: string | RegExp) =>
  screen.getAllByRole("button", { name }).filter((b) => !(b as HTMLButtonElement).disabled);
const chip = (name: string | RegExp) => {
  const b = enabled(name);
  expect(b.length, `enabled button ${String(name)}`).toBeGreaterThan(0);
  fireEvent.click(b[b.length - 1]!);
};
const activeInput = (label: RegExp) => {
  const l = screen.getAllByLabelText(label).filter((i) => !(i as HTMLInputElement).disabled);
  return l[l.length - 1] as HTMLInputElement;
};
const fill = (label: RegExp, value: string) =>
  fireEvent.change(activeInput(label), { target: { value } });
const next = () => chip("Continue");
const startFromRow = (q: string) => {
  page();
  fireEvent.click(screen.getByRole("button", { name: q }));
};
const today = () => todayISO();

describe("home screen", () => {
  it("shows the common inbox inquiries in three flat groups and keeps recent help desk inquiries below", () => {
    page();
    expect(
      screen.getByRole("heading", { name: "Common inquiries from the HR inbox" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Or try asking")).toBeNull();
    for (const g of inboxGroups) {
      expect(screen.getByRole("heading", { name: g.title })).toBeInTheDocument();
      for (const q of g.questions)
        expect(screen.getByRole("button", { name: q })).toBeInTheDocument();
    }
    expect(inboxGroups.map((g) => g.questions.length)).toEqual([4, 3, 4]);
    const recent = screen.getByRole("heading", { name: "Recent help desk inquiries" });
    expect(
      recent.compareDocumentPosition(
        screen.getByRole("heading", { name: "Common inquiries from the HR inbox" }),
      ) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(screen.getByText(/Do not include names or employee IDs/)).toBeInTheDocument();
  });
  it("starts a conversation from every inbox row without errors", () => {
    for (const g of inboxGroups)
      for (const q of g.questions) {
        const { unmount } = page();
        fireEvent.click(screen.getByRole("button", { name: q }));
        expect(screen.getByText("Inquiry conversation")).toBeInTheDocument();
        expect(screen.getByTestId("you-message")).toHaveTextContent(q);
        unmount();
      }
  });
});

describe("the original bug: part-time / full-time question and its chips", () => {
  it("tapping Part-time answers with the part-time clause and disables the old chips", () => {
    page();
    ask("How many days of leave does an employee get?");
    expect(
      screen.getByText("Is the employee full-time, part-time or on probation?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Part-time" }));
    expect(hasQuote("L12")).toBe(true);
    expect(screen.getByText(/What I know so far:/)).toBeInTheDocument();
    for (const name of ["Full-time", "Part-time", "On probation", "Contractor"]) {
      for (const b of screen.getAllByRole("button", { name })) expect(b).toBeDisabled();
    }
  });
  it("typing 'full time' answers with the full-time clause", () => {
    page();
    ask("How many days of leave does an employee get?");
    reply("full time");
    expect(hasQuote("L11")).toBe(true);
  });
  it("an unclear typed reply asks again instead of failing", () => {
    page();
    ask("How many days of leave does an employee get?");
    reply("not sure");
    expect(
      screen.getAllByText("I did not catch that. Choose one of these:").length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Part-time" })
        .filter((b) => !(b as HTMLButtonElement).disabled)
        .at(-1)!,
    );
    expect(hasQuote("L12")).toBe(true);
  });
});

describe("Flow A: leave of absence", () => {
  it("parental leave: skips what the question states, gates the answer behind Confirm, computes the notice date", () => {
    startFromRow("How do I start a pregnancy or parental leave?");
    expect(screen.getByTestId("known-so-far")).toHaveTextContent(
      "Leave type: Pregnancy or parental",
    );
    expect(screen.queryByText("What kind of leave is it?")).toBeNull();
    expect(screen.getByText("What is the employee's employment status?")).toBeInTheDocument();
    chip("Full-time");
    fill(/Planned start date/, "2026-12-01");
    next();
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
    expect(screen.getByText("Notice due by")).toBeInTheDocument();
    expect(screen.getByText("2026-11-03")).toBeInTheDocument();
    expect(screen.getByText("Based on clause LOA-1.1")).toBeInTheDocument();
    expect(hasQuote("LOA-1.1")).toBe(false); // nothing answered before Confirm
    expect(screen.queryByTestId("answer-card")).toBeNull();
    chip("Confirm");
    expect(screen.getByTestId("answer-card")).toBeInTheDocument();
    for (const id of ["LOA-1.1", "LOA-1.2", "LOA-1.3"]) expect(hasQuote(id)).toBe(true);
    expect(
      screen.getByRole("button", { name: /Download form: Leave of absence request form/ }),
    ).toBeEnabled();
    expect(screen.getByText(/Notice due by 2026-11-03/)).toBeInTheDocument();
    // answered widgets are read-only
    for (const b of screen.getAllByRole("button", {
      name: /^(Full-time|Part-time|Casual|Continue|Confirm|Change)$/,
    }))
      expect(b).toBeDisabled();
    expect(activeInputs().length).toBe(0);
  });
  it("Change re-opens the steps with the earlier answers prefilled and answers nothing", () => {
    startFromRow("How do I start a pregnancy or parental leave?");
    chip("Full-time");
    fill(/Planned start date/, "2026-12-01");
    next();
    chip("Change");
    expect(screen.getByText("What is the employee asking about?")).toBeInTheDocument();
    expect(screen.queryByTestId("answer-card")).toBeNull();
    expect(enabled("Starting a pregnancy or parental leave").length).toBe(1);
    chip("Starting a pregnancy or parental leave");
    chip("Pregnancy or parental");
    chip("Full-time");
    expect(activeInput(/Planned start date/).value).toBe("2026-12-01");
  });
  it("medical leave routes to Health and Wellness and gives no policy wording", () => {
    page();
    ask("leave of absence");
    chip("Benefits during a leave");
    chip("Medical");
    expect(screen.getByText("I can't answer this one.")).toBeInTheDocument();
    expect(screen.getByText("Health and Wellness")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Medical leave needs a person's judgment and confidentiality. Pass the question to Health and Wellness (or Disability Support for sick pay) and do not reply with policy wording.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("answer-card")).toBeNull();
  });
  it("casual employees: eligibility first, the SUB caution, and no SUB top-up clause", () => {
    startFromRow("How does the SUB top-up work?");
    chip("Pregnancy or parental");
    chip("Casual");
    fill(/Planned start date/, "2026-12-01");
    next();
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
    chip("Confirm");
    expect(hasQuote("LOA-0.1")).toBe(true);
    expect(hasQuote("LOA-4.2")).toBe(false);
    expect(screen.getByText("Eligibility")).toBeInTheDocument();
    expect(
      screen.getAllByText("Casual employees are not eligible for the SUB top-up.").length,
    ).toBeGreaterThan(0);
  });
  it("related questions re-enter the flow keeping the confirmed context", () => {
    startFromRow("How do I start a pregnancy or parental leave?");
    chip("Part-time");
    fill(/Planned start date/, "2026-12-01");
    next();
    chip("Confirm");
    fireEvent.click(screen.getByRole("button", { name: "Pension during a leave" }));
    expect(screen.getAllByTestId("confirm").length).toBe(2);
    const rows = within(screen.getAllByTestId("confirm").at(-1)!);
    expect(rows.getByText("Pension during a leave")).toBeInTheDocument();
    expect(rows.getByText("Part-time")).toBeInTheDocument();
    chip("Confirm");
    for (const id of ["LOA-3.1", "LOA-3.2", "LOA-3.3"]) expect(hasQuote(id)).toBe(true);
  });
  it("accepts typed replies for steps", () => {
    startFromRow("How do I start a pregnancy or parental leave?");
    reply("part time");
    expect(screen.getAllByTestId("advisor-reply").at(-1)).toHaveTextContent("Part-time");
    reply("2026-12-01");
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
    reply("confirm");
    expect(hasQuote("LOA-1.1")).toBe(true);
  });
  it("an invalid typed date shows an error on the step and recovers", () => {
    startFromRow("How do I start a pregnancy or parental leave?");
    chip("Full-time");
    reply("someday");
    expect(screen.getByText("Enter a date as YYYY-MM-DD.")).toBeInTheDocument();
    reply("2026-12-01");
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
  });
});

function activeInputs() {
  return Array.from(document.querySelectorAll("input")).filter(
    (i) => !i.disabled && i.type !== "checkbox",
  );
}

describe("Flow B: employment letter", () => {
  function runLetter() {
    startFromRow("I am a nurse and I need an employment letter.");
    // governing procedure first
    expect(screen.getByTestId("intro-card")).toBeInTheDocument();
    expect(hasQuote("EL-1.1")).toBe(true);
    expect(hasQuote("EL-5.1")).toBe(true);
    // name is required and labelled
    expect(
      screen.getByText(
        "Used only to fill the letter in your browser. It is not stored or sent anywhere.",
      ),
    ).toBeInTheDocument();
    next();
    expect(screen.getByText("This is needed to continue.")).toBeInTheDocument();
    fill(/Employee name/, "Jane Doe");
    next();
    next(); // employee ID is optional
    expect(activeInput(/Job title/).value).toBe("Registered Nurse");
    next();
    chip("Full-time");
    fill(/Start date/, "2019-03-04");
    next();
    chip("Immigration");
    expect((screen.getByLabelText("NOC code") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Salary"));
    fireEvent.click(screen.getByLabelText("Hours of work"));
    expect(screen.queryByLabelText("Contract dates")).toBeNull();
    next();
    expect(activeInput(/Rate of pay/).value).toBe("$52.00 per hour (synthetic sample)");
    next();
    expect(activeInput(/Hours of work/).value).toBe("37.5 hours per week");
    next();
    expect(activeInput(/NOC code/).value).toBe("31301");
    expect(screen.getByText("Sample value. Confirm with HR before issuing.")).toBeInTheDocument();
    next();
    chip("To whom it may concern");
  }
  it("nurse flow: confirm card first, then the PDF, clause quotes and a draft reply", async () => {
    runLetter();
    expect(screen.getByTestId("confirm")).toBeInTheDocument();
    expect(screen.getByText("EL-1.2, EL-2.1, EL-2.3, EL-3.1")).toBeInTheDocument();
    expect(screen.queryByTestId("letter")).toBeNull();
    expect(letterPdf).not.toHaveBeenCalled();
    // the private name and ID were not echoed into the advisor's messages
    expect(
      screen
        .getAllByTestId("advisor-reply")
        .map((e) => e.textContent)
        .join("|"),
    ).not.toContain("Jane");
    expect(
      screen.getByText("Employee name entered (kept in this browser only)"),
    ).toBeInTheDocument();
    chip("Confirm");
    await waitFor(() => expect(screen.getByRole("button", { name: /Download PDF/ })).toBeEnabled());
    expect(letterPdf).toHaveBeenCalledTimes(1);
    expect(letterPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Doe",
        title: "Registered Nurse",
        noc: "31301",
        purpose: "Immigration",
        include: ["Salary", "Hours of work", "NOC code"],
      }),
    );
    expect(screen.getByTitle("Employment letter preview")).toHaveAttribute("src", "blob:test");
    expect(screen.getByRole("button", { name: /Open in new tab/ })).toBeEnabled();
    for (const id of ["EL-1.2", "EL-2.1", "EL-2.3", "EL-3.1"]) expect(hasQuote(id)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Draft reply/ }));
    expect((screen.getByLabelText("Draft reply") as HTMLTextAreaElement).value).toContain(
      "Please find your employment letter attached",
    );
  });
  it("the PDF is built once, not on every re-render", async () => {
    runLetter();
    chip("Confirm");
    await waitFor(() => expect(screen.getByRole("button", { name: /Download PDF/ })).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Reply to the assistant/), {
      target: { value: "typing" },
    });
    fireEvent.change(screen.getByLabelText(/Reply to the assistant/), {
      target: { value: "typing more" },
    });
    expect(letterPdf).toHaveBeenCalledTimes(1);
  });
  it("New inquiry clears everything, including the name", () => {
    runLetter();
    fireEvent.click(screen.getByRole("button", { name: "New inquiry" }));
    expect(screen.getByText("What do you need to look up?")).toBeInTheDocument();
    expect(bodyText()).not.toContain("Jane Doe");
    fireEvent.click(
      screen.getByRole("button", { name: "I am a nurse and I need an employment letter." }),
    );
    expect(activeInput(/Employee name/).value).toBe("");
  });
  it("Download PDF works from the button", async () => {
    runLetter();
    chip("Confirm");
    await waitFor(() => expect(screen.getByRole("button", { name: /Download PDF/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    const res = await vi.mocked(letterPdf).mock.results[0]!.value;
    expect(res.save).toHaveBeenCalled();
  });
  it("answers policy questions about the letter directly, with a chip into the letter flow", () => {
    startFromRow("Can the letter include my salary and hours?");
    expect(hasQuote("EL-2.1")).toBe(true);
    expect(screen.queryByTestId("letter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start an employment letter" }));
    expect(screen.getByTestId("intro-card")).toBeInTheDocument();
    expect(screen.getByLabelText(/Employee name/)).toBeInTheDocument();
  });
  it("immigration and mortgage question shows EL-3.1 and EL-2.3", () => {
    startFromRow("Can HR customize the letter for immigration or a mortgage?");
    expect(hasQuote("EL-3.1")).toBe(true);
    expect(hasQuote("EL-2.3")).toBe(true);
  });
  it("casual employees get a check-with-People-Operations caution", () => {
    startFromRow("I am a nurse and I need an employment letter.");
    fill(/Employee name/, "Pat Lee");
    next();
    next();
    next();
    chip("Casual");
    fill(/Start date/, "2024-01-15");
    next();
    chip("Mortgage");
    next(); // include nothing
    chip("To whom it may concern");
    expect(
      screen.getByText("Check with People Operations: the procedure covers current employees."),
    ).toBeInTheDocument();
  });
});

describe("Flow C: benefits and compensation", () => {
  it("dependant: 31 days is inside the window and 32 days is not", async () => {
    startFromRow("How do I add my newborn to my benefits?");
    fill(/Date of life event/, addDays(today(), -31));
    next();
    chip("Full-time");
    expect(screen.getByText("within 31 days")).toBeInTheDocument();
    chip("Confirm");
    expect(
      screen.getByText("The life event was 31 days ago, so the standard route applies."),
    ).toBeInTheDocument();
    for (const id of ["BC-1.1", "BC-1.2", "BC-1.3"]) expect(hasQuote(id)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Download form: Benefits change form/ }));
    await waitFor(() => expect(downloadForm).toHaveBeenCalledWith("benefits"));
    cleanup();
    startFromRow("How do I add my newborn to my benefits?");
    fill(/Date of life event/, addDays(today(), -32));
    next();
    chip("Full-time");
    expect(screen.getByText("after 31 days")).toBeInTheDocument();
    chip("Confirm");
    expect(
      screen.getByText(
        "The life event was 32 days ago, so the insurer's underwriting route applies.",
      ),
    ).toBeInTheDocument();
  });
  it("next step increase", () => {
    startFromRow("When is my next step increase?");
    fill(/Anniversary date/, "2019-03-04");
    next();
    chip("Full-time");
    expect(screen.getByText("Next anniversary")).toBeInTheDocument();
    chip("Confirm");
    expect(hasQuote("BC-2.1")).toBe(true);
    expect(screen.getByText(/Next step increase takes effect on/)).toBeInTheDocument();
  });
  it("transfer: $46.00 into Band 4 is Step 2 at $47.50, with the band table", () => {
    startFromRow("If I transfer to this role, what would my rate be?");
    fill(/Current hourly rate/, "46.00");
    next();
    chip("Band 4");
    chip("Confirm");
    expect(screen.getByText("Placed at Step 2 of Band 4: $47.50 per hour.")).toBeInTheDocument();
    expect(hasQuote("BC-2.2")).toBe(true);
    expect(screen.getByText("Pay band table (synthetic sample)")).toBeInTheDocument();
  });
  it("transfer: a rate above the top step says to check with Total Rewards", () => {
    startFromRow("If I transfer to this role, what would my rate be?");
    fill(/Current hourly rate/, "60");
    next();
    chip("Band 4");
    chip("Confirm");
    expect(
      screen.getByText("The current rate is above the top step, so check with Total Rewards."),
    ).toBeInTheDocument();
  });
  it("transfer: a bad rate is rejected with a message", () => {
    startFromRow("If I transfer to this role, what would my rate be?");
    fill(/Current hourly rate/, "abc");
    next();
    expect(screen.getByText("Enter a number, for example 46.00.")).toBeInTheDocument();
  });
  it("pension enrolment: clauses, the form download, and the casual caution", async () => {
    startFromRow("How do I enrol in the pension plan?");
    chip("Full-time");
    chip("Confirm");
    expect(hasQuote("BC-3.1")).toBe(true);
    expect(hasQuote("BC-3.2")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Download form: Pension enrolment form/ }));
    await waitFor(() => expect(downloadForm).toHaveBeenCalledWith("pension"));
    cleanup();
    startFromRow("How do I enrol in the pension plan?");
    chip("Casual");
    expect(
      screen.getByText(
        /Casual employees are not eligible\. Check with People Operations before replying\./,
      ),
    ).toBeInTheDocument();
    chip("Confirm");
    expect(
      screen.getByText(/Casual employees are not eligible for the pension plan/),
    ).toBeInTheDocument();
  });
  it("benefits topics link to each other with related questions", () => {
    startFromRow("How do I enrol in the pension plan?");
    chip("Full-time");
    chip("Confirm");
    fireEvent.click(screen.getByRole("button", { name: "When is my next step increase?" }));
    expect(screen.getAllByTestId("you-message").at(-1)).toHaveTextContent(
      "When is my next step increase?",
    );
    expect(activeInput(/Anniversary date/)).toBeTruthy();
  });
});

describe("answer card buttons", () => {
  it("draft reply, copy draft and feedback buttons all work", async () => {
    startFromRow("How do I enrol in the pension plan?");
    chip("Full-time");
    chip("Confirm");
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: /Draft reply/ }));
    fireEvent.click(screen.getByRole("button", { name: /Copy draft/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(String(writeText.mock.calls[0]![0])).toContain(
      "Benefits and Compensation Guide, BC-3.1, BC-3.2",
    );
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    for (const n of ["Correct", "Wrong clause", "Missing something"])
      expect(screen.getByRole("button", { name: n })).toBeDisabled();
  });
  it("routing feedback buttons work on a routed answer", () => {
    page();
    ask("employee grievance");
    expect(screen.getByText("Labour Relations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wrong team" }));
    for (const n of ["Correct", "Should have answered", "Wrong team"])
      expect(screen.getByRole("button", { name: n })).toBeDisabled();
  });
  it("a help desk ticket starts a conversation", () => {
    page();
    const row = screen
      .getAllByRole("button")
      .find((b) => /HR-\d{6}-\d{4}/.test(b.textContent ?? ""))!;
    fireEvent.click(row);
    expect(screen.getByText("Synthetic help desk inquiry")).toBeInTheDocument();
  });
});

describe("redaction and privacy", () => {
  it("removes employee IDs, emails and phone numbers from typed questions", () => {
    page();
    ask("E0123 at jane@example.com 519-555-0100 asks about annual leave for part-time");
    const you = screen.getByTestId("you-message").textContent ?? "";
    expect(you).toContain("[employee ID removed]");
    expect(you).toContain("[email removed]");
    expect(you).toContain("[phone number removed]");
    expect(you).not.toContain("E0123");
    expect(screen.getByText(/Personal details were removed before processing/)).toBeInTheDocument();
  });
  it("redacts typed answers to ordinary steps, but not the private name step", () => {
    startFromRow("I am a nurse and I need an employment letter.");
    reply("Jane Doe");
    expect(screen.getAllByTestId("advisor-reply").at(-1)).toHaveTextContent(
      "Employee name entered (kept in this browser only)",
    );
    expect(bodyText()).not.toContain("Jane Doe Jane");
  });
});

describe("error boundary", () => {
  function Boom(): ReactNode {
    throw new Error("boom");
  }
  it("shows a message with Try again and New inquiry, and logs to the console", () => {
    const onNew = vi.fn();
    render(
      <TurnBoundary onNew={onNew}>
        <Boom />
      </TurnBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong with this answer. Try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "New inquiry" }));
    expect(onNew).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(consoleErrors).toHaveBeenCalled();
    consoleErrors.mockClear(); // the error was expected here
    windowErrors.length = 0;
  });
});
