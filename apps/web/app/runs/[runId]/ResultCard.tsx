"use client";

import { AlertTriangle, Clock, Download, Wrench } from "lucide-react";
import { fileUrl, type TestCase, type TestResult } from "@/lib/api";

const STEP_LABELS: Record<string, string> = {
  http_smoke:    "HTTP check",
  browser_agent: "Browser agent",
  validate:      "AI validation",
  annotate:      "Annotation",
  total:         "Total",
};

const STATUS_STYLES: Record<string, string> = {
  pass:    "bg-emerald-950 text-emerald-300 border-emerald-800",
  fail:    "bg-red-950 text-red-300 border-red-800",
  blocked: "bg-amber-950 text-amber-200 border-amber-800",
  flaky:   "bg-sky-950 text-sky-300 border-sky-800",
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  pass:    "All expected outcomes were met",
  fail:    "One or more expected outcomes were not met",
  blocked: "Could not run: auth, CAPTCHA, or bot protection prevented access",
  flaky:   "Result was inconsistent across attempts",
};

const SEVERITY_STYLES: Record<string, string> = {
  high:   "bg-red-950/60 text-red-400",
  medium: "bg-amber-950/60 text-amber-300",
  low:    "bg-zinc-800 text-zinc-400",
};

const SEVERITY_DESCRIPTIONS: Record<string, string> = {
  high:   "Likely blocks users",
  medium: "Degrades experience",
  low:    "Minor or cosmetic",
};

const SCREENSHOT_BORDER: Record<string, string> = {
  pass:    "border-emerald-600",
  fail:    "border-red-600",
  blocked: "border-amber-500",
  flaky:   "border-sky-500",
};

const SCREENSHOT_LABEL: Record<string, { text: string; style: string }> = {
  pass:    { text: "PASS",    style: "bg-emerald-600 text-white" },
  fail:    { text: "FAIL",    style: "bg-red-600 text-white" },
  blocked: { text: "BLOCKED", style: "bg-amber-500 text-black" },
  flaky:   { text: "FLAKY",   style: "bg-sky-500 text-white" },
};

function Badge({ label, style, title }: { label: string; style: string; title?: string }) {
  return (
    <span
      title={title}
      className={`cursor-help rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}

type Props = {
  result: TestResult;
  testCase?: TestCase;
};

export default function ResultCard({ result, testCase }: Props) {
  const name = testCase?.name ?? result.test_case_id;
  const statusStyle = STATUS_STYLES[result.status] ?? "bg-zinc-800 text-zinc-300 border-zinc-700";
  const sevStyle    = SEVERITY_STYLES[result.severity] ?? SEVERITY_STYLES.medium;

  const evidence = result.evidence ?? [];

  // Local PNG/WebM files
  const pngEvidence  = evidence.filter((e) => e.endsWith(".png"));
  const videoEvidence = evidence.filter((e) => e.endsWith(".webm"));
  // Browser Use CDN step screenshots (https:// URLs that aren't .webm)
  const cdnScreenshots = evidence.filter(
    (e) => (e.startsWith("https://") || e.startsWith("http://")) && !e.endsWith(".webm"),
  );
  // Agent trace text file download link
  const txtEvidence = evidence.filter((e) => e.endsWith(".txt"));

  const reproSteps = result.repro_steps ?? [];
  const isProblem  = result.status !== "pass";
  const borderCls  = SCREENSHOT_BORDER[result.status] ?? "border-zinc-700";
  const label      = SCREENSHOT_LABEL[result.status];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-white">{name}</span>
        <Badge
          label={result.status.toUpperCase()}
          style={statusStyle}
          title={STATUS_DESCRIPTIONS[result.status]}
        />
        <Badge
          label={`${result.severity} severity`}
          style={`rounded-full px-2 py-0.5 text-xs ${sevStyle}`}
          title={SEVERITY_DESCRIPTIONS[result.severity]}
        />
        <span className="ml-auto text-xs text-zinc-500">
          {Math.round((result.confidence ?? 0) * 100)}% confidence
        </span>
      </div>

      {/* ── Test goal ── */}
      {testCase?.goal && (
        <p className="mt-2 text-xs text-zinc-500">
          <span className="font-semibold uppercase tracking-wide text-zinc-600">Goal: </span>
          {testCase.goal}
        </p>
      )}

      {/* ── Steps tested ── */}
      {testCase?.steps && testCase.steps.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Steps tested
          </p>
          <ol className="list-decimal list-inside space-y-0.5">
            {testCase.steps.slice(0, 4).map((s, i) => (
              <li key={i} className="text-xs text-zinc-400">{s}</li>
            ))}
            {testCase.steps.length > 4 && (
              <li className="text-xs text-zinc-600">+{testCase.steps.length - 4} more</li>
            )}
          </ol>
        </div>
      )}

      {/* ── Expected vs Actual ── */}
      {(result.expected || result.actual) && (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-zinc-950/50 p-3 text-xs">
          {result.expected && (
            <div>
              <p className="mb-0.5 font-semibold uppercase tracking-wide text-zinc-500">Expected</p>
              <p className="text-zinc-300">{result.expected}</p>
            </div>
          )}
          {result.actual && (
            <div>
              <p className="mb-0.5 font-semibold uppercase tracking-wide text-zinc-500">Actual</p>
              <p className={isProblem ? "text-red-300" : "text-zinc-300"}>{result.actual}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Suspected issue ── */}
      {result.suspected_issue && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Suspected issue</p>
            <p className="mt-0.5 text-sm text-amber-200">{result.suspected_issue}</p>
          </div>
        </div>
      )}

      {/* ── Suggested fix ── */}
      {result.suggested_fix && (
        <div className="mt-3 flex gap-2 rounded-lg border border-violet-900/60 bg-violet-950/30 px-3 py-2">
          <Wrench size={14} className="mt-0.5 shrink-0 text-violet-400" />
          <div>
            <p className="text-xs font-semibold text-violet-400">Suggested fix</p>
            <p className="mt-0.5 text-sm text-violet-200">{result.suggested_fix}</p>
          </div>
        </div>
      )}

      {/* ── Business impact ── */}
      {result.business_impact && (
        <p className="mt-2 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-600">Impact: </span>
          {result.business_impact}
        </p>
      )}

      {/* ── Local PNG screenshots ── */}
      {pngEvidence.length > 0 && (
        <div className="mt-3 space-y-2">
          {pngEvidence.map((p) => (
            <div key={p} className="relative">
              <img
                src={fileUrl(p)}
                alt="viewport screenshot"
                loading="lazy"
                className={`w-full rounded-lg border-2 ${borderCls}`}
              />
              {label && (
                <span className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${label.style}`}>
                  {label.text}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Browser Use step screenshots (CDN) ── */}
      {cdnScreenshots.length > 0 && (
        <details className="mt-3" open={cdnScreenshots.length <= 4}>
          <summary className="cursor-pointer select-none text-xs font-medium text-violet-400 hover:text-violet-300">
            Browser Use screenshots ({cdnScreenshots.length} steps)
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cdnScreenshots.map((url, i) => (
              <div key={url} className="relative">
                <img
                  src={url}
                  alt={`Step ${i + 1}`}
                  loading="lazy"
                  className={`w-full rounded-lg border-2 ${borderCls}`}
                />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-zinc-300">
                  step {i + 1}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Video recordings ── */}
      {videoEvidence.length > 0 && (
        <div className="mt-3 space-y-2">
          {videoEvidence.map((v) => (
            <video key={v} controls className={`w-full rounded-lg border-2 ${borderCls}`}>
              <source src={fileUrl(v)} type="video/webm" />
            </video>
          ))}
        </div>
      )}

      {/* ── Timing breakdown ── */}
      {result.timings && Object.keys(result.timings).length > 0 && (
        <details className="mt-3">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300">
            <Clock size={12} />
            Timing breakdown
            {result.timings.total != null && (
              <span className="ml-1 text-zinc-600">({result.timings.total}s total)</span>
            )}
          </summary>
          <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="px-3 py-1.5 font-medium">Step</th>
                  <th className="px-3 py-1.5 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {(["http_smoke", "browser_agent", "validate", "annotate", "total"] as const)
                  .filter((k) => result.timings![k] != null)
                  .map((k) => (
                    <tr key={k} className={`border-b border-zinc-900 last:border-0 ${k === "total" ? "font-semibold text-zinc-300" : "text-zinc-400"}`}>
                      <td className="px-3 py-1.5">{STEP_LABELS[k] ?? k}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {result.timings![k].toFixed(2)}s
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ── Agent log, repro steps, trace download ── */}
      {(reproSteps.length > 0 || result.agent_trace || txtEvidence.length > 0) && (
        <details className="mt-3">
          <summary className="cursor-pointer select-none text-xs font-medium text-violet-400 hover:text-violet-300">
            Agent log &amp; repro steps
          </summary>

          <div className="mt-3 space-y-3">
            {/* Download link for raw trace file */}
            {txtEvidence.map((t) => (
              <a
                key={t}
                href={fileUrl(t)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <Download size={12} />
                Download full agent log
              </a>
            ))}

            {/* Inline agent trace */}
            {result.agent_trace && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Agent trace
                </p>
                <pre className="overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400">
                  {result.agent_trace}
                </pre>
              </div>
            )}

            {/* Repro steps */}
            {reproSteps.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Repro steps
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  {reproSteps.map((s, i) => (
                    <li key={i} className="text-sm text-zinc-400">{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
