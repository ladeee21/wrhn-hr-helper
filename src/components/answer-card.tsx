import { useState } from "react";
import { Check, CheckCircle2, ChevronDown, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clauseById, policyByFile, type Clause, type Ticket } from "@/lib/hr-research-data";
import { SYNTHETIC_TAG } from "@/lib/hr-flow-data";
import { formTitles, type FlowAnswer, type FlowState, type Section } from "@/lib/hr-flow-engine";
import { useHrResearch } from "@/lib/hr-research-context";
import { newId } from "@/lib/utils";

export function legacyAnswer(clause: Clause): FlowAnswer {
  const p = policyByFile(clause.policyFile);
  return {
    sections: [{ clauseId: clause.id }],
    related: (clause.related ?? []).map((q) => ({ label: q, ask: q })),
    draft: `Hello [employee name],\n\nI checked ${p?.title}, ${clause.ref}. It states:\n\n“${clause.text}”\n\n[your answer for this employee's situation]\n\nPlease let me know if any of the facts above are not correct.`,
  };
}

export function QuoteBlock({ section }: { section: Section }) {
  const c = clauseById(section.clauseId);
  const p = c && policyByFile(c.policyFile);
  if (!c || !p) return null;
  return (
    <div className="border-b last:border-b-0">
      <div className="px-5 py-6 sm:px-7">
        {section.label && <h3 className="mb-3 text-sm font-semibold">{section.label}</h3>}
        <blockquote className="max-w-[70ch] border-l-4 border-primary pl-5 font-serif text-xl leading-[1.6]">“{c.text}”</blockquote>
        {c.tableRow && <p className="mt-2 pl-6 text-xs text-muted-foreground">Row from a table in the source.</p>}
        {c.note && <p className="mt-3 bg-muted px-4 py-3 text-sm text-muted-foreground">{c.note}</p>}
      </div>
      <div className="grid border-t bg-muted/40 sm:grid-cols-2 lg:grid-cols-5">
        {[["Document", p.file], ["Clause reference", c.ref], ["Version", p.version], ["Effective date", p.effectiveDate]].map(([a, b]) => (
          <div className="border-b p-4 sm:border-r lg:border-b-0" key={a}><div className="text-xs text-muted-foreground">{a}</div><div className="mt-1 break-words text-sm font-medium">{b}</div></div>
        ))}
        <div className="p-4"><div className="text-xs text-muted-foreground">Source link</div><Button disabled variant="link" className="h-auto whitespace-normal p-0 text-left text-sm">Open source (not available in prototype)</Button></div>
      </div>
    </div>
  );
}

export function AnswerCard({ answer, question, ticket, onAsk, onState }: { answer: FlowAnswer; question: string; ticket?: Ticket | undefined; onAsk: (q: string) => void; onState?: ((s: FlowState, label: string) => void) | undefined }) {
  const { addReview, addCheck } = useHrResearch();
  const [feedback, setFeedback] = useState<string>();
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState(answer.draft ?? "");
  const clauses = answer.sections.map((s) => clauseById(s.clauseId)).filter((c): c is Clause => !!c);
  const p = clauses[0] && policyByFile(clauses[0].policyFile);
  if (!p) return null;
  const synthetic = !!p.synthetic;
  const result = ticket ? (ticket.candidateLabel === p.file ? "Match" : "Different") : undefined;
  const refs = clauses.map((c) => c.ref).join("; ");
  const give = (choice: string) => {
    setFeedback(choice);
    if (ticket) addCheck({ id: `${ticket.id}-${p.file}`, ticketId: ticket.id, ticketLabel: ticket.candidateLabel ?? "none", retrievedPolicy: p.file, result: result ?? "Different" });
    if (choice !== "Correct") addReview({ id: newId(), question: ticket ? `${ticket.subject} (${ticket.id})` : question, verdict: choice, clause: refs, date: new Date().toISOString().slice(0, 10), status: "Open" });
    toast("Thanks. Flagged answers go to the review queue.");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); toast("Draft copied."); } catch { toast("Copy is not available here. Select the text and copy it."); }
  };
  const getForm = async (id: Parameters<typeof import("@/lib/hr-pdf").downloadForm>[0]) => {
    try { const { downloadForm } = await import("@/lib/hr-pdf"); await downloadForm(id); toast("Sample form downloaded."); } catch (e) { console.error(e); toast("The form could not be created. Try again."); }
  };
  return (
    <article className="border bg-card" data-testid="answer-card">
      <div className="border-b px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{p.title}</h2><span className="rounded-full bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">{synthetic ? SYNTHETIC_TAG : "Synthetic dataset"}</span></div>
      </div>
      {answer.sections.map((s) => <QuoteBlock key={s.clauseId} section={s} />)}
      <div className="space-y-3 border-t px-5 py-5 sm:px-7">
        <p className="flex items-center gap-2 text-sm font-medium text-verified"><CheckCircle2 className="size-4" />{clauses.length > 1 ? "Quotes match the stored text word for word." : "Quote matches the stored text word for word."}</p>
        {!synthetic && <p className="border-l-4 border-caution bg-caution-soft px-4 py-3 text-sm text-caution">This source does not state an effective date. HR needs to confirm one before you rely on it.</p>}
        {answer.cautions?.map((c) => <p key={c} className="border-l-4 border-caution bg-caution-soft px-4 py-3 text-sm text-caution">{c}</p>)}
        {!!answer.computed?.length && <div className="bg-verified-soft px-4 py-3 text-sm"><div className="text-xs font-semibold text-verified">Calculated from your answers</div>{answer.computed.map((c) => <p key={c} className="mt-1">{c}</p>)}</div>}
        {answer.table && <div className="overflow-x-auto"><table className="w-full border text-sm"><caption className="py-2 text-left text-xs text-muted-foreground">{answer.table.caption}</caption><thead><tr>{answer.table.head.map((h) => <th key={h} className="border-b bg-muted px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead><tbody>{answer.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className="border-b px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>}
        {!!answer.forms?.length && <div className="flex flex-wrap gap-2">{answer.forms.map((f) => <Button key={f} variant="outline" onClick={() => getForm(f)}><Download />Download form: {formTitles[f]}</Button>)}</div>}
        {ticket && <div className="border-y py-3 text-sm"><strong>Dataset check</strong><p>Ticket label: {ticket.candidateLabel ?? "none"}. Retrieved: {p.file}. <span className={result === "Match" ? "text-verified" : "text-caution"}>{result}.</span>{result === "Different" && " Needs manual review before this is used for scoring."}</p></div>}
        {answer.draft && <>
          <button className="flex w-full items-center justify-between py-2 text-left font-semibold" onClick={() => setDraftOpen((v) => !v)} aria-expanded={draftOpen}>Draft reply<ChevronDown className={`size-4 ${draftOpen ? "rotate-180" : ""}`} /></button>
          {draftOpen && <div><label htmlFor={`draft-${refs}`} className="sr-only">Draft reply</label><Textarea id={`draft-${refs}`} value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-56" /><div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={copy}><Copy />Copy draft</Button><span className="text-xs text-muted-foreground">The assistant does not send email. Review the draft and send it from your own email.</span></div></div>}
        </>}
        {!!answer.related?.length && <div><h3 className="text-sm font-semibold">Related questions</h3><div className="mt-2 flex flex-wrap gap-2">{answer.related.slice(0, 3).map((x) => <Button key={x.label} variant="outline" size="sm" className="h-auto whitespace-normal py-2 text-left" onClick={() => (x.state && onState ? onState(x.state, x.label) : onAsk(x.ask ?? x.label))}>{x.label}</Button>)}</div></div>}
        <div className="border-t pt-4">
          <div className="flex flex-wrap items-center gap-2"><strong className="mr-2 text-sm">Was this the right clause?</strong>{["Correct", "Wrong clause", "Missing something"].map((x) => <Button key={x} size="sm" variant={feedback === x ? "secondary" : "outline"} disabled={!!feedback} onClick={() => give(x)}>{feedback === x && <Check />}{x}</Button>)}</div>
          <span className="mt-2 block text-xs text-muted-foreground">AI-assisted answer</span>
        </div>
      </div>
    </article>
  );
}
