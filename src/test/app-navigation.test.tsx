// Renders the real route tree in jsdom (memory history) and clicks through the shell: tile, links, nav, role switch, review queue.
// The header role dropdown (Radix) is not covered: it hangs in jsdom, which lacks PointerEvent. The role switch itself is covered via the review page.
// Not a real browser. Fails on any console.error or uncaught window error.
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

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
  Element.prototype.scrollIntoView ??= () => {};
});
// Rendering the root route's document shell inside a jsdom container produces these two React warnings.
// They come from the test setup (CSS ?url imports resolve to "" and <html> sits inside a div), not from the app.
const KNOWN_SHELL_WARNINGS = [
  /An empty string \(""\) was passed to the %s attribute/,
  /In HTML, %s cannot be a child of <%s>/,
];
afterEach(() => {
  window.removeEventListener("error", onWindowError);
  const calls = consoleErrors.mock.calls
    .map((c: unknown[]) => String(c[0]))
    .filter((m: string) => !KNOWN_SHELL_WARNINGS.some((re) => re.test(m)))
    .map((m: string) => m.slice(0, 200));
  consoleErrors.mockRestore();
  cleanup();
  expect(calls, "console.error calls").toEqual([]);
  expect(windowErrors, "window errors").toEqual([]);
});

async function open(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("HR team hub and the assistant shell", () => {
  it("the home page renders and its HR Research Assistant tile opens the assistant", async () => {
    const router = await open("/");
    expect(await screen.findByRole("heading", { name: "HR Team Hub" })).toBeInTheDocument();
    expect(screen.getAllByAltText(/Waterloo Regional Health Network/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("link", { name: /HR Research Assistant/ })[0]!);
    expect(
      await screen.findByRole("heading", { name: "What do you need to look up?" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/assistant");
    expect(screen.getAllByAltText(/Waterloo Regional Health Network/).length).toBeGreaterThan(0);
  });

  it("the assistant's back link returns to the HR team hub", async () => {
    const router = await open("/assistant");
    await screen.findByRole("heading", { name: "What do you need to look up?" });
    fireEvent.click(screen.getByRole("link", { name: "Back to HR team hub" }));
    expect(await screen.findByRole("heading", { name: "HR Team Hub" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("the nav moves between Ask, Review queue and Sources", async () => {
    const router = await open("/assistant");
    await screen.findByRole("heading", { name: "What do you need to look up?" });
    fireEvent.click(screen.getByRole("link", { name: "Sources" }));
    expect(await screen.findByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/assistant/sources");
    fireEvent.click(screen.getByRole("link", { name: "Review queue" }));
    expect(await screen.findByRole("heading", { name: "Review queue" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Ask" }));
    expect(
      await screen.findByRole("heading", { name: "What do you need to look up?" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/assistant");
  });

  it("the Sources page lists all 21 sources and badges the three synthetic documents", async () => {
    await open("/assistant/sources");
    await screen.findByRole("heading", { name: "Sources" });
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(21);
    const badges = screen.getAllByText("Synthetic sample");
    expect(badges).toHaveLength(3);
    for (const file of [
      "leaves_of_absence_guideline_synthetic.docx",
      "employment_letter_procedure_synthetic.docx",
      "benefits_compensation_guide_synthetic.docx",
    ]) {
      const row = screen.getByText(file).closest("tr")!;
      expect(within(row).getByText("Synthetic sample")).toBeInTheDocument();
      expect(within(row).getByText("Yes")).toBeInTheDocument();
    }
    expect(screen.getAllByText("Yes")).toHaveLength(8); // clause text loaded for 8
  });

  it("role switch: Advisor sees a gate, Reviewer opens the queue, and Mark as reviewed works", async () => {
    await open("/assistant/review");
    expect(await screen.findByText(/The review queue is for reviewers/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Reviewer" }));
    expect(await screen.findByText("Flagged answers")).toBeInTheDocument();
    const before = screen.getAllByRole("button", { name: "Mark as reviewed" }).length;
    expect(before).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Mark as reviewed" })[0]!);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Mark as reviewed" })).toHaveLength(before - 1),
    );
  });

  it("a question flagged in the assistant shows up in the review queue", async () => {
    await open("/assistant");
    await screen.findByRole("heading", { name: "What do you need to look up?" });
    fireEvent.change(screen.getByLabelText("HR policy question"), {
      target: { value: "employee grievance" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Ask/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Wrong team" }));
    fireEvent.click(screen.getByRole("link", { name: "Review queue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Switch to Reviewer" }));
    expect(await screen.findByText("employee grievance")).toBeInTheDocument();
  });
});
