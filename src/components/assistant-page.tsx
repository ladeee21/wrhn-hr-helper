import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnswerCard, QuoteBlock, legacyAnswer } from "@/components/answer-card";
import { ConfirmCard, LetterPreview, StepWidget, TurnBoundary } from "@/components/flow-widgets";
import { todayISO } from "@/lib/hr-flow-calc";
import {
  advance,
  answerStep,
  changeState,
  confirmState,
  flowIntro,
  flows,
  stepOptions,
  type AnswerResult,
  type ConfirmRow,
  type FlowAnswer,
  type FlowState,
  type Option,
  type Outcome as FlowOutcome,
  type Step,
  type Value,
} from "@/lib/hr-flow-engine";
import { inboxGroups } from "@/lib/hr-inbox-groups";
import { useHrResearch } from "@/lib/hr-research-context";
import { tickets, policyByFile, clauseById, type Ticket } from "@/lib/hr-research-data";
import { answerFollowUp, matchQuestion, redact, type Result } from "@/lib/hr-research-matcher";
import { newId } from "@/lib/utils";

// ---------- turn model ----------
type LogItem =
  | { kind: "step"; step: Step; options: Option[]; value: Value | undefined; display: string }
  | { kind: "confirm"; rows: ConfirmRow[]; cautions: string[]; choice: "Confirm" | "Change" };
type Base = { id: string; user: string; removed: boolean; ticket?: Ticket | undefined };
type LegacyTurn = Base & { type: "legacy"; result: Exclude<Result, { kind: "flow" }> };
type DirectTurn = Base & { type: "direct"; answer: FlowAnswer };
type FlowTurn = Base & {
  type: "flow";
  state: FlowState;
  log: LogItem[];
  error?: string | undefined;
};
type Turn = LegacyTurn | DirectTurn | FlowTurn;
type ClarifyResult = Extract<Result, { kind: "clarify" }>;
type RoutedResult = Extract<Result, { kind: "routed" | "no-clause" }>;

const checkSteps = [
  "Removed personal details.",
  "Matched the topic.",
  "Checked what context is needed.",
  "Searched the approved policies",
  "Found candidate clauses.",
  "Confirmed the quote matches the stored text word for word.",
  "Checked the version and effective date.",
];

export function Checking() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 1200);
    return () => clearTimeout(id);
  }, []);
  return (
    <details open={!done} className="mb-4 border-y py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-route">How this was checked</summary>
      {!done && (
        <ol className="mt-3 space-y-2 text-muted-foreground">
          {checkSteps.map((s, i) => (
            <li
              key={s}
              className="flex items-start gap-2"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <Check className="mt-0.5 size-4 text-verified" />
              <span>
                {s}
                {s === "Searched the approved policies" && (
                  <small className="block">21 sources searched; clause text loaded for 8</small>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

// ---------- small presentational pieces ----------
function YouBubble({ text }: { text: string }) {
  return (
    <div
      className="ml-auto max-w-[680px] rounded-md bg-route px-5 py-4 text-primary-foreground"
      data-testid="you-message"
    >
      <div className="mb-1 text-xs font-semibold opacity-80">You</div>
      <p>{text}</p>
    </div>
  );
}

function AdvisorReply({ text }: { text: string }) {
  return (
    <div
      className="ml-auto mt-3 w-fit max-w-[680px] rounded-md bg-route px-4 py-2 text-sm text-primary-foreground"
      data-testid="advisor-reply"
    >
      {text}
    </div>
  );
}

function Clarify({
  result,
  active,
  onReply,
}: {
  result: ClarifyResult;
  active: boolean;
  onReply: (x: string) => void;
}) {
  return (
    <div className="bg-route-soft px-5 py-5" data-testid="clarify">
      <h2 className="font-semibold text-route">{result.prompt.question}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.prompt.options.map((o) => (
          <Button
            key={o.label}
            variant="outline"
            size="sm"
            disabled={!active}
            onClick={() => onReply(o.label)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {active && (
        <p className="mt-3 text-sm text-muted-foreground">Tap a reply or type it below.</p>
      )}
    </div>
  );
}

function RoutedCard({
  result,
  ticket,
  question,
}: {
  result: RoutedResult;
  ticket?: Ticket | undefined;
  question: string;
}) {
  const { addReview, addCheck } = useHrResearch();
  const [feedback, setFeedback] = useState<string>();
  const routed = result.kind === "routed";
  const options = ["Correct", "Should have answered", "Wrong team"];
  const different = !!ticket?.candidateLabel;
  useEffect(() => {
    if (ticket?.candidateLabel)
      addCheck({
        id: `${ticket.id}-none`,
        ticketId: ticket.id,
        ticketLabel: ticket.candidateLabel,
        retrievedPolicy: "none (no clause)",
        result: "Different",
      });
  }, [ticket, addCheck]);
  return (
    <div className="bg-route-soft px-5 py-5" data-testid="routed">
      <h2 className="text-lg font-semibold text-route">
        {routed ? "I can't answer this one." : "No approved source covers this question."}
      </h2>
      <p className="mt-2">{result.reason}</p>
      <div className="mt-4 border-t border-route/20 pt-4">
        <span className="text-sm text-muted-foreground">Route this to:</span>
        <strong className="block text-lg">{result.team}</strong>
        {routed && <p className="mt-1 text-sm">{result.instruction}</p>}
      </div>
      {!routed && result.caution && (
        <p className="mt-4 text-sm text-muted-foreground">{result.caution}</p>
      )}
      {different && (
        <p className="mt-4 text-sm text-muted-foreground">
          Ticket label: {ticket?.candidateLabel}. The labelled policy has no clause for this, so the
          label may be wrong. Flagged for manual review.
        </p>
      )}
      <div className="mt-5 border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="mr-2 text-sm">Was routing this the right call?</strong>
          {options.map((x) => (
            <Button
              key={x}
              size="sm"
              variant={feedback === x ? "secondary" : "outline"}
              disabled={!!feedback}
              onClick={() => {
                setFeedback(x);
                if (x !== "Correct")
                  addReview({
                    id: newId(),
                    question: ticket ? `${ticket.subject} (${ticket.id})` : question,
                    verdict: x,
                    clause: "No clause",
                    date: todayISO(),
                    status: "Open",
                  });
                toast("Thanks. Flagged answers go to the review queue.");
              }}
            >
              {x}
            </Button>
          ))}
        </div>
        <span className="mt-2 block text-xs text-muted-foreground">AI-assisted answer</span>
      </div>
    </div>
  );
}

function IntroCard({ flowId }: { flowId: FlowState["flowId"] }) {
  const sections = flowIntro(flowId);
  if (!sections?.length) return null;
  const first = clauseById(sections[0]!.clauseId);
  const p = first && policyByFile(first.policyFile);
  if (!p) return null;
  return (
    <article className="mb-4 border bg-card" data-testid="intro-card">
      <div className="border-b px-5 py-4 sm:px-7">
        <h2 className="text-xl font-semibold">{p.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The governing procedure comes first. I will ask a few questions next.
        </p>
      </div>
      {sections.map((s) => (
        <QuoteBlock key={s.clauseId} section={s} />
      ))}
    </article>
  );
}

/** "What I know so far": answered values, minus anything private (names and IDs stay out of the thread). */
function KnownChips({ state }: { state: FlowState }) {
  const flow = flows[state.flowId];
  const items = Object.entries(state.values).flatMap(([key, val]) => {
    const step = flow.steps.find((s) => s.key === key);
    if (!step || step.private || val === undefined) return [];
    const text = Array.isArray(val) ? (val.length ? val.join(", ") : "None") : val;
    return text ? [{ key, label: step.label, text }] : [];
  });
  if (!items.length) return null;
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 border-y py-2 text-sm"
      data-testid="known-so-far"
    >
      <span className="font-semibold">What I know so far:</span>
      {items.map((i) => (
        <span key={i.key} className="rounded-full bg-muted px-2 py-1">
          {i.label}: {i.text}
        </span>
      ))}
    </div>
  );
}

type FlowHandlers = {
  onAnswer: (turn: FlowTurn, step: Step, v: Value) => void;
  onConfirm: (turn: FlowTurn, out: Extract<FlowOutcome, { type: "confirm" }>) => void;
  onChange: (turn: FlowTurn, out: Extract<FlowOutcome, { type: "confirm" }>) => void;
  onAsk: (q: string) => void;
  onState: (s: FlowState, label: string) => void;
};

function FlowThread({
  turn,
  active,
  today,
  h,
}: {
  turn: FlowTurn;
  active: boolean;
  today: string;
  h: FlowHandlers;
}) {
  // Memoised so the letter data keeps the same identity and the PDF is built once per answer.
  const outcome = useMemo(() => advance(turn.state, today), [turn.state, today]);
  return (
    <>
      <Checking />
      <IntroCard flowId={turn.state.flowId} />
      <KnownChips state={turn.state} />
      {turn.log.map((item, i) =>
        item.kind === "step" ? (
          <div key={i} className="mb-3">
            <StepWidget
              step={item.step}
              options={item.options}
              defaultValue={item.step.private ? undefined : item.value}
              active={false}
              onAnswer={() => {}}
            />
            <AdvisorReply text={item.display} />
          </div>
        ) : (
          <div key={i} className="mb-3">
            <ConfirmCard
              rows={item.rows}
              cautions={item.cautions}
              active={false}
              onConfirm={() => {}}
              onChange={() => {}}
            />
            <AdvisorReply text={item.choice} />
          </div>
        ),
      )}
      {outcome.type === "step" && (
        <StepWidget
          key={`${turn.id}-${outcome.step.key}-${turn.log.length}`}
          step={outcome.step}
          options={stepOptions(outcome.step, turn.state.values)}
          defaultValue={outcome.defaultValue}
          error={active ? turn.error : undefined}
          active={active}
          onAnswer={(v) => h.onAnswer(turn, outcome.step, v)}
        />
      )}
      {outcome.type === "confirm" && (
        <ConfirmCard
          key={`${turn.id}-confirm-${turn.log.length}`}
          rows={outcome.rows}
          cautions={outcome.cautions}
          active={active}
          onConfirm={() => h.onConfirm(turn, outcome)}
          onChange={() => h.onChange(turn, outcome)}
        />
      )}
      {outcome.type === "routed" && (
        <RoutedCard
          result={{ kind: "routed", ...outcome.routed }}
          ticket={turn.ticket}
          question={turn.user}
        />
      )}
      {outcome.type === "result" && (
        <>
          <Checking />
          {outcome.answer.letter && <LetterPreview data={outcome.answer.letter} />}
          <AnswerCard
            answer={outcome.answer}
            question={turn.user}
            ticket={turn.ticket}
            onAsk={h.onAsk}
            onState={h.onState}
          />
        </>
      )}
    </>
  );
}

function AskBox({
  value,
  setValue,
  submit,
}: {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
}) {
  return (
    <div className="mt-9 rounded-lg border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
      <label htmlFor="question" className="sr-only">
        HR policy question
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id="question"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Ask a question, for example: How many days of annual leave does a part-time employee get?"
          className="min-h-28 resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <Button className="mb-1" onClick={submit} disabled={!value.trim()}>
          Ask
          <ArrowRight />
        </Button>
      </div>
      <p className="px-3 pb-2 text-xs text-muted-foreground">
        Do not include names or employee IDs. They are removed before processing.
      </p>
    </div>
  );
}

// ---------- the page ----------
export function AssistantPage() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<ClarifyResult | null>(null);
  const [ticket, setTicket] = useState<Ticket>();
  const bottom = useRef<HTMLDivElement>(null);
  const today = useMemo(() => todayISO(), []);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [turns]);

  const append = (t: Turn) => setTurns((v) => [...v, t]);
  const patch = (id: string, fn: (t: FlowTurn) => FlowTurn) =>
    setTurns((v) => v.map((t) => (t.id === id && t.type === "flow" ? fn(t) : t)));

  const record = (text: string, removed: boolean, result: Result, activeTicket?: Ticket) => {
    const base: Base = { id: newId(), user: text, removed, ticket: activeTicket };
    if (result.kind === "flow") {
      const d = result.detection;
      append(
        d.kind === "flow"
          ? { ...base, type: "flow", state: d.state, log: [] }
          : { ...base, type: "direct", answer: d.answer },
      );
      setPending(null);
    } else {
      append({ ...base, type: "legacy", result });
      setPending(result.kind === "clarify" ? result : null);
    }
  };

  const applyAnswer = (turn: FlowTurn, step: Step, res: Extract<AnswerResult, { ok: true }>) =>
    patch(turn.id, (t) => ({
      ...t,
      state: res.state,
      error: undefined,
      log: [
        ...t.log,
        {
          kind: "step",
          step,
          options: stepOptions(step, t.state.values),
          value: res.state.values[step.key],
          display: res.display,
        },
      ],
    }));

  const answerWidget = (turn: FlowTurn, step: Step, v: Value) => {
    const val = typeof v === "string" && step.type === "text" && !step.private ? redact(v).text : v;
    const res = answerStep(turn.state, step, val);
    if (res.ok) applyAnswer(turn, step, res);
    else patch(turn.id, (t) => ({ ...t, error: res.error }));
  };
  const confirm = (turn: FlowTurn, out: Extract<FlowOutcome, { type: "confirm" }>) =>
    patch(turn.id, (t) => ({
      ...t,
      state: confirmState(t.state),
      error: undefined,
      log: [
        ...t.log,
        { kind: "confirm", rows: out.rows, cautions: out.cautions, choice: "Confirm" },
      ],
    }));
  const change = (turn: FlowTurn, out: Extract<FlowOutcome, { type: "confirm" }>) =>
    patch(turn.id, (t) => ({
      ...t,
      state: changeState(t.state),
      error: undefined,
      log: [
        ...t.log,
        { kind: "confirm", rows: out.rows, cautions: out.cautions, choice: "Change" },
      ],
    }));

  /** A typed reply goes to the active step when it fits; anything that looks like a new question starts a new turn. */
  const replyToFlow = (turn: FlowTurn, raw: string): boolean => {
    const out = advance(turn.state, today);
    if (out.type === "step") {
      if (raw.includes("?")) return false;
      const res = answerStep(turn.state, out.step, out.step.private ? raw : redact(raw).text);
      if (res.ok) {
        applyAnswer(turn, out.step, res);
        return true;
      }
      if (matchQuestion(redact(raw).text).kind !== "no-clause") return false;
      patch(turn.id, (t) => ({ ...t, error: res.error }));
      return true;
    }
    if (out.type === "confirm") {
      const t = raw.toLowerCase();
      if (/^(confirm|yes|correct|ok|okay|looks good)\b/.test(t)) {
        confirm(turn, out);
        return true;
      }
      if (/^(change|edit|no)\b/.test(t)) {
        change(turn, out);
        return true;
      }
    }
    return false;
  };

  const submit = (value = input, fromTicket?: Ticket) => {
    const raw = value.trim();
    if (!raw) return;
    const last = turns[turns.length - 1];
    if (!fromTicket && last?.type === "flow" && replyToFlow(last, raw)) {
      setInput("");
      return;
    }
    const r = redact(raw);
    const result = pending ? answerFollowUp(pending, r.text) : matchQuestion(r.text);
    record(r.text, r.changed, result, fromTicket ?? ticket);
    setInput("");
  };

  const startTicket = (t: Ticket) => {
    setTurns([]);
    setPending(null);
    setTicket(t);
    submit(`${t.subject}. ${t.description}`, t);
  };
  const startFromState = (state: FlowState, label: string) => {
    append({ id: newId(), type: "flow", user: label, removed: false, state, log: [] });
    setPending(null);
  };
  const reset = () => {
    setTurns([]);
    setPending(null);
    setTicket(undefined);
    setInput("");
  };

  const handlers: FlowHandlers = {
    onAnswer: answerWidget,
    onConfirm: confirm,
    onChange: change,
    onAsk: (q) => submit(q),
    onState: startFromState,
  };

  if (!turns.length) {
    return (
      <main className="px-4 py-12 sm:py-18">
        <div className="mx-auto max-w-[760px]">
          <div className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Search />
            </div>
            <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">
              What do you need to look up?
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
              Ask about an HR policy. I will find the governing clause and show exactly where it
              comes from.
            </p>
          </div>
          <AskBox value={input} setValue={setInput} submit={() => submit()} />
          <section className="mt-14" aria-labelledby="inbox-heading">
            <h2 id="inbox-heading" className="text-lg font-semibold">
              Common inquiries from the HR inbox
            </h2>
            <div className="mt-4 space-y-7">
              {inboxGroups.map((g) => (
                <div key={g.title}>
                  <h3 className="text-sm font-semibold">{g.title}</h3>
                  <div className="mt-2 divide-y border-y">
                    {g.questions.map((q) => (
                      <button
                        key={q}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left text-primary hover:underline"
                        onClick={() => submit(q)}
                      >
                        {q}
                        <ArrowRight className="size-4 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="mt-12">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Recent help desk inquiries
            </h2>
            <div className="mt-2 divide-y border-y">
              {tickets.slice(0, 8).map((t) => (
                <button
                  key={t.id}
                  onClick={() => startTicket(t)}
                  className="grid w-full gap-1 py-2 text-left text-sm hover:bg-accent sm:grid-cols-[135px_1fr_auto] sm:items-center sm:px-2"
                >
                  <span className="text-xs text-muted-foreground">{t.id}</span>
                  <span>
                    <strong className="block text-sm font-medium">{t.subject}</strong>
                    <small className="text-muted-foreground">{t.department}</small>
                  </span>
                  <span className="w-fit rounded-full bg-muted px-2 py-1 text-xs text-route">
                    {t.status}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <p className="mt-12 border-t pt-5 text-sm text-muted-foreground">
            Answers are AI-assisted. Check the source before you send anything to an employee.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-40">
      <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Policy research</p>
            <h1 className="text-2xl font-semibold">Inquiry conversation</h1>
          </div>
          <Button variant="outline" onClick={reset}>
            New inquiry
          </Button>
        </div>
        {ticket && (
          <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 border-y bg-muted/40 px-3 py-3 text-sm">
            <strong>{ticket.id}</strong>
            <span>{ticket.subject}</span>
            <span>{ticket.department}</span>
            <span>{ticket.status}</span>
            <span className="text-muted-foreground">Synthetic help desk inquiry</span>
          </div>
        )}
        <div className="space-y-9">
          {turns.map((turn, index) => {
            const isLast = index === turns.length - 1;
            return (
              <div key={turn.id}>
                <YouBubble text={turn.user} />
                {turn.removed && (
                  <p className="ml-auto mt-2 max-w-[680px] text-xs text-muted-foreground">
                    <ShieldCheck className="mr-1 inline size-3" />
                    Personal details were removed before processing. Names and employee IDs are
                    never stored.
                  </p>
                )}
                <div className="mt-6">
                  <TurnBoundary onNew={reset}>
                    {turn.type === "flow" && (
                      <FlowThread turn={turn} active={isLast} today={today} h={handlers} />
                    )}
                    {turn.type === "direct" && (
                      <>
                        <Checking />
                        <AnswerCard
                          answer={turn.answer}
                          question={turn.user}
                          ticket={turn.ticket}
                          onAsk={(q) => submit(q)}
                        />
                      </>
                    )}
                    {turn.type === "legacy" && (
                      <>
                        <Checking />
                        {turn.result.kind === "clarify" && (
                          <Clarify
                            result={turn.result}
                            active={isLast && pending === turn.result}
                            onReply={(x) => submit(x)}
                          />
                        )}
                        {turn.result.kind === "answered" && (
                          <>
                            {turn.result.context && Object.keys(turn.result.context).length > 0 && (
                              <div className="mb-3 flex flex-wrap items-center gap-2 border-y py-2 text-sm">
                                <span className="font-semibold">What I know so far:</span>
                                {Object.entries(turn.result.context).map(([k, v]) => (
                                  <span key={k} className="rounded-full bg-muted px-2 py-1">
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                            )}
                            <AnswerCard
                              answer={legacyAnswer(turn.result.clause)}
                              question={turn.user}
                              ticket={turn.ticket}
                              onAsk={(q) => submit(q)}
                            />
                          </>
                        )}
                        {(turn.result.kind === "routed" || turn.result.kind === "no-clause") && (
                          <RoutedCard
                            result={turn.result}
                            ticket={turn.ticket}
                            question={turn.user}
                          />
                        )}
                      </>
                    )}
                  </TurnBoundary>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottom} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-[820px]">
          <label htmlFor="reply" className="sr-only">
            Reply to the assistant or ask another question
          </label>
          <div className="flex gap-2">
            <Textarea
              id="reply"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Reply to the assistant or ask another question"
              className="min-h-12 resize-none"
            />
            <Button className="h-12" onClick={() => submit()} disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
