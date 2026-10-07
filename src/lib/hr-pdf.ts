// Browser-only PDF builders. jspdf is imported dynamically inside each call so server rendering never loads it.
import { buildLetter, todayISO, type LetterData } from "./hr-flow-calc";
import { formTitles, type FormId } from "./hr-flow-engine";

type Logo = { data: string; w: number; h: number };
let logoCache: Promise<Logo | null> | null = null;
function loadLogo(): Promise<Logo | null> {
  logoCache ??= fetch("/wrhn-logo.png")
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("logo"))))
    .then((b) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); }))
    .then((data) => new Promise<Logo>((res, rej) => { const img = new Image(); img.onload = () => res({ data, w: img.naturalWidth, h: img.naturalHeight }); img.onerror = rej; img.src = data; }))
    .catch(() => { logoCache = null; return null; });
  return logoCache;
}

async function newDoc() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const logo = await loadLogo();
  const M = 72;
  let y = M;
  if (logo) {
    const w = 160, h = (logo.h / logo.w) * w;
    doc.addImage(logo.data, "PNG", M, y, w, h);
    y += h + 14;
  } else {
    doc.setFont("helvetica", "bold").setFontSize(18).text("WRHN", M, y + 14);
    doc.setFont("helvetica", "normal").setFontSize(9).text("Waterloo Regional Health Network", M, y + 28);
    y += 42;
  }
  doc.setDrawColor(180).setLineWidth(0.5).line(M, y, 612 - M, y);
  return { doc, y: y + 28, M, width: 612 - 2 * M };
}

export async function letterPdf(d: LetterData, today = todayISO()) {
  const L = buildLetter(d, today);
  const { doc, M, width } = await newDoc();
  let { y } = await Promise.resolve({ y: 0 });
  y = 72 + 0;
  // recompute y below logo by drawing on the doc returned
  const start = (doc as unknown as { __y?: number }).__y;
  void start;
  y = 160;
  const para = (text: string, bold = false, gap = 16) => {
    doc.setFont("times", bold ? "bold" : "normal").setFontSize(11);
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, M, y);
    y += lines.length * 15 + gap;
  };
  para(L.date);
  para(L.addressee);
  para(L.re, true);
  L.paragraphs.forEach((p) => para(p));
  L.closing.forEach((c, i) => para(c, false, i === 0 ? 20 : 2));
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
  doc.text(L.footer, M, 792 - 40);
  const blob = doc.output("blob");
  const last = d.name.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z0-9-]/g, "") || "employee";
  return { blob, filename: `employment-letter-${last}-sample.pdf`, save: () => doc.save(`employment-letter-${last}-sample.pdf`) };
}

const formFields: Record<FormId, string[]> = {
  loa: ["Employee name", "Employee ID", "Type of leave", "Planned first day of leave", "Planned return date", "Supporting documents attached", "Employee signature", "Date"],
  benefits: ["Employee name", "Employee ID", "Life event", "Date of life event", "Dependant name", "Relationship", "Documents attached", "Employee signature", "Date"],
  pension: ["Employee name", "Employee ID", "Start date", "Employment status", "Employee signature", "Date"],
};

export async function downloadForm(id: FormId) {
  const { doc, y: y0, M, width } = await newDoc();
  let y = y0;
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20).text(formTitles[id], M, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90).text("Synthetic sample form", M, y);
  y += 40;
  doc.setTextColor(20).setFontSize(11);
  for (const f of formFields[id]) {
    doc.text(f, M, y);
    doc.setDrawColor(150).line(M + 190, y + 2, M + width, y + 2);
    y += 36;
  }
  doc.save(`${id}-form-sample.pdf`);
}
