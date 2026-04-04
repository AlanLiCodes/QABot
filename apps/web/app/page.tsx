"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Brain,
  ChevronDown,
  Globe,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { generateTests, listRuns, runSuite, type TestCase } from "@/lib/api";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<string, string> = {
  P0: "bg-rose-950 text-rose-300 border-rose-800",
  P1: "bg-amber-950 text-amber-200 border-amber-800",
  P2: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

const FEATURES = [
  {
    icon: Brain,
    color: "text-amber-400",
    bg: "bg-amber-950/40",
    border: "border-amber-900/40",
    title: "AI Test Generation",
    desc: "Describe a requirement in plain English. Gemini writes structured test cases with steps, expected outcomes, and failure signals — no test framework expertise required.",
  },
  {
    icon: Globe,
    color: "text-violet-400",
    bg: "bg-violet-950/40",
    border: "border-violet-900/40",
    title: "Real Browser Execution",
    desc: "Browser Use Cloud opens a real Chromium browser, navigates your site, clicks buttons, fills forms, and follows multi-step flows exactly like a human QA engineer.",
  },
  {
    icon: BarChart3,
    color: "text-sky-400",
    bg: "bg-sky-950/40",
    border: "border-sky-900/40",
    title: "Structured Bug Reports",
    desc: "Every test produces a detailed card: status, severity, confidence, expected vs actual, suspected root cause, business impact, screenshots, and video recordings.",
  },
  {
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-950/40",
    border: "border-emerald-900/40",
    title: "Smart Result Classification",
    desc: "Outcomes are classified as pass, fail, blocked, or flaky. Blocked means a CAPTCHA or login wall stopped the agent. Flaky flags intermittent timing issues automatically.",
  },
];

const STATS = [
  {
    value: "< 5 min",
    label: "Time to first report",
    sub: "From URL to structured bug report",
  },
  {
    value: "4",
    label: "Result types",
    sub: "Pass, fail, blocked, flaky",
  },
  {
    value: "AI",
    label: "Validated results",
    sub: "Gemini reads every agent trace",
  },
];

const FAQ_ITEMS = [
  {
    q: 'What does "pass / fail / blocked / flaky" mean?',
    a: (
      <ul className="list-none space-y-1 text-sm text-zinc-400">
        <li>
          <span className="font-medium text-emerald-400">pass:</span> The agent
          completed all steps and found no issues matching the failure signals.
        </li>
        <li>
          <span className="font-medium text-red-400">fail:</span> One or more
          expected outcomes were not met, or an error was detected.
        </li>
        <li>
          <span className="font-medium text-amber-300">blocked:</span> The agent
          could not proceed. Usually a login wall, CAPTCHA, or bot-detection
          challenge prevented access.
        </li>
        <li>
          <span className="font-medium text-sky-300">flaky:</span> The result was
          inconsistent, sometimes passing and sometimes failing. Usually a timing or
          race condition.
        </li>
      </ul>
    ),
  },
  {
    q: "What does severity (low / medium / high) mean?",
    a: (
      <ul className="list-none space-y-1 text-sm text-zinc-400">
        <li>
          <span className="font-medium text-red-400">high:</span> Likely blocks
          users completely from using a feature.
        </li>
        <li>
          <span className="font-medium text-amber-300">medium:</span> Degrades the
          user experience but does not fully prevent use.
        </li>
        <li>
          <span className="font-medium text-zinc-400">low:</span> Minor or cosmetic
          issue with minimal user impact.
        </li>
      </ul>
    ),
  },
  {
    q: "What does confidence % mean?",
    a: (
      <p className="text-sm text-zinc-400">
        When Gemini validates results, confidence reflects how certain it is of the
        classification (e.g. 90% means very confident it&apos;s a real failure). When
        the AI key is unavailable and the heuristic fallback is used, confidence is
        lower (50-65%) because the classification is rule-based, not AI-validated.
      </p>
    ),
  },
  {
    q: "What does the agent actually do?",
    a: (
      <p className="text-sm text-zinc-400">
        Each test case runs in two stages. First, Playwright takes a screenshot and
        checks the HTTP status as a quick baseline. Second, the Browser Use Cloud
        agent opens a real browser, follows the test steps, navigates subpages,
        clicks buttons, fills forms, and reports what it found. The agent trace in
        each result card shows every step the agent took.
      </p>
    ),
  },
  {
    q: 'Why is a test marked "blocked"?',
    a: (
      <p className="text-sm text-zinc-400">
        Sites like LinkedIn, Google, or university portals often detect automated
        browsers and show a CAPTCHA or login wall. The agent stops and marks the case
        blocked rather than guessing. You can try re-running with credentials provided
        in the test requirement, or the Browser Use Cloud agent may bypass bot
        detection better than a plain headless browser.
      </p>
    ),
  },
  {
    q: 'What is "Requirement-focused check", "Smoke test", etc.?',
    a: (
      <p className="text-sm text-zinc-400">
        When you click Generate test cases, Gemini reads your requirement and creates
        named test cases. &quot;Reach application&quot; checks the page loads.
        &quot;Primary navigation sanity&quot; clicks your main nav.
        &quot;Requirement-focused check&quot; directly exercises the specific feature
        you described. &quot;Form or input resilience&quot; tests form validation.
        &quot;Mobile viewport sanity&quot; checks the layout on a narrow screen.
      </p>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [requirement, setRequirement] = useState(
    "Smoke test: page loads, primary content visible, no obvious errors.",
  );
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [recent, setRecent] = useState<
    { run_id: string; url: string; status: string; created_at: string }[]
  >([]);

  const formRef = useRef<HTMLDivElement>(null);

  const refreshRuns = useCallback(async () => {
    try {
      const rows = await listRuns();
      setRecent(rows);
    } catch {
      /* ignore — backend may not be up yet */
    }
  }, []);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const normalizeUrl = (raw: string) => {
    const trimmed = raw.trim();
    return trimmed && !trimmed.includes("://") ? `https://${trimmed}` : trimmed;
  };

  const onGenerate = async () => {
    setError(null);
    setLoading(true);
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    try {
      const res = await generateTests({
        url: normalizedUrl,
        requirement_text: requirement,
        max_cases: 5,
      });
      setCases(res.test_cases);
      const sel: Record<string, boolean> = {};
      for (const c of res.test_cases) sel[c.id] = true;
      setSelected(sel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  };

  const onRun = async () => {
    setError(null);
    setLoading(true);
    const normalizedUrl = normalizeUrl(url);
    setUrl(normalizedUrl);
    try {
      const chosen = cases.filter((c) => selected[c.id]);
      const toRun =
        chosen.length > 0 ? chosen : cases.length > 0 ? cases : undefined;
      const res = await runSuite({
        url: normalizedUrl,
        requirement_text: requirement,
        test_cases: toRun,
        max_cases: 5,
        viewport,
      });
      window.location.href = `/runs/${res.run_id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 pb-24 pt-24 text-center">
        {/* ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(124,58,237,0.22),transparent)]" />

        <p className="relative mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">
          DiamondHacks 2026 · Browser Use + Gemini
        </p>

        <h1 className="relative max-w-3xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-amber-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
            Requirements to browser runs to bug reports
          </span>
        </h1>

        <p className="relative mt-6 max-w-xl text-base text-zinc-400">
          Describe what to test in plain English. QABot generates AI-written test
          cases, runs them in a real browser with the Browser Use Cloud agent, and
          delivers structured bug reports — automatically.
        </p>

        <div className="relative mt-9 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={() =>
              formRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-xl bg-gradient-to-r from-amber-400 to-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-amber-300 hover:to-violet-500 hover:shadow-violet-500/20"
          >
            Start Testing Now
          </button>
          <Link
            href="/chat"
            className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-8 py-3 text-sm font-semibold text-zinc-200 transition-all hover:bg-zinc-800"
          >
            <MessageSquare size={15} />
            Chat Interface
          </Link>
        </div>
      </section>

      {/* ── Feature cards ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div
              key={title}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 ${border}`}
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon size={19} className={color} />
              </div>
              <h3 className={`text-base font-semibold ${color}`}>{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why QABot stats ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-zinc-800/60 bg-zinc-950/60 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(124,58,237,0.08),transparent)]" />

        <h2 className="relative text-3xl font-bold sm:text-4xl">
          <span className="bg-gradient-to-r from-amber-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
            Why Choose QABot?
          </span>
        </h2>

        <div className="relative mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-5 px-4 sm:grid-cols-3">
          {STATS.map(({ value, label, sub }) => (
            <div
              key={label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-8"
            >
              <p className="text-4xl font-extrabold text-white">{value}</p>
              <p className="mt-2 text-sm font-semibold text-violet-400">{label}</p>
              <p className="mt-1 text-xs text-zinc-500">{sub}</p>
            </div>
          ))}
        </div>

        <p className="relative mx-auto mt-10 max-w-2xl px-4 text-sm text-zinc-400">
          QABot is an AI-powered browser QA platform that turns product requirements
          into executable browser test cases, runs them against your live site with a
          real browser agent, and delivers structured, actionable bug reports in
          minutes.
        </p>
      </section>

      {/* ── Run form ──────────────────────────────────────────────────── */}
      <div ref={formRef} className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white">Create a test run</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Enter a URL and describe what you want to test. Generate AI test cases,
            review them, then run.
          </p>
        </div>

        <section className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div>
            <label
              className="block text-sm font-medium text-zinc-300"
              htmlFor="url-input"
            >
              Target URL
            </label>
            <input
              id="url-input"
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-zinc-300"
              htmlFor="req-input"
            >
              Feature / requirement to test
            </label>
            <textarea
              id="req-input"
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label
              className="text-sm font-medium text-zinc-300"
              htmlFor="viewport-select"
            >
              Viewport
            </label>
            <select
              id="viewport-select"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
              value={viewport}
              onChange={(e) =>
                setViewport(e.target.value as "desktop" | "mobile")
              }
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void onGenerate()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? "Working..." : "Generate test cases"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowRunModal(true)}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Run suite
            </button>
          </div>

          {/* Generated test cases */}
          {cases.length > 0 && (
            <div className="border-t border-zinc-800 pt-5">
              <h2 className="text-sm font-semibold text-zinc-200">
                Generated test cases
              </h2>
              <ul className="mt-3 space-y-3">
                {cases.map((c) => {
                  const priorityStyle =
                    PRIORITY_STYLES[c.priority] ?? PRIORITY_STYLES.P2;
                  return (
                    <li
                      key={c.id}
                      className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={!!selected[c.id]}
                        onChange={(e) =>
                          setSelected((s) => ({
                            ...s,
                            [c.id]: e.target.checked,
                          }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">
                            {c.name}
                          </span>
                          {c.priority && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyle}`}
                            >
                              {c.priority}
                            </span>
                          )}
                          {c.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {c.goal && (
                          <p className="mt-1 text-xs text-zinc-500">{c.goal}</p>
                        )}
                        {c.steps && c.steps.length > 0 && (
                          <ol className="mt-1.5 list-inside list-decimal space-y-0.5">
                            {c.steps.slice(0, 3).map((s, i) => (
                              <li key={i} className="text-xs text-zinc-400">
                                {s}
                              </li>
                            ))}
                            {c.steps.length > 3 && (
                              <li className="text-xs text-zinc-600">
                                +{c.steps.length - 3} more steps
                              </li>
                            )}
                          </ol>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-zinc-500">
                Uncheck cases to skip. If none are checked, all generated cases run.
              </p>
            </div>
          )}
        </section>

        {/* Recent runs */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-300">Recent runs</h2>
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {recent.length === 0 && (
              <li className="px-4 py-6 text-sm text-zinc-500">
                No runs yet. Create one above.
              </li>
            )}
            {recent.map((r) => (
              <li
                key={r.run_id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/runs/${r.run_id}`}
                    className="font-mono text-sm text-violet-400 hover:underline"
                  >
                    {r.run_id.slice(0, 8)}
                  </Link>
                  <div className="text-xs text-zinc-500">{r.url}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "completed"
                      ? "bg-emerald-950 text-emerald-300"
                      : r.status === "running"
                        ? "bg-amber-950 text-amber-200"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-200">
            Frequently asked questions
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Understanding your QA results
          </p>
          <div className="mt-4 space-y-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/40"
              >
                <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-200 hover:text-white">
                  <span>{item.q}</span>
                  <ChevronDown
                    size={16}
                    className="ml-4 shrink-0 text-violet-400 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-zinc-800 px-4 py-3">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* ── Confirmation modal ────────────────────────────────────────── */}
      {showRunModal && (
        <RunModal
          onConfirm={() => {
            setShowRunModal(false);
            void onRun();
          }}
          onCancel={() => setShowRunModal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation modal
// ---------------------------------------------------------------------------

function RunModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmed = typed === "run suite";

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-950 text-amber-400">
              <TriangleAlert size={16} />
            </div>
            <h2 className="text-base font-semibold text-white">
              Confirm Run Suite
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="ml-4 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-zinc-300">
            Please type{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-violet-300">
              run suite
            </code>{" "}
            to confirm that you want to launch a full browser test run against the
            target URL.
          </p>
          <p className="text-sm text-zinc-500">
            This action will open a real browser, execute each test case using the
            Browser Use Cloud agent, and may consume API credits. Depending on the
            number of cases, the run may take several minutes to complete.
          </p>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-zinc-400"
              htmlFor="confirm-input"
            >
              Type to confirm
            </label>
            <input
              id="confirm-input"
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmed) onConfirm();
              }}
              placeholder="run suite"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm run
          </button>
        </div>
      </div>
    </div>
  );
}
