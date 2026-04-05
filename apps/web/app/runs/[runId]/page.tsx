"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, MessageSquare, RotateCcw, ExternalLink, Radio } from "lucide-react";
import {
  getApiBase,
  getResults,
  rerunFailed,
  streamRunEvents,
  type RunResults,
  type SseEvent,
  type StepTimings,
  type TestResult,
} from "@/lib/api";
import ResultCard from "./ResultCard";
import SummaryBar from "./SummaryBar";

const STEP_LABELS: Record<string, string> = {
  http_smoke:    "HTTP check",
  browser_agent: "Browser agent",
  validate:      "AI validation",
  annotate:      "Annotation",
  total:         "Total / case",
};

const STATUS_LEGEND = [
  { label: "pass", color: "bg-emerald-950 text-emerald-300 border border-emerald-800" },
  { label: "fail", color: "bg-red-950 text-red-300 border border-red-800" },
  { label: "blocked", color: "bg-amber-950 text-amber-200 border border-amber-800" },
  { label: "flaky", color: "bg-sky-950 text-sky-300 border border-sky-800" },
];

export default function RunPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [data, setData] = useState<RunResults | null>(null);
  const [liveResults, setLiveResults] = useState<TestResult[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [streamDone, setStreamDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rerunBusy, setRerunBusy] = useState(false);
  // case_id → Browser Use live URL (available while case is running)
  const [liveUrls, setLiveUrls] = useState<Record<string, string>>({});
  // accumulated per-step timings from SSE (step → list of seconds across cases)
  const [allTimings, setAllTimings] = useState<Record<string, number[]>>({});
  const [totalElapsed, setTotalElapsed] = useState<number | null>(null);
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    getResults(runId)
      .then((r) => setData(r))
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : "Load failed"),
      );
  }, [runId]);

  useEffect(() => {
    const handler = (event: SseEvent) => {
      if (event.type === "run_started") {
        setTotalCases((event.data.total as number) ?? 0);
      } else if (event.type === "case_live_url") {
        const caseId = event.data.case_id as string;
        const liveUrl = event.data.live_url as string;
        if (caseId && liveUrl) {
          setLiveUrls((prev) => ({ ...prev, [caseId]: liveUrl }));
        }
      } else if (event.type === "case_completed") {
        const d = event.data;
        const caseTimings = (d.timings ?? {}) as StepTimings;
        const partial: TestResult = {
          test_case_id:   (d.case_id as string) ?? "",
          status:         (d.status as TestResult["status"]) ?? "fail",
          severity:       (d.severity as TestResult["severity"]) ?? "medium",
          confidence:     typeof d.confidence === "number" ? d.confidence : 0.5,
          failed_step:    (d.failed_step as string | null) ?? null,
          expected:       (d.expected as string) ?? "",
          actual:         (d.actual as string) ?? "",
          repro_steps:    Array.isArray(d.repro_steps) ? (d.repro_steps as string[]) : [],
          evidence:       Array.isArray(d.evidence) ? (d.evidence as string[]) : [],
          suspected_issue: (d.suspected_issue as string) ?? "",
          business_impact: (d.business_impact as string) ?? "",
          agent_trace:    (d.agent_trace as string) ?? "",
          summary:        (d.summary as string) ?? "",
          timings:        caseTimings,
        };
        setLiveResults((prev) => [...prev, partial]);
        // Accumulate timings for the run-level summary
        if (Object.keys(caseTimings).length > 0) {
          setAllTimings((prev) => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(caseTimings)) {
              next[k] = [...(next[k] ?? []), v];
            }
            return next;
          });
        }
      } else if (event.type === "run_completed") {
        if (typeof event.data.elapsed_seconds === "number") {
          setTotalElapsed(event.data.elapsed_seconds as number);
        }
        setStreamDone(true);
        getResults(runId)
          .then((r) => setData(r))
          .catch(() => {});
      }
    };
    const cleanup = streamRunEvents(runId, handler, () => setStreamDone(true));
    return cleanup;
  }, [runId]);

  const onRerun = async () => {
    setRerunBusy(true);
    try {
      const r = await rerunFailed(runId);
      window.location.href = `/runs/${r.run_id}`;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rerun failed");
    } finally {
      setRerunBusy(false);
    }
  };

  const isCompleted = streamDone || data?.status === "completed";
  const displayResults: TestResult[] =
    isCompleted && data?.results?.length ? data.results : liveResults;

  const caseMap = new Map(
    (data?.test_cases ?? []).map((c) => [c.id, c]),
  );
  const total = totalCases || data?.test_cases?.length || 0;
  const runStatus = isCompleted ? "completed" : (data?.status ?? "running");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-white">
          Run <span className="font-mono text-violet-400">{runId.slice(0, 8)}</span>
        </h1>

        {err && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {err}
          </p>
        )}

        {!data && !err && (
          <p className="mt-6 animate-pulse text-zinc-500">Connecting...</p>
        )}

        {(data || liveResults.length > 0) && (
          <div className="mt-6 space-y-6">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isCompleted
                    ? "bg-emerald-950 text-emerald-300"
                    : "animate-pulse bg-amber-950 text-amber-200"
                }`}
              >
                {runStatus}
              </span>
              <span>{data?.viewport ?? "desktop"}</span>
              {data?.url && (
                <a
                  className="max-w-xs truncate font-mono text-violet-400 hover:underline"
                  href={data.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.url}
                </a>
              )}
              {data && (
                <a
                  className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                  href={`${getApiBase()}/export/${data.run_id}.json`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Export JSON
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {data?.requirement_text && (
              <p className="text-sm italic text-zinc-300">
                &ldquo;{data.requirement_text}&rdquo;
              </p>
            )}

            <SummaryBar results={displayResults} status={runStatus} total={total} />

            {/* Run-level timing summary — shown once we have data */}
            {Object.keys(allTimings).length > 0 && (
              <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white">
                  <Clock size={14} className="text-zinc-500" />
                  Run timing summary
                  {totalElapsed != null && (
                    <span className="ml-auto text-xs font-normal text-zinc-500">
                      Wall time: {totalElapsed}s
                    </span>
                  )}
                </summary>
                <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950 text-left text-zinc-500">
                        <th className="px-3 py-2 font-medium">Step</th>
                        <th className="px-3 py-2 text-right font-medium">Avg</th>
                        <th className="px-3 py-2 text-right font-medium">Min</th>
                        <th className="px-3 py-2 text-right font-medium">Max</th>
                        <th className="px-3 py-2 text-right font-medium">Cases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["http_smoke", "browser_agent", "validate", "annotate", "total"] as const)
                        .filter((k) => allTimings[k]?.length)
                        .map((k) => {
                          const vals = allTimings[k];
                          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                          const min = Math.min(...vals);
                          const max = Math.max(...vals);
                          return (
                            <tr key={k} className={`border-b border-zinc-900 last:border-0 ${k === "total" ? "font-semibold text-zinc-300" : "text-zinc-400"}`}>
                              <td className="px-3 py-2">{STEP_LABELS[k] ?? k}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{avg.toFixed(2)}s</td>
                              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{min.toFixed(2)}s</td>
                              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{max.toFixed(2)}s</td>
                              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{vals.length}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  Averages across {displayResults.length} case{displayResults.length !== 1 ? "s" : ""} in this run.
                  View global averages at <Link href="/timings" className="text-violet-500 hover:underline">/timings</Link>.
                </p>
              </details>
            )}

            {/* Live browser watch links — visible while run is in progress */}
            {!isCompleted && Object.keys(liveUrls).length > 0 && (
              <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-400">
                  <Radio size={12} className="animate-pulse" />
                  Live browser sessions
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(liveUrls).map(([caseId, url]) => {
                    const caseName = caseMap.get(caseId)?.name ?? caseId.slice(0, 8);
                    return (
                      <a
                        key={caseId}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-violet-800 bg-violet-900/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-800/60"
                      >
                        <Radio size={10} className="animate-pulse text-violet-400" />
                        {caseName}
                        <ExternalLink size={10} />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status legend */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-zinc-600">Legend:</span>
              {STATUS_LEGEND.map(({ label, color }) => (
                <span
                  key={label}
                  className={`rounded-full px-2 py-0.5 ${color}`}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Actions */}
            {isCompleted && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={rerunBusy}
                  onClick={() => void onRerun()}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  Re-run failed / flaky / blocked
                </button>
                <Link
                  href={`/chat?from_run=${runId}`}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-700 bg-violet-950/40 px-3 py-1.5 text-sm text-violet-300 hover:bg-violet-900/40"
                >
                  <MessageSquare size={14} />
                  Chat about this run
                </Link>
                <Link
                  href="/new-run"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  <ArrowLeft size={14} />
                  New run
                </Link>
              </div>
            )}

            {/* Result cards */}
            {displayResults.length > 0 ? (
              <div className="space-y-4">
                {displayResults.map((result, i) => (
                  <ResultCard
                    key={result.test_case_id + i}
                    result={result}
                    testCase={caseMap.get(result.test_case_id)}
                  />
                ))}
              </div>
            ) : (
              !isCompleted && (
                <p className="animate-pulse text-sm text-zinc-500">
                  Waiting for first test case to complete...
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
