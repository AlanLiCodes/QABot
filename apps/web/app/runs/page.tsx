"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";
import { listRuns } from "@/lib/api";

type RunRow = {
  run_id: string;
  url: string;
  status: string;
  created_at: string;
  requirement_text: string;
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-950 text-emerald-300",
  running:   "bg-amber-950 text-amber-200 animate-pulse",
  pending:   "bg-zinc-800 text-zinc-400",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    listRuns()
      .then(setRuns)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load runs"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">All runs</h1>
            <p className="mt-1 text-sm text-zinc-500">Every test suite run, newest first.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              href="/new-run"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-400 to-green-600 px-4 py-2 text-sm font-semibold text-white hover:from-orange-400 to-green-600"
            >
              <Plus size={14} />
              New run
            </Link>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40">
          {loading && (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse border-b border-zinc-800 bg-zinc-900/20 last:border-0" />
              ))}
            </div>
          )}

          {!loading && runs.length === 0 && !error && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-zinc-500">No runs yet.</p>
              <Link
                href="/new-run"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-green-400 hover:underline"
              >
                Create your first run
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {!loading && runs.length > 0 && (
            <ul className="divide-y divide-zinc-800">
              {runs.map((r) => (
                <li key={r.run_id}>
                  <Link
                    href={`/runs/${r.run_id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-zinc-800/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-orange-400">
                          {r.run_id.slice(0, 8)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? "bg-zinc-800 text-zinc-400"}`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{r.url}</p>
                      {r.requirement_text && (
                        <p className="mt-0.5 line-clamp-1 text-xs italic text-zinc-600">
                          {r.requirement_text}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <ArrowRight size={14} className="text-zinc-600" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
