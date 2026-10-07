import { Component, useEffect, useId, useState, type ErrorInfo, type ReactNode } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LetterData } from "@/lib/hr-flow-calc";
import type { ConfirmRow, Option, Step, Value } from "@/lib/hr-flow-engine";

export function StepWidget({ step, options, defaultValue, error, active, onAnswer }: { step: Step; options: Option[]; defaultValue?: Value | undefined; error?: string | undefined; active: boolean; onAnswer: (v: Value) => void }) {
  const id = useId();
  const [text, setText] = useState(typeof defaultValue === "string" ? defaultValue : "");
  const [picked, setPicked] = useState<string[]>(Array.isArray(defaultValue) ? defaultValue : []);
  const go = () => active && onAnswer(step.type === "multi" ? picked : text);
  return (
    <div className="bg-route-soft px-5 py-5" data-testid="step">
      <h2 className="font-semibold text-route">{error ?? step.question}</h2>
      {error && <p className="mt-1 text-sm">{step.question}</p>}
      {step.type === "choice" && <div className="mt-4 flex flex-wrap gap-2">{options.map((o) => <Button key={o.label} variant={defaultValue === o.label ? "secondary" : "outline"} size="sm" disabled={!active} onClick={() => onAnswer(o.label)}>{o.label}</Button>)}</div>}
      {(step.type === "text" || step.type === "date" || step.type === "number") && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1"><label htmlFor={id} className="mb-1 block text-sm font-medium">{step.label}{step.optional ? " (optional)" : ""}</label>
            <Input id={id} type={step.type === "text" ? "text" : step.type} inputMode={step.type === "number" ? "decimal" : undefined} step={step.type === "number" ? "0.01" : undefined} value={text} placeholder={step.placeholder} disabled={!active} autoComplete="off" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} className="bg-card" />
          </div>
          <Button disabled={!active} onClick={go}>Continue</Button>
        </div>
      )}
      {step.type === "multi" && (
        <fieldset className="mt-4" disabled={!active}><legend className="sr-only">{step.label}</legend>
          <div className="flex flex-col gap-2">{options.map((o) => <label key={o.label} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={picked.includes(o.label)} onChange={(e) => setPicked((v) => (e.target.checked ? [...v, o.label] : v.filter((x) => x !== o.label)))} />{o.label}</label>)}</div>
          <Button className="mt-3" onClick={go}>Continue</Button>
        </fieldset>
      )}
      {step.help && <p className="mt-3 text-sm text-muted-foreground">{step.help}</p>}
      {active && <p className="mt-3 text-sm text-muted-foreground">{step.type === "choice" ? "Tap a reply or type it below." : "You can also type the answer below."}</p>}
    </div>
  );
}

export function ConfirmCard({ rows, cautions, active, onConfirm, onChange }: { rows: ConfirmRow[]; cautions: string[]; active: boolean; onConfirm: () => void; onChange: () => void }) {
  return (
    <div className="border bg-card" data-testid="confirm">
      <h2 className="border-b px-5 py-4 font-semibold">Check these details before I answer</h2>
      <dl className="divide-y px-5">{rows.map((r) => <div key={r.label} className="grid gap-1 py-3 text-sm sm:grid-cols-[200px_1fr]"><dt className="text-muted-foreground">{r.label}</dt><dd className="font-medium">{r.value}{r.note && <span className="block text-xs font-normal text-muted-foreground">{r.note}</span>}</dd></div>)}</dl>
      {cautions.map((c) => <p key={c} className="mx-5 mb-3 border-l-4 border-caution bg-caution-soft px-4 py-3 text-sm text-caution">{c}</p>)}
      <div className="flex gap-2 border-t px-5 py-4"><Button disabled={!active} onClick={onConfirm}>Confirm</Button><Button variant="outline" disabled={!active} onClick={onChange}>Change</Button></div>
    </div>
  );
}

export function LetterPreview({ data }: { data: LetterData }) {
  const [url, setUrl] = useState<string>();
  const [err, setErr] = useState(false);
  const [file, setFile] = useState<{ save: () => void } | null>(null);
  useEffect(() => {
    let u: string | undefined, live = true;
    import("@/lib/hr-pdf").then(({ letterPdf }) => letterPdf(data)).then((r) => { if (!live) return; u = URL.createObjectURL(r.blob); setUrl(u); setFile(r); }).catch((e) => { console.error(e); if (live) setErr(true); });
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [data]);
  return (
    <div className="mb-4 border bg-card" data-testid="letter">
      <h2 className="border-b px-5 py-4 font-semibold">Employment letter (sample PDF)</h2>
      <div className="p-4">{err ? <p className="text-sm text-caution">The letter could not be created. Try again.</p> : url ? <iframe title="Employment letter preview" src={url} className="h-[480px] w-full border" /> : <p className="text-sm text-muted-foreground">Preparing the letter…</p>}</div>
      <div className="flex flex-wrap gap-2 border-t px-5 py-4">
        <Button disabled={!file} onClick={() => { file?.save(); toast("Letter downloaded."); }}><Download />Download PDF</Button>
        <Button variant="outline" disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener")}><ExternalLink />Open in new tab</Button>
      </div>
    </div>
  );
}

export class TurnBoundary extends Component<{ children: ReactNode; onNew: () => void }, { failed: boolean; key: number }> {
  state = { failed: false, key: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Conversation turn failed", error, info.componentStack); }
  render() {
    if (this.state.failed) return (
      <div role="alert" className="border border-caution bg-caution-soft px-5 py-4">
        <p className="font-semibold text-caution">Something went wrong with this answer. Try again.</p>
        <div className="mt-3 flex gap-2"><Button onClick={() => this.setState((s) => ({ failed: false, key: s.key + 1 }))}>Try again</Button><Button variant="outline" onClick={this.props.onNew}>New inquiry</Button></div>
      </div>
    );
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
