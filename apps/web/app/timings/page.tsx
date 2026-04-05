"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, RefreshCw } from "lucide-react";
import { getTimings, type TimingsData } from "@/lib/api";

const STEP_LABELS: Record<string, string> = {
  http_smoke:    "HTTP check",
  browser_agent: "Browser agent",
  validate:      "AI validation",
  annotate:      "Annotation",
  total:         "Total / case",
};

const STEP_ORDER = ["http_smoke", "browser_agent", "validate", "annotate", "total"];

function fmt(n: number) {
  return n.toFixed(2) + "s";
}

export default function TimingsPage() {
  const [data, setData] = useState<TimingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    getTimings()
      .then((d) => setData(d))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const steps = data?.steps ?? {};
  const ordered = [
    ...STEP_ORDER.filter((k) => k in steps),
    ...Object.keys(steps).filter((k) => !STEP_ORDER.includes(k)).sort(),
  ];

  // Find the slowest non-total step for highlighting
  const slowestStep = ordered
    .filter((k) => k !== "total")
    .sort((a, b) => (steps[b]?.avg_s ?? 0) - (steps[a]?.avg_s ?? 0))[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Clock size={20} className="text-green-400" />
            Timing Statistics
          </h1>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-500">
          Per-step averages aggregated across all completed test cases — use this to see
          where time is spent and track improvements.
        </p>

        {err && (
          <p className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {err}
          </p>
        )}

        {loading && !data && (
          <p className="mt-8 animate-pulse text-zinc-500">Loading...</p>
        )}

        {data?.note && !ordered.length && (
          <p className="mt-8 text-sm text-zinc-400">{data.note}</p>
        )}

        {ordered.length > 0 && (
          <div className="mt-6 space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Cases timed</p>
                <p className="mt-1 text-2xl font-bold text-white">{data?.count ?? 0}</p>
              </div>
              {steps.total && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Avg / case</p>
                  <p className="mt-1 text-2xl font-bold text-white">{fmt(steps.total.avg_s)}</p>
                </div>
              )}
              {steps.browser_agent && (
                <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-600">Slowest step</p>
                  <p className="mt-1 text-lg font-bold text-amber-300">
                    {STEP_LABELS[slowestStep] ?? slowestStep}
                  </p>
                  <p className="text-xs text-amber-500">avg {fmt(steps[slowestStep]?.avg_s ?? 0)}</p>
                </div>
              )}
            </div>

            {/* Detailed table */}
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
                    <th className="px-4 py-3 font-medium">Step</th>
                    <th className="px-4 py-3 text-right font-medium">Avg</th>
                    <th className="px-4 py-3 text-right font-medium">Median</th>
                    <th className="px-4 py-3 text-right font-medium">Min</th>
                    <th className="px-4 py-3 text-right font-medium">Max</th>
                    <th className="px-4 py-3 text-right font-medium">Stdev</th>
                    <th className="px-4 py-3 text-right font-medium">n</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((k) => {
                    const s = steps[k];
                    const isTotal = k === "total";
                    const isSlowest = k === slowestStep;
                    return (
                      <tr
                        key={k}
                        className={`border-b border-zinc-900 last:border-0 ${
                          isTotal
                            ? "bg-zinc-900/60 font-semibold text-zinc-200"
                            : isSlowest
                            ? "text-amber-300"
                            : "text-zinc-400"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          {STEP_LABELS[k] ?? k}
                          {isSlowest && !isTotal && (
                            <span className="ml-2 rounded bg-amber-900/40 px-1 py-0.5 text-[10px] text-amber-500">
                              slowest
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.avg_s)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{fmt(s.median_s)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{fmt(s.min_s)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{fmt(s.max_s)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">±{fmt(s.stdev_s)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{s.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-zinc-600">
              Times are wall-clock seconds measured server-side. Browser agent time includes
              session creation, task execution, and result polling. Run steps execute in parallel
              (up to 3 concurrent), so wall time per run ≈ slowest parallel group × total / 3.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
